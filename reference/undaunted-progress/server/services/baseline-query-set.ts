import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  validateBaselineExportInput,
  type BaselineExportInput,
} from "./baseline-export";

export const BASELINE_QUERY_SET_SCHEMA_VERSION = "baseline-query-set-v1";

export type BaselineQuerySetEntry = {
  inputPath: string;
  input: BaselineExportInput;
};

export type BaselineQuerySet = {
  schemaVersion: typeof BASELINE_QUERY_SET_SCHEMA_VERSION;
  manifestPath: string;
  queries: BaselineQuerySetEntry[];
};

function duplicateValues(values: string[]): string[] {
  return [
    ...new Set(
      values.filter((value, index) => values.indexOf(value) !== index),
    ),
  ];
}

function readInputPaths(raw: unknown): string[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Query set manifest must be a JSON object.");
  }

  const manifest = raw as Record<string, unknown>;
  if (manifest.schemaVersion !== BASELINE_QUERY_SET_SCHEMA_VERSION) {
    throw new Error(
      `Query set schemaVersion must be ${BASELINE_QUERY_SET_SCHEMA_VERSION}.`,
    );
  }
  if (!Array.isArray(manifest.inputs) || manifest.inputs.length === 0) {
    throw new Error("Query set inputs must be a non-empty array.");
  }

  const invalidIndex = manifest.inputs.findIndex(
    (inputPath) =>
      typeof inputPath !== "string" || inputPath.trim().length === 0,
  );
  if (invalidIndex >= 0) {
    throw new Error(`Query set inputs[${invalidIndex}] must be a file path.`);
  }

  return (manifest.inputs as string[]).map((inputPath) => inputPath.trim());
}

export async function loadBaselineQuerySet(
  manifestPath: string,
): Promise<BaselineQuerySet> {
  const absoluteManifestPath = path.resolve(manifestPath);
  const manifestDirectory = path.dirname(absoluteManifestPath);
  const rawManifest = JSON.parse(
    await readFile(absoluteManifestPath, "utf8"),
  ) as unknown;
  const inputPaths = readInputPaths(rawManifest);
  const duplicatePaths = duplicateValues(inputPaths);
  if (duplicatePaths.length > 0) {
    throw new Error(
      `Query set contains duplicate input paths: ${duplicatePaths.join(", ")}.`,
    );
  }

  const queries: BaselineQuerySetEntry[] = [];
  for (const inputPath of inputPaths) {
    const absoluteInputPath = path.resolve(manifestDirectory, inputPath);
    const rawInput = JSON.parse(
      await readFile(absoluteInputPath, "utf8"),
    ) as unknown;
    queries.push({
      inputPath: absoluteInputPath,
      input: validateBaselineExportInput(rawInput),
    });
  }

  const duplicateQueryIds = duplicateValues(
    queries.map(({ input }) => input.queryId),
  );
  if (duplicateQueryIds.length > 0) {
    throw new Error(
      `Query set contains duplicate queryId values: ${duplicateQueryIds.join(", ")}.`,
    );
  }

  const duplicateRoundIds = duplicateValues(
    queries.map(({ input }) => input.fundingRoundId),
  );
  if (duplicateRoundIds.length > 0) {
    throw new Error(
      `Query set contains duplicate fundingRoundId values: ${duplicateRoundIds.join(", ")}.`,
    );
  }

  return {
    schemaVersion: BASELINE_QUERY_SET_SCHEMA_VERSION,
    manifestPath: absoluteManifestPath,
    queries,
  };
}
