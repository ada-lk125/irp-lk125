import { spawnSync } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseBlindLabellingCsv } from "../services/blind-labelling-file";
import {
  normaliseIsoTimestamp,
  sha256Text,
} from "../services/blind-labelling-manifest";
import { validateFrozenLabellingRows } from "../services/frozen-labelling";
import { parseFrozenLabelManifest } from "../services/frozen-labelling-manifest";
import { buildNormalisationEvaluation } from "../services/normalisation-evaluation";

type Purpose = "pilot" | "formal";

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

function purpose(value: string): Purpose {
  if (value === "pilot" || value === "formal") return value;
  throw new Error("--purpose must be pilot or formal.");
}

function gitValue(args: string[]): string {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed.`);
  }
  return result.stdout.trim();
}

async function protectedOutput(filePath: string): Promise<string> {
  const exportsRoot = path.resolve("exports");
  const resolved = path.resolve(filePath);
  const relative = path.relative(exportsRoot, resolved);
  const insideExports =
    relative.length > 0
    && !relative.startsWith("..")
    && !path.isAbsolute(relative);
  if (!insideExports || !path.basename(resolved).endsWith(".local.json")) {
    throw new Error("Output must stay inside exports/ and end with .local.json.");
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
  const args = process.argv.slice(2);
  const comparisonPaths = values(args, "--comparison");
  const labelPaths = values(args, "--labels");
  const manifestPaths = values(args, "--label-manifest");
  if (comparisonPaths.length === 0) {
    throw new Error("At least one --comparison is required.");
  }
  if (labelPaths.length === 0 || labelPaths.length !== manifestPaths.length) {
    throw new Error(
      "Provide one --label-manifest for every --labels file.",
    );
  }
  const evaluationId = one(args, "--evaluation-id").trim();
  if (!evaluationId) throw new Error("--evaluation-id must not be blank.");
  const evaluationPurpose = purpose(one(args, "--purpose"));
  const createdAt = normaliseIsoTimestamp(one(args, "--created-at"));
  const outputPath = await protectedOutput(one(args, "--output"));
  const gitCommit = gitValue(["rev-parse", "HEAD"]);
  const workingTreeDirty = gitValue(["status", "--porcelain"]).length > 0;
  if (evaluationPurpose === "formal" && workingTreeDirty) {
    throw new Error("Formal evaluation requires a clean Git worktree.");
  }

  const comparisons = await Promise.all(
    comparisonPaths.map(async comparisonPath => {
      const text = await readFile(comparisonPath, "utf8");
      return {
        fileName: path.basename(comparisonPath),
        sha256: sha256Text(text),
        value: JSON.parse(text) as unknown,
      };
    }),
  );
  const labelSets = [];
  const labelManifests = [];
  for (let index = 0; index < labelPaths.length; index += 1) {
    const labelPath = labelPaths[index];
    const manifestPath = manifestPaths[index];
    const [csv, manifestText] = await Promise.all([
      readFile(labelPath, "utf8"),
      readFile(manifestPath, "utf8"),
    ]);
    const rows = parseBlindLabellingCsv(csv, path.basename(labelPath));
    const validation = validateFrozenLabellingRows(rows);
    if (validation.errors.length > 0) {
      throw new Error(validation.errors.join("\n"));
    }
    const manifest = parseFrozenLabelManifest(JSON.parse(manifestText), {
      csv,
      fileName: path.basename(labelPath),
      summary: validation.summary,
    });
    labelSets.push({
      fileName: path.basename(labelPath),
      sha256: sha256Text(csv),
      rows,
    });
    labelManifests.push({
      fileName: path.basename(manifestPath),
      sha256: sha256Text(manifestText),
      frozenVersion: manifest.frozenVersion,
      sourcePackVersion: manifest.sourcePackVersion,
      sourcePackSha256: manifest.sourcePackSha256,
    });
  }

  const evaluation = buildNormalisationEvaluation({
    purpose: evaluationPurpose,
    comparisons,
    labelSets,
  });
  const evaluationSourcePath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../services/normalisation-evaluation.ts",
  );
  const evaluationSource = await readFile(evaluationSourcePath, "utf8");
  const output = {
    run: {
      schemaVersion: evaluation.schemaVersion,
      evaluationId,
      purpose: evaluationPurpose,
      evidenceStatus:
        evaluationPurpose === "formal" ? "formal-labelled" : "pilot-labelled",
      createdAt,
      implementation: {
        gitCommit,
        workingTreeDirty,
        evaluationFile: path.relative(process.cwd(), evaluationSourcePath),
        evaluationSha256: sha256Text(evaluationSource),
      },
    },
    metricDefinition: evaluation.metricDefinition,
    candidatePoolSha256: evaluation.candidatePoolSha256,
    matchingSha256: evaluation.matchingSha256,
    queryIds: evaluation.queryIds,
    labelPool: {
      ...evaluation.labelPool,
      manifests: labelManifests,
    },
    methods: evaluation.methods,
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  console.log(`Wrote ${evaluationPurpose} evaluation to ${outputPath}`);
  console.log(
    `${evaluation.labelPool.rowCount} frozen labels; ${evaluation.methods.length} semantic modes.`,
  );
  for (const method of evaluation.methods) {
    console.log(
      `${method.semanticMode}: macro delta P@5 ${method.macro.delta.precisionAt5}, P@10 ${method.macro.delta.precisionAt10}, MRR ${method.macro.delta.mrr}, NDCG@10 ${method.macro.delta.ndcgAt10}`,
    );
  }
}

main().catch((error: Error) => {
  console.error(`Normalisation evaluation failed: ${error.message}`);
  process.exitCode = 1;
});
