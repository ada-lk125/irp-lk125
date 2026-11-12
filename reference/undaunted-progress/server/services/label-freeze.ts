import {
  access,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import {
  BLIND_LABELLING_COLUMNS,
  BLIND_LABELLING_SCHEMA_VERSION,
  type BlindLabellingRow,
} from "./blind-labelling";
import { parseBlindLabellingCsv } from "./blind-labelling-file";
import {
  BLIND_PACK_MANIFEST_SCHEMA_VERSION,
  type BlindPackPurpose,
  sha256Text,
} from "./blind-labelling-manifest";
import { validateFrozenLabellingFile } from "./frozen-labelling-file";
import {
  buildFrozenLabelManifest,
  type FrozenLabelManifest,
} from "./frozen-labelling-manifest";

type JsonObject = Record<string, unknown>;

export type FreezeLabelsArgs = {
  purpose: Extract<BlindPackPurpose, "formal" | "supplementary">;
  workingDirectory: string;
  sourcePath: string;
  sourceManifestPath: string;
  labelledPath: string;
  outputPath: string;
  manifestPath: string;
  frozenVersion: string;
  frozenAt: string;
  expectedQueryCount: number;
  expectedRowsPerQuery?: number;
};

export type FrozenLabelOutput = {
  outputPath: string;
  manifestPath: string;
  manifest: FrozenLabelManifest;
};

function requireObject(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as JsonObject;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value.trim();
}

function resolvePrivateOutput(
  workingDirectory: string,
  filePath: string,
  suffix: string,
): string {
  const exportsRoot = path.resolve(workingDirectory, "exports");
  const resolved = path.resolve(workingDirectory, filePath);
  const relative = path.relative(exportsRoot, resolved);
  if (
    relative.length === 0
    || relative.startsWith("..")
    || path.isAbsolute(relative)
    || !path.basename(resolved).endsWith(suffix)
  ) {
    throw new Error(
      `Output must stay inside exports/ and end with ${suffix}: ${filePath}`,
    );
  }
  return resolved;
}

async function assertMissing(filePaths: readonly string[]) {
  const existing: string[] = [];
  for (const filePath of filePaths) {
    try {
      await access(filePath);
      existing.push(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  if (existing.length > 0) {
    throw new Error(
      `Frozen outputs already exist and will not be overwritten:\n${existing
        .map(filePath => `- ${filePath}`)
        .join("\n")}`,
    );
  }
}

export function validateSourcePackManifest(args: {
  raw: unknown;
  csv: string;
  sourcePath: string;
  expectedPurpose: FreezeLabelsArgs["purpose"];
}): {
  packVersion: string;
  sha256: string;
  rows: BlindLabellingRow[];
} {
  const manifest = requireObject(args.raw, "source pack manifest");
  if (manifest.schemaVersion !== BLIND_PACK_MANIFEST_SCHEMA_VERSION) {
    throw new Error("Source pack manifest schemaVersion is not recognised.");
  }
  if (manifest.labellingSchemaVersion !== BLIND_LABELLING_SCHEMA_VERSION) {
    throw new Error(
      "Source pack manifest labellingSchemaVersion is not recognised.",
    );
  }
  if (manifest.purpose !== args.expectedPurpose) {
    throw new Error(
      `Source pack manifest purpose must be ${args.expectedPurpose}.`,
    );
  }
  if (manifest.fileName !== path.basename(args.sourcePath)) {
    throw new Error("Source pack manifest fileName does not match the CSV.");
  }
  const expectedSha256 = sha256Text(args.csv);
  if (manifest.sha256 !== expectedSha256) {
    throw new Error("Source pack manifest SHA-256 does not match the CSV.");
  }
  const rows = parseBlindLabellingCsv(
    args.csv,
    `source ${args.expectedPurpose} CSV`,
  );
  const expectedCounts: Record<string, number> = {
    rowCount: rows.length,
    queryCount: new Set(rows.map(row => row.queryId)).size,
    columnCount: BLIND_LABELLING_COLUMNS.length,
  };
  for (const [key, value] of Object.entries(expectedCounts)) {
    if (manifest[key] !== value) {
      throw new Error(`Source pack manifest ${key} does not match the CSV.`);
    }
  }
  return {
    packVersion: requireString(
      manifest.packVersion,
      "source pack manifest.packVersion",
    ),
    sha256: expectedSha256,
    rows,
  };
}

function requireCompleteLabels(args: {
  purpose: FreezeLabelsArgs["purpose"];
  sourceRows: readonly BlindLabellingRow[];
  labelledRows: readonly BlindLabellingRow[];
  expectedQueryCount: number;
  expectedRowsPerQuery?: number;
}) {
  const validation = validateFrozenLabellingFile({
    sourceRows: args.sourceRows,
    labelledRows: args.labelledRows,
    expectedQueryCount: args.expectedQueryCount,
    expectedRowsPerQuery: args.expectedRowsPerQuery,
  });
  if (validation.errors.length > 0) {
    throw new Error(
      `${args.purpose} labels cannot be frozen:\n${validation.errors
        .map(error => `- ${error}`)
        .join("\n")}`,
    );
  }
  if (
    validation.summary.rowCount === 0
    || validation.summary.judgedRowCount !== validation.summary.rowCount
    || validation.summary.holdRowCount !== 0
    || validation.summary.completeQueryCount !== args.expectedQueryCount
    || validation.summary.incompleteQueryCount !== 0
  ) {
    throw new Error(
      `${args.purpose} labels must contain ${args.expectedQueryCount} complete queries with no holds.`,
    );
  }
  return validation.summary;
}

export async function freezeLabels(
  args: FreezeLabelsArgs,
): Promise<FrozenLabelOutput> {
  if (!Number.isInteger(args.expectedQueryCount) || args.expectedQueryCount <= 0) {
    throw new Error("expectedQueryCount must be a positive integer.");
  }
  if (
    args.expectedRowsPerQuery !== undefined
    && (
      !Number.isInteger(args.expectedRowsPerQuery)
      || args.expectedRowsPerQuery <= 0
    )
  ) {
    throw new Error("expectedRowsPerQuery must be a positive integer.");
  }

  const outputPath = resolvePrivateOutput(
    args.workingDirectory,
    args.outputPath,
    ".local.csv",
  );
  const manifestPath = resolvePrivateOutput(
    args.workingDirectory,
    args.manifestPath,
    ".local.json",
  );
  await assertMissing([outputPath, manifestPath]);

  const [sourceCsv, labelledCsv, sourceManifestText] = await Promise.all([
    readFile(args.sourcePath, "utf8"),
    readFile(args.labelledPath, "utf8"),
    readFile(args.sourceManifestPath, "utf8"),
  ]);
  const sourceManifest = validateSourcePackManifest({
    raw: JSON.parse(sourceManifestText) as unknown,
    csv: sourceCsv,
    sourcePath: args.sourcePath,
    expectedPurpose: args.purpose,
  });
  const labelledRows = parseBlindLabellingCsv(
    labelledCsv,
    `labelled ${args.purpose} CSV`,
  );
  const summary = requireCompleteLabels({
    purpose: args.purpose,
    sourceRows: sourceManifest.rows,
    labelledRows,
    expectedQueryCount: args.expectedQueryCount,
    expectedRowsPerQuery: args.expectedRowsPerQuery,
  });
  const manifest = buildFrozenLabelManifest({
    csv: labelledCsv,
    fileName: path.basename(outputPath),
    frozenVersion: args.frozenVersion,
    frozenAt: args.frozenAt,
    sourcePackVersion: sourceManifest.packVersion,
    sourcePackSha256: sourceManifest.sha256,
    summary,
  });

  await mkdir(path.dirname(outputPath), { recursive: true });
  const pendingOutputPath = `${outputPath}.pending`;
  const pendingManifestPath = `${manifestPath}.pending`;
  try {
    await writeFile(pendingOutputPath, labelledCsv, {
      encoding: "utf8",
      flag: "wx",
    });
    await writeFile(
      pendingManifestPath,
      `${JSON.stringify(manifest, null, 2)}\n`,
      { encoding: "utf8", flag: "wx" },
    );
    await rename(pendingOutputPath, outputPath);
    await rename(pendingManifestPath, manifestPath);
  } catch (error) {
    await Promise.all(
      [
        pendingOutputPath,
        pendingManifestPath,
        outputPath,
        manifestPath,
      ].map(filePath => rm(filePath, { force: true })),
    );
    throw error;
  }

  return { outputPath, manifestPath, manifest };
}
