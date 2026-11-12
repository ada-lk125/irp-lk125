import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildBaselineMatcherInput,
  validateBaselineExportInput,
} from "../services/baseline-export";
import type { BlindLabellingRow } from "../services/blind-labelling";
import {
  serialiseBlankBlindCsv,
  shuffleBlindRows,
} from "../services/blind-labelling-csv";
import { parseBlindLabellingCsv } from "../services/blind-labelling-file";
import {
  buildBlindPackManifest,
  normaliseIsoTimestamp,
  sha256Text,
} from "../services/blind-labelling-manifest";
import { projectBlindLabellingRows } from "../services/blind-labelling-projection";
import { validateFrozenLabellingRows } from "../services/frozen-labelling";
import { parseFrozenLabelManifest } from "../services/frozen-labelling-manifest";
import { selectSupplementaryRows } from "../services/supplementary-labelling";

const comparisonSchema = "normalisation-paired-comparison-v1";
const provenanceSchema = "pooled-supplementary-provenance-v1";

type ExportArgs = {
  comparisonPaths: string[];
  queryInputPaths: string[];
  frozenLabelsPath: string;
  frozenManifestPath: string;
  outputPath: string;
  manifestPath: string;
  provenancePath: string;
  packVersion: string;
  createdAt: string;
};

