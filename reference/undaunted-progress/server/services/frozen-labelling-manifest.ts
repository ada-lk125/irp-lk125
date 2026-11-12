import {
  BLIND_LABELLING_COLUMNS,
  BLIND_LABELLING_SCHEMA_VERSION,
} from "./blind-labelling";
import {
  normaliseIsoTimestamp,
  sha256Text,
} from "./blind-labelling-manifest";
import type { FrozenLabellingSummary } from "./frozen-labelling";

export const FROZEN_LABEL_MANIFEST_SCHEMA_VERSION = "frozen-label-manifest-v1";

export type FrozenLabelManifest = {
  schemaVersion: typeof FROZEN_LABEL_MANIFEST_SCHEMA_VERSION;
  labellingSchemaVersion: typeof BLIND_LABELLING_SCHEMA_VERSION;
  frozenVersion: string;
  frozenAt: string;
  fileName: string;
  sha256: string;
  sourcePackVersion: string;
  sourcePackSha256: string;
  rowCount: number;
  queryCount: number;
  judgedRowCount: number;
  holdRowCount: number;
  completeQueryCount: number;
  incompleteQueryCount: number;
  columnCount: number;
};

export function buildFrozenLabelManifest(args: {
  csv: string;
  fileName: string;
  frozenVersion: string;
  frozenAt: string;
  sourcePackVersion: string;
  sourcePackSha256: string;
  summary: FrozenLabellingSummary;
}): FrozenLabelManifest {
  const manifest: FrozenLabelManifest = {
    schemaVersion: FROZEN_LABEL_MANIFEST_SCHEMA_VERSION,
    labellingSchemaVersion: BLIND_LABELLING_SCHEMA_VERSION,
    frozenVersion: args.frozenVersion.trim(),
    frozenAt: normaliseIsoTimestamp(args.frozenAt),
    fileName: args.fileName,
    sha256: sha256Text(args.csv),
    sourcePackVersion: args.sourcePackVersion.trim(),
    sourcePackSha256: args.sourcePackSha256.toLowerCase(),
    rowCount: args.summary.rowCount,
    queryCount:
      args.summary.completeQueryCount + args.summary.incompleteQueryCount,
    judgedRowCount: args.summary.judgedRowCount,
    holdRowCount: args.summary.holdRowCount,
    completeQueryCount: args.summary.completeQueryCount,
    incompleteQueryCount: args.summary.incompleteQueryCount,
    columnCount: BLIND_LABELLING_COLUMNS.length,
  };
  return parseFrozenLabelManifest(manifest, {
    csv: args.csv,
    fileName: args.fileName,
    summary: args.summary,
  });
}

export function parseFrozenLabelManifest(
  raw: unknown,
  args: {
    csv: string;
    fileName: string;
    summary?: FrozenLabellingSummary;
  },
): FrozenLabelManifest {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Frozen label manifest must be an object.");
  }
  const manifest = raw as Record<string, unknown>;
  const errors: string[] = [];
  if (manifest.schemaVersion !== FROZEN_LABEL_MANIFEST_SCHEMA_VERSION) {
    errors.push("Frozen manifest schemaVersion is not recognised.");
  }
  if (manifest.labellingSchemaVersion !== BLIND_LABELLING_SCHEMA_VERSION) {
    errors.push("Frozen manifest labellingSchemaVersion is not recognised.");
  }
  if (manifest.fileName !== args.fileName) {
    errors.push("Frozen manifest fileName does not match the labelled CSV.");
  }
  if (manifest.sha256 !== sha256Text(args.csv)) {
    errors.push("Frozen manifest SHA-256 does not match the labelled CSV.");
  }
  for (const key of [
    "frozenVersion",
    "frozenAt",
    "sourcePackVersion",
    "sourcePackSha256",
  ]) {
    if (typeof manifest[key] !== "string" || !manifest[key]) {
      errors.push(`Frozen manifest ${key} must be a non-empty string.`);
    }
  }
  if (
    typeof manifest.sourcePackSha256 === "string" &&
    !/^[a-f0-9]{64}$/.test(manifest.sourcePackSha256)
  ) {
    errors.push("Frozen manifest sourcePackSha256 must be a SHA-256 hash.");
  }
  for (const key of [
    "rowCount",
    "queryCount",
    "judgedRowCount",
    "holdRowCount",
    "completeQueryCount",
    "incompleteQueryCount",
    "columnCount",
  ]) {
    if (typeof manifest[key] !== "number" || !Number.isInteger(manifest[key])) {
      errors.push(`Frozen manifest ${key} must be an integer.`);
    }
  }
  if (typeof manifest.frozenAt === "string") {
    try {
      normaliseIsoTimestamp(manifest.frozenAt);
    } catch {
      errors.push("Frozen manifest frozenAt must be a valid timestamp.");
    }
  }
  if (args.summary) {
    const expectedQueryCount =
      args.summary.completeQueryCount + args.summary.incompleteQueryCount;
    const expectedCounts: Record<string, number> = {
      rowCount: args.summary.rowCount,
      queryCount: expectedQueryCount,
      judgedRowCount: args.summary.judgedRowCount,
      holdRowCount: args.summary.holdRowCount,
      completeQueryCount: args.summary.completeQueryCount,
      incompleteQueryCount: args.summary.incompleteQueryCount,
      columnCount: BLIND_LABELLING_COLUMNS.length,
    };
    Object.keys(expectedCounts).forEach((key) => {
      if (manifest[key] !== expectedCounts[key]) {
        errors.push(`Frozen manifest ${key} does not match the labelled CSV.`);
      }
    });
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return manifest as FrozenLabelManifest;
}
