import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import {
  BLIND_JUDGEMENT_COLUMNS,
  BLIND_LABELLING_COLUMNS,
  BLIND_LABELLING_SCHEMA_VERSION,
} from "../services/blind-labelling";
import {
  BLIND_PACK_MANIFEST_SCHEMA_VERSION,
  BLIND_PACK_PURPOSES,
  normaliseIsoTimestamp,
  parseBlindPackPurpose,
  sha256Text,
  type BlindPackPurpose,
} from "../services/blind-labelling-manifest";

type JsonObject = Record<string, unknown>;

const amountColumns = [
  "amountRaisingGbp",
  "minimumTicketSizeGbp",
  "investorMinimumTicketSizeGbp",
  "investorMaximumTicketSizeGbp",
] as const;

function getOptionalArg(args: string[], name: string): string | undefined {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) {
    const value = inline.slice(name.length + 1);
    if (!value) throw new Error(`${name} needs a value.`);
    return value;
  }
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = index >= 0 ? args[index + 1] : undefined;
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} needs a value.`);
  }
  return value;
}

function getArg(args: string[], name: string): string {
  const value = getOptionalArg(args, name);
  if (!value) throw new Error(`${name} needs a value.`);
  return value;
}

function getPositiveIntegerArg(
  args: string[],
  name: string,
): number | undefined {
  const value = getOptionalArg(args, name);
  if (value === undefined) return undefined;
  if (!/^\d+$/.test(value) || Number(value) < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return Number(value);
}

type PackExpectations = {
  purpose?: BlindPackPurpose;
  queryCount?: number;
  rowsPerQuery?: number;
};

function parseExpectations(args: string[]): PackExpectations {
  const purpose = getOptionalArg(args, "--expected-purpose");
  return {
    purpose: purpose ? parseBlindPackPurpose(purpose) : undefined,
    queryCount: getPositiveIntegerArg(args, "--expected-query-count"),
    rowsPerQuery: getPositiveIntegerArg(args, "--expected-rows-per-query"),
  };
}

function requireObject(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as JsonObject;
}

function requireString(object: JsonObject, key: string, errors: string[]) {
  const value = object[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`manifest.${key} must be a non-empty string.`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const inputPath = getArg(args, "--input");
  const manifestPath = getArg(args, "--manifest");
  const expectations = parseExpectations(args);
  const csv = await readFile(inputPath, "utf8");
  const parsed = parse(csv, {
    columns: false,
    skip_empty_lines: true,
  }) as string[][];
  const errors: string[] = [];
  const headers = parsed[0] || [];
  if (headers.join(",") !== BLIND_LABELLING_COLUMNS.join(",")) {
    errors.push("CSV headers do not match the fixed blind column order.");
  }

  const rows = parsed.slice(1).map((values, index) => {
    if (values.length !== BLIND_LABELLING_COLUMNS.length) {
      errors.push(`CSV row ${index + 1} has ${values.length} columns.`);
    }
    return Object.fromEntries(
      BLIND_LABELLING_COLUMNS.map((column, columnIndex) => [
        column,
        values[columnIndex] ?? "",
      ]),
    );
  });
  if (rows.length === 0) errors.push("CSV contains no labelling rows.");

  const pairs = new Set<string>();
  const rowsByQuery = new Map<string, number>();
  rows.forEach((row, index) => {
    if (
      !row.queryId ||
      !row.startupId ||
      !row.fundingRoundId ||
      !row.investorId
    ) {
      errors.push(`CSV row ${index + 1} has a blank stable identifier.`);
    }
    const pair = `${row.queryId}\u0000${row.investorId}`;
    if (pairs.has(pair)) errors.push(`CSV row ${index + 1} repeats a pair.`);
    pairs.add(pair);
    rowsByQuery.set(row.queryId, (rowsByQuery.get(row.queryId) || 0) + 1);
    if (BLIND_JUDGEMENT_COLUMNS.some((column) => row[column] !== "")) {
      errors.push(`CSV row ${index + 1} has a non-blank judgement field.`);
    }
    if (Object.values(row).some((value) => /[\r\n]/.test(value))) {
      errors.push(`CSV row ${index + 1} contains a line break.`);
    }
    if (
      Object.values(row).some((value) =>
        /\b(?:https?:\/\/|www\.)|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(
          value,
        ),
      )
    ) {
      errors.push(`CSV row ${index + 1} contains a URL or email address.`);
    }
    for (const column of amountColumns) {
      if (row[column] !== "" && !/^\d+(?:\.\d+)?$/.test(row[column])) {
        errors.push(`CSV row ${index + 1} has an invalid ${column}.`);
      }
    }
  });

  const manifest = requireObject(
    JSON.parse(await readFile(manifestPath, "utf8")) as unknown,
    "manifest",
  );
  for (const key of ["packVersion", "createdAt", "fileName", "sha256"]) {
    requireString(manifest, key, errors);
  }
  if (manifest.schemaVersion !== BLIND_PACK_MANIFEST_SCHEMA_VERSION) {
    errors.push("manifest.schemaVersion is not recognised.");
  }
  if (manifest.labellingSchemaVersion !== BLIND_LABELLING_SCHEMA_VERSION) {
    errors.push("manifest.labellingSchemaVersion is not recognised.");
  }
  if (!(BLIND_PACK_PURPOSES as readonly unknown[]).includes(manifest.purpose)) {
    errors.push("manifest.purpose is not recognised.");
  }
  if (expectations.purpose && manifest.purpose !== expectations.purpose) {
    errors.push(
      `manifest.purpose must be ${expectations.purpose} for this handover.`,
    );
  }
  if (typeof manifest.createdAt === "string") {
    try {
      normaliseIsoTimestamp(manifest.createdAt);
    } catch {
      errors.push("manifest.createdAt must be a valid timestamp.");
    }
  }
  if (manifest.fileName !== path.basename(inputPath)) {
    errors.push("manifest.fileName does not match the CSV file name.");
  }
  if (manifest.sha256 !== sha256Text(csv)) {
    errors.push("manifest.sha256 does not match the CSV file.");
  }
  if (manifest.rowCount !== rows.length) {
    errors.push("manifest.rowCount does not match the CSV.");
  }
  if (manifest.queryCount !== new Set(rows.map((row) => row.queryId)).size) {
    errors.push("manifest.queryCount does not match the CSV.");
  }
  if (manifest.columnCount !== BLIND_LABELLING_COLUMNS.length) {
    errors.push("manifest.columnCount does not match the contract.");
  }
  if (
    expectations.queryCount !== undefined &&
    rowsByQuery.size !== expectations.queryCount
  ) {
    errors.push(
      `CSV must contain ${expectations.queryCount} queries; found ${rowsByQuery.size}.`,
    );
  }
  if (expectations.rowsPerQuery !== undefined) {
    rowsByQuery.forEach((rowCount, queryId) => {
      if (rowCount !== expectations.rowsPerQuery) {
        errors.push(
          `Query ${queryId || "<blank>"} must contain ${expectations.rowsPerQuery} rows; found ${rowCount}.`,
        );
      }
    });
  }
  if (
    expectations.queryCount !== undefined &&
    expectations.rowsPerQuery !== undefined
  ) {
    const expectedRows = expectations.queryCount * expectations.rowsPerQuery;
    if (rows.length !== expectedRows) {
      errors.push(
        `CSV must contain ${expectedRows} rows; found ${rows.length}.`,
      );
    }
  }

  if (errors.length > 0) {
    console.error("Blind labelling pack check failed.");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `Blind labelling pack check passed: ${rows.length} rows, ${manifest.queryCount} queries.`,
  );
  console.log(`SHA-256: ${manifest.sha256}`);
}

main().catch((error: Error) => {
  console.error(`Blind labelling pack check failed: ${error.message}`);
  process.exit(1);
});