function values(args: string[], name: string): string[] {
  const result: string[] = [];
  const prefix = `${name}=`;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg.startsWith(prefix)) {
      const value = arg.slice(prefix.length);
      if (!value) throw new Error(`${name} needs a value.`);
      result.push(value);
    } else if (arg === name) {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${name} needs a value.`);
      }
      result.push(value);
      index += 1;
    }
  }
  return result;
}

function one(args: string[], name: string): string {
  const found = values(args, name);
  if (found.length !== 1) {
    throw new Error(`${name} must be provided exactly once.`);
  }
  return found[0];
}

function parseArgs(args: string[]): ExportArgs {
  const comparisonPaths = values(args, "--comparison");
  const queryInputPaths = values(args, "--query-input");
  if (comparisonPaths.length === 0) {
    throw new Error("At least one --comparison is required.");
  }
  if (new Set(comparisonPaths.map(value => path.resolve(value))).size !== comparisonPaths.length) {
    throw new Error("--comparison paths must be unique.");
  }
  if (queryInputPaths.length !== 3) {
    throw new Error("Exactly three --query-input files are required.");
  }
  const packVersion = one(args, "--pack-version").trim();
  if (!packVersion) throw new Error("--pack-version must not be blank.");
  return {
    comparisonPaths,
    queryInputPaths,
    frozenLabelsPath: one(args, "--exclude-frozen"),
    frozenManifestPath: one(args, "--frozen-manifest"),
    outputPath: one(args, "--output"),
    manifestPath: one(args, "--manifest"),
    provenancePath: one(args, "--provenance"),
    packVersion,
    createdAt: normaliseIsoTimestamp(one(args, "--created-at")),
  };
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value.trim();
}

function pairKey(row: BlindLabellingRow): string {
  return `${row.queryId}\u0000${row.investorId}`;
}

function seededPicker(seed: string) {
  let counter = 0;
  return (upperExclusive: number) => {
    const value = createHash("sha256")
      .update(`${seed}:${counter}`, "utf8")
      .digest()
      .readUInt32BE(0);
    counter += 1;
    return value % upperExclusive;
  };
}

async function protectedOutput(
  filePath: string,
  suffix: ".local.csv" | ".local.json",
): Promise<string> {
  const exportsRoot = path.resolve("exports");
  const resolved = path.resolve(filePath);
  const relative = path.relative(exportsRoot, resolved);
  const insideExports =
    relative.length > 0
    && !relative.startsWith("..")
    && !path.isAbsolute(relative);
  if (!insideExports || !path.basename(resolved).endsWith(suffix)) {
    throw new Error(`Output must stay inside exports/ and end with ${suffix}.`);
  }
  try {
    await access(resolved);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return resolved;
    throw error;
  }
  throw new Error(`Output already exists and will not be overwritten: ${filePath}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [outputPath, manifestPath, provenancePath] = await Promise.all([
    protectedOutput(args.outputPath, ".local.csv"),
    protectedOutput(args.manifestPath, ".local.json"),
    protectedOutput(args.provenancePath, ".local.json"),
  ]);

  const queryInputs = new Map<string, ReturnType<typeof buildBaselineMatcherInput>>();
  const queryInputSources = [];
  for (const inputPath of args.queryInputPaths) {
    const text = await readFile(inputPath, "utf8");
    const input = validateBaselineExportInput(JSON.parse(text));
    if (queryInputs.has(input.queryId)) {
      throw new Error(`Duplicate query input: ${input.queryId}.`);
    }
    queryInputs.set(input.queryId, buildBaselineMatcherInput(input));
    queryInputSources.push({
      queryId: input.queryId,
      fileName: path.basename(inputPath),
      sha256: sha256Text(text),
    });
  }

  const candidateRows = new Map<string, BlindLabellingRow>();
  const comparisonSources = [];
  let candidatePoolSha256: string | undefined;
  for (const comparisonPath of args.comparisonPaths) {
    const text = await readFile(comparisonPath, "utf8");
    const comparison = object(JSON.parse(text), "comparison");
    const run = object(comparison.run, "comparison.run");
    if (run.schemaVersion !== comparisonSchema) {
      throw new Error(`Unrecognised comparison schema in ${comparisonPath}.`);
    }
    if (run.candidateTieBreak !== "investor-id") {
      throw new Error("Comparison candidateTieBreak must be investor-id.");
    }
    if (run.feedbackMode !== "none") {
      throw new Error("Comparison feedbackMode must be none.");
    }
    const pool = object(run.candidatePool, "comparison.run.candidatePool");
    const poolHash = string(
      pool.candidatePoolSha256,
      "comparison.run.candidatePool.candidatePoolSha256",
    );
    candidatePoolSha256 ??= poolHash;
    if (candidatePoolSha256 !== poolHash) {
      throw new Error("All comparisons must use the same candidate pool.");
    }
    if (!Array.isArray(comparison.queries) || comparison.queries.length !== 3) {
      throw new Error("Each comparison must contain exactly three queries.");
    }

    for (const rawQuery of comparison.queries) {
      const query = object(rawQuery, "comparison query");
      const queryId = string(query.queryId, "comparison query.queryId");
      const matcherInput = queryInputs.get(queryId);
      if (!matcherInput) {
        throw new Error(`No query input supplied for ${queryId}.`);
      }
      if (
        string(query.startupId, "comparison query.startupId")
          !== matcherInput.startup.id
        || string(query.fundingRoundId, "comparison query.fundingRoundId")
          !== matcherInput.fundingRound.id
      ) {
        throw new Error(`Comparison identity mismatch for ${queryId}.`);
      }
      if (!Array.isArray(query.profiles) || query.profiles.length !== 2) {
        throw new Error(`${queryId} must contain two normalisation profiles.`);
      }
      for (const rawProfile of query.profiles) {
        const profile = object(rawProfile, `${queryId} profile`);
        if (!Array.isArray(profile.matches) || profile.matches.length !== 10) {
          throw new Error(`${queryId} profile must contain ten matches.`);
        }
        const projected = projectBlindLabellingRows({
          input: matcherInput,
          matches: profile.matches,
        });
        for (const row of projected) {
          const key = pairKey(row);
          const existing = candidateRows.get(key);
          if (existing && JSON.stringify(existing) !== JSON.stringify(row)) {
            throw new Error(`Evidence changed for pooled pair ${key}.`);
          }
          candidateRows.set(key, row);
        }
      }
    }

    comparisonSources.push({
      fileName: path.basename(comparisonPath),
      sha256: sha256Text(text),
      experimentId: string(run.experimentId, "comparison.run.experimentId"),
      purpose: string(run.purpose, "comparison.run.purpose"),
      semanticMode: string(run.semanticMode, "comparison.run.semanticMode"),
      matchingSha256: string(
        object(run.implementation, "comparison.run.implementation").matchingSha256,
        "comparison.run.implementation.matchingSha256",
      ),
    });
  }

  const frozenCsv = await readFile(args.frozenLabelsPath, "utf8");
  const frozenRows = parseBlindLabellingCsv(frozenCsv, "Frozen label CSV");
  const frozenValidation = validateFrozenLabellingRows(frozenRows);
  if (frozenValidation.errors.length > 0) {
    throw new Error(frozenValidation.errors.join("\n"));
  }
  parseFrozenLabelManifest(
    JSON.parse(await readFile(args.frozenManifestPath, "utf8")),
    {
      csv: frozenCsv,
      fileName: path.basename(args.frozenLabelsPath),
      summary: frozenValidation.summary,
    },
  );
  const selection = selectSupplementaryRows(
    [...candidateRows.values()],
    frozenRows,
  );
  if (selection.rows.length === 0) {
    throw new Error("Pooled comparison contains no new pairs to label.");
  }

  const shuffleSeed = sha256Text(
    JSON.stringify({
      packVersion: args.packVersion,
      comparisons: comparisonSources.map(source => source.sha256),
      pairs: selection.rows.map(pairKey).sort(),
    }),
  );
  const shuffledRows = shuffleBlindRows(
    selection.rows,
    seededPicker(shuffleSeed),
  );
  const csv = serialiseBlankBlindCsv(shuffledRows);
  const manifest = buildBlindPackManifest({
    csv,
    rows: shuffledRows,
    packVersion: args.packVersion,
    purpose: "supplementary",
    createdAt: args.createdAt,
    fileName: path.basename(outputPath),
  });
  const provenance = {
    schemaVersion: provenanceSchema,
    packVersion: args.packVersion,
    createdAt: args.createdAt,
    evidenceStatus: "awaiting-blind-labels",
    candidatePoolSha256,
    comparisonSources,
    queryInputSources,
    frozenLabels: {
      fileName: path.basename(args.frozenLabelsPath),
      sha256: sha256Text(frozenCsv),
      rowCount: frozenRows.length,
    },
    selection: selection.summary,
    shuffleSeedSha256: shuffleSeed,
    output: {
      fileName: path.basename(outputPath),
      sha256: sha256Text(csv),
      manifestFileName: path.basename(manifestPath),
    },
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await Promise.all([
    writeFile(outputPath, csv, { encoding: "utf8", flag: "wx" }),
    writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    }),
    writeFile(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    }),
  ]);
  console.log(
    `Selected ${selection.summary.newPairCount} new pairs from ${selection.summary.candidatePairCount} pooled pairs.`,
  );
  console.log(`Wrote supplementary CSV to ${args.outputPath}`);
  console.log(`Wrote manifest to ${args.manifestPath}`);
  console.log(`Wrote provenance to ${args.provenancePath}`);
}

main().catch((error: Error) => {
  console.error(`Pooled supplementary export failed: ${error.message}`);
  process.exitCode = 1;
});
