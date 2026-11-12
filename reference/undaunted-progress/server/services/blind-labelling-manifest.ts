import { createHash } from "node:crypto";
import {
  BLIND_LABELLING_COLUMNS,
  BLIND_LABELLING_SCHEMA_VERSION,
  type BlindLabellingRow,
} from "./blind-labelling";

export const BLIND_PACK_MANIFEST_SCHEMA_VERSION = "blind-pack-manifest-v1";

export const BLIND_PACK_PURPOSES = [
  "sample",
  "formal",
  "supplementary",
] as const;

export type BlindPackPurpose = (typeof BLIND_PACK_PURPOSES)[number];

export type BlindPackManifest = {
  schemaVersion: typeof BLIND_PACK_MANIFEST_SCHEMA_VERSION;
  labellingSchemaVersion: typeof BLIND_LABELLING_SCHEMA_VERSION;
  packVersion: string;
  purpose: BlindPackPurpose;
  createdAt: string;
  fileName: string;
  sha256: string;
  rowCount: number;
  queryCount: number;
  columnCount: number;
};

export function sha256Text(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function normaliseIsoTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("createdAt must be a valid date or ISO timestamp.");
  }
  return parsed.toISOString();
}

export function parseBlindPackPurpose(value: string): BlindPackPurpose {
  if (!(BLIND_PACK_PURPOSES as readonly string[]).includes(value)) {
    throw new Error(
      `purpose must be one of: ${BLIND_PACK_PURPOSES.join(", ")}.`,
    );
  }
  return value as BlindPackPurpose;
}

export function buildBlindPackManifest(args: {
  csv: string;
  rows: readonly BlindLabellingRow[];
  packVersion: string;
  purpose: BlindPackPurpose;
  createdAt: string;
  fileName: string;
}): BlindPackManifest {
  if (args.packVersion.trim().length === 0) {
    throw new Error("packVersion must be a non-empty string.");
  }
  if (args.fileName.trim().length === 0) {
    throw new Error("fileName must be a non-empty string.");
  }

  return {
    schemaVersion: BLIND_PACK_MANIFEST_SCHEMA_VERSION,
    labellingSchemaVersion: BLIND_LABELLING_SCHEMA_VERSION,
    packVersion: args.packVersion.trim(),
    purpose: args.purpose,
    createdAt: normaliseIsoTimestamp(args.createdAt),
    fileName: args.fileName,
    sha256: sha256Text(args.csv),
    rowCount: args.rows.length,
    queryCount: new Set(args.rows.map((row) => row.queryId)).size,
    columnCount: BLIND_LABELLING_COLUMNS.length,
  };
}
