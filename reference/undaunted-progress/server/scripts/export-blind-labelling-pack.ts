import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  BLIND_TOP_K,
  type BlindLabellingRow,
} from "../services/blind-labelling";
import {
  serialiseBlankBlindCsv,
  shuffleBlindRows,
} from "../services/blind-labelling-csv";
import { parseBlindLabellingCsv } from "../services/blind-labelling-file";
import { projectBlindLabellingRows } from "../services/blind-labelling-projection";
import {
  buildBlindPackManifest,
  normaliseIsoTimestamp,
  parseBlindPackPurpose,
  type BlindPackPurpose,
} from "../services/blind-labelling-manifest";
import { validateFrozenLabellingRows } from "../services/frozen-labelling";
import { parseFrozenLabelManifest } from "../services/frozen-labelling-manifest";
import { selectSupplementaryRows } from "../services/supplementary-labelling";

type ExportArgs = {
  inputPaths: string[];
  outputPath: string;
  manifestPath: string;
  packVersion: string;
  purpose: BlindPackPurpose;
  createdAt: string;
  expectedQueryCount?: number;
  expectedRowsPerQuery?: number;
  frozenLabelsPath?: string;
  frozenManifestPath?: string;
};

function getValues(args: string[], name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg.startsWith(`${name}=`)) {
      const value = arg.slice(name.length + 1);
      if (!value) throw new Error(`${name} needs a value.`);
      values.push(value);
    } else if (arg === name) {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${name} needs a value.`);
      }
      values.push(value);
      index += 1;
    }
  }
  return values;
}

function getOptionalPositiveInteger(
  args: string[],
  name: string,
): number | undefined {
  const values = getValues(args, name);
  if (values.length > 1) throw new Error(`${name} can only be provided once.`);
  if (values.length === 0) return undefined;
  if (!/^\d+$/.test(values[0]) || Number(values[0]) < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return Number(values[0]);
}

function parseArgs(args: string[]): ExportArgs {
  const inputPaths = getValues(args, "--input");
  const outputPaths = getValues(args, "--output");
  const manifestPaths = getValues(args, "--manifest");
  const packVersions = getValues(args, "--pack-version");
  const purposes = getValues(args, "--purpose");
  const createdAtValues = getValues(args, "--created-at");
  const frozenLabelsPaths = getValues(args, "--exclude-frozen");
  const frozenManifestPaths = getValues(args, "--frozen-manifest");
  const expectedQueryCount = getOptionalPositiveInteger(
    args,
    "--expected-query-count",
  );
  const expectedRowsPerQuery = getOptionalPositiveInteger(
    args,
    "--expected-rows-per-query",
  );
  if (
    inputPaths.length === 0 ||
    outputPaths.length !== 1 ||
    manifestPaths.length !== 1 ||
    packVersions.length !== 1 ||
    purposes.length !== 1 ||
    createdAtValues.length > 1
  ) {
    throw new Error(
      "Usage: tsx export-blind-labelling-pack.ts --input <scored-json> [--input <scored-json>] --output <blind-csv> --manifest <manifest-json> --pack-version <version> --purpose <sample|formal|supplementary> [--created-at <iso>] [--expected-query-count <count>] [--expected-rows-per-query <count>] [--exclude-frozen <labelled-csv> --frozen-manifest <frozen-manifest-json>]",
    );
  }
  const purpose = parseBlindPackPurpose(purposes[0]);
  if (frozenLabelsPaths.length > 1 || frozenManifestPaths.length > 1) {
    throw new Error(
      "--exclude-frozen and --frozen-manifest can only be provided once.",
    );
  }
  if (
    purpose === "supplementary" &&
    (frozenLabelsPaths.length !== 1 || frozenManifestPaths.length !== 1)
  ) {
    throw new Error(
      "Supplementary exports require --exclude-frozen and --frozen-manifest.",
    );
  }
  if (
    purpose !== "supplementary" &&
    (frozenLabelsPaths.length > 0 || frozenManifestPaths.length > 0)
  ) {
    throw new Error(
      "Frozen label inputs can only be used for supplementary exports.",
    );
  }
  if (
    purpose === "formal" &&
    (expectedQueryCount === undefined || expectedRowsPerQuery === undefined)
  ) {
    throw new Error(
      "Formal exports require --expected-query-count and --expected-rows-per-query.",
    );
  }
  if (
    expectedRowsPerQuery !== undefined &&
    expectedRowsPerQuery > BLIND_TOP_K
  ) {
    throw new Error(
      `--expected-rows-per-query cannot exceed the blind top-k limit of ${BLIND_TOP_K}.`,
    );
  }
  if (
    purpose !== "sample" &&
    inputPaths.some((inputPath) => !inputPath.endsWith(".local.json"))
  ) {
    throw new Error(
      "Formal and supplementary scored inputs must end in .local.json.",
    );
  }
  if (purpose !== "sample" && !outputPaths[0].endsWith(".local.csv")) {
    throw new Error(
      "Formal and supplementary CSV outputs must end in .local.csv.",
    );
  }
  if (purpose !== "sample" && !manifestPaths[0].endsWith(".local.json")) {
    throw new Error(
      "Formal and supplementary manifests must end in .local.json.",
    );
  }
  if (frozenLabelsPaths[0] && !frozenLabelsPaths[0].endsWith(".local.csv")) {
    throw new Error("Frozen label input must end in .local.csv.");
  }
  if (
    frozenManifestPaths[0] &&
    !frozenManifestPaths[0].endsWith(".local.json")
  ) {
    throw new Error("Frozen label manifest must end in .local.json.");
  }
  return {
    inputPaths,
    outputPath: outputPaths[0],
    manifestPath: manifestPaths[0],
    packVersion: packVersions[0],
    purpose,
    createdAt: normaliseIsoTimestamp(
      createdAtValues[0] || new Date().toISOString(),
    ),
    expectedQueryCount,
    expectedRowsPerQuery,
    frozenLabelsPath: frozenLabelsPaths[0],
    frozenManifestPath: frozenManifestPaths[0],
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rows: BlindLabellingRow[] = [];
  const pairs = new Set<string>();
  const queryIds = new Set<string>();

  for (const inputPath of args.inputPaths) {
    const source = JSON.parse(await readFile(inputPath, "utf8")) as unknown;
    const inputRows = projectBlindLabellingRows(source);
    if (inputRows.length === 0) {
      throw new Error(`Scored input has no top-k rows: ${inputPath}.`);
    }
    const inputQueryIds = new Set(inputRows.map((row) => row.queryId));
    if (inputQueryIds.size !== 1) {
      throw new Error(
        `Scored input must contain exactly one query: ${inputPath}.`,
      );
    }
    const queryId = inputRows[0].queryId;
    if (queryIds.has(queryId)) {
      throw new Error(`Duplicate queryId across scored inputs: ${queryId}.`);
    }
    if (
      args.expectedRowsPerQuery !== undefined &&
      inputRows.length !== args.expectedRowsPerQuery
    ) {
      throw new Error(
        `Query ${queryId} must provide ${args.expectedRowsPerQuery} top-k rows; found ${inputRows.length}.`,
      );
    }
    queryIds.add(queryId);

    for (const row of inputRows) {
      const pair = `${row.queryId}\u0000${row.investorId}`;
      if (pairs.has(pair)) {
        throw new Error(
          `Duplicate queryId + investorId pair across inputs: ${row.queryId} + ${row.investorId}.`,
        );
      }
      pairs.add(pair);
      rows.push(row);
    }
  }

  if (
    args.expectedQueryCount !== undefined &&
    queryIds.size !== args.expectedQueryCount
  ) {
    throw new Error(
      `Pack must contain ${args.expectedQueryCount} queries; found ${queryIds.size}.`,
    );
  }

  let exportRows = rows;
  if (args.purpose === "supplementary") {
    const frozenCsv = await readFile(args.frozenLabelsPath!, "utf8");
    const frozenRows = parseBlindLabellingCsv(frozenCsv, "Frozen label CSV");
    const frozenValidation = validateFrozenLabellingRows(frozenRows);
    if (frozenValidation.errors.length > 0) {
      throw new Error(frozenValidation.errors.join("\n"));
    }
    parseFrozenLabelManifest(
      JSON.parse(await readFile(args.frozenManifestPath!, "utf8")) as unknown,
      {
        csv: frozenCsv,
        fileName: path.basename(args.frozenLabelsPath!),
        summary: frozenValidation.summary,
      },
    );
    const selection = selectSupplementaryRows(rows, frozenRows);
    if (selection.rows.length === 0) {
      throw new Error("Supplementary export has no new pairs to label.");
    }
    exportRows = selection.rows;
    console.log(
      `Selected ${selection.summary.newPairCount} new pairs from ${selection.summary.candidatePairCount} candidates.`,
    );
  }

  const shuffledRows = shuffleBlindRows(exportRows);
  const csv = serialiseBlankBlindCsv(shuffledRows);
  const manifest = buildBlindPackManifest({
    csv,
    rows: shuffledRows,
    packVersion: args.packVersion,
    purpose: args.purpose,
    createdAt: args.createdAt,
    fileName: path.basename(args.outputPath),
  });
  await mkdir(path.dirname(args.outputPath), { recursive: true });
  await mkdir(path.dirname(args.manifestPath), { recursive: true });
  await writeFile(args.outputPath, csv, "utf8");
  await writeFile(
    args.manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  console.log(
    `Wrote ${exportRows.length} blind labelling rows to ${args.outputPath}`,
  );
  console.log(`Wrote blind labelling manifest to ${args.manifestPath}`);
}

main().catch((error: Error) => {
  console.error(`Blind labelling export failed: ${error.message}`);
  process.exit(1);
});
