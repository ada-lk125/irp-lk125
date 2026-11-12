import { randomUUID } from "node:crypto";
import { access, link, mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { parseBlindLabellingCsv } from "./blind-labelling-file";
import { sha256Text } from "./blind-labelling-manifest";
import {
  validateFeedbackComparisonBatchManifest,
  type FeedbackComparisonBatchManifest,
} from "./feedback-comparison-batch-manifest";
import {
  validateFeedbackComparisonExport,
  type FeedbackComparisonExport,
} from "./feedback-comparison-export";
import { validateFrozenLabellingRows } from "./frozen-labelling";
import {
  parseFrozenLabelManifest,
  type FrozenLabelManifest,
} from "./frozen-labelling-manifest";

export const FEEDBACK_ABLATION_INTAKE_SCHEMA_VERSION =
  "feedback-ablation-intake-v1";
export const FEEDBACK_ABLATION_INTAKE_MANIFEST_SCHEMA_VERSION =
  "feedback-ablation-intake-manifest-v1";

export const FEEDBACK_ABLATION_METHODS = [
  "no_feedback_gpt",
  "curated_feedback",
] as const;

export const FEEDBACK_ABLATION_INTAKE_COLUMNS = [
  "schemaVersion",
  "method",
  "queryId",
  "startupId",
  "fundingRoundId",
  "rank",
  "investorId",
] as const;

export type FeedbackAblationMethod = (typeof FEEDBACK_ABLATION_METHODS)[number];

export interface FeedbackAblationIntakeRow {
  schemaVersion: typeof FEEDBACK_ABLATION_INTAKE_SCHEMA_VERSION;
  method: FeedbackAblationMethod;
  queryId: string;
  startupId: string;
  fundingRoundId: string;
  rank: number;
  investorId: string;
}

export type FeedbackAblationEvaluationStatus =
  | "requires-supplementary-blind-labelling"
  | "requires-complete-frozen-labels"
  | "ready-for-metrics";

export interface FeedbackAblationIntakeManifest {
  schemaVersion: typeof FEEDBACK_ABLATION_INTAKE_MANIFEST_SCHEMA_VERSION;
  intakeVersion: typeof FEEDBACK_ABLATION_INTAKE_SCHEMA_VERSION;
  createdAt: string;
  batch: {
    batchId: string;
    manifestFileName: string;
    manifestSha256: string;
  };
  csv: {
    fileName: string;
    sha256: string;
    rowCount: 60;
    queryCount: 3;
    methods: readonly ["no_feedback_gpt", "curated_feedback"];
    ranks: readonly [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  };
  frozenLabels: {
    csvFileName: string;
    csvSha256: string;
    manifestFileName: string;
    manifestSha256: string;
    frozenVersion: string;
    sourcePackSha256: string;
  };
  queries: Array<{
    queryId: string;
    startupId: string;
    fundingRoundId: string;
    candidatePoolSha256: string;
  }>;
  labelCoverage: {
    uniqueTopTenPairCount: number;
    coveredPairCount: number;
    missingPairCount: number;
    frozenLabelsComplete: boolean;
  };
  evaluationStatus: FeedbackAblationEvaluationStatus;
}

export interface FeedbackAblationIntakeArtifacts {
  csv: string;
  manifest: FeedbackAblationIntakeManifest;
}

export interface FeedbackAblationIntakeSummary {
  batchId: string;
  queryIds: string[];
  rowCount: number;
  uniqueTopTenPairCount: number;
  missingPairCount: number;
  evaluationStatus: FeedbackAblationEvaluationStatus;
}

const RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requireOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  label: string,
) {
  const allowed = new Set(allowedKeys);
  const unexpected = Object.keys(value).filter((key) => !allowed.has(key));
  if (unexpected.length > 0) {
    throw new Error(
      `${label} contains unexpected fields: ${unexpected.join(", ")}.`,
    );
  }
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value.trim();
}

function requireSha256(value: unknown, label: string): string {
  const hash = requireString(value, label).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(hash)) {
    throw new Error(`${label} must be a SHA-256 hash.`);
  }
  return hash;
}

function requireInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
  return Number(value);
}

function requirePrivateFileName(
  value: unknown,
  label: string,
  suffix: ".local.csv" | ".local.json" | ".local.manifest.json",
): string {
  const fileName = requireString(value, label);
  if (
    fileName !== path.basename(fileName) ||
    fileName.includes("\\") ||
    !fileName.endsWith(suffix)
  ) {
    throw new Error(
      `${label} must be a ${suffix} file name without a directory.`,
    );
  }
  return fileName;
}

function normaliseTimestamp(value?: string): string {
  const timestamp = value ? new Date(value) : new Date();
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error("createdAt must be a valid date or ISO timestamp.");
  }
  return timestamp.toISOString();
}

function quoteCsvCell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function pairKey(queryId: string, investorId: string): string {
  return `${queryId}\u0000${investorId}`;
}

function arraysEqual(
  left: readonly unknown[],
  right: readonly unknown[],
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function serialiseFeedbackAblationIntakeCsv(
  rows: readonly FeedbackAblationIntakeRow[],
): string {
  validateFeedbackAblationIntakeRows(rows);
  const lines = [FEEDBACK_ABLATION_INTAKE_COLUMNS.map(quoteCsvCell).join(",")];
  for (const row of rows) {
    lines.push(
      FEEDBACK_ABLATION_INTAKE_COLUMNS.map((column) =>
        quoteCsvCell(row[column]),
      ).join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

export function parseFeedbackAblationIntakeCsv(
  csv: string,
  label = "Feedback ablation intake CSV",
): FeedbackAblationIntakeRow[] {
  const records = parse(csv, {
    columns: false,
    skip_empty_lines: true,
  }) as string[][];
  const headers = records[0] || [];
  if (!arraysEqual(headers, FEEDBACK_ABLATION_INTAKE_COLUMNS)) {
    throw new Error(`${label} headers do not match the intake column order.`);
  }
  const rows = records.slice(1).map((values, index) => {
    if (values.length !== FEEDBACK_ABLATION_INTAKE_COLUMNS.length) {
      throw new Error(
        `${label} row ${index + 1} has ${values.length} columns; expected ${FEEDBACK_ABLATION_INTAKE_COLUMNS.length}.`,
      );
    }
    if (!/^\d+$/.test(values[5] || "")) {
      throw new Error(`${label} row ${index + 1} rank must be an integer.`);
    }
    return {
      schemaVersion: values[0],
      method: values[1],
      queryId: values[2],
      startupId: values[3],
      fundingRoundId: values[4],
      rank: Number(values[5]),
      investorId: values[6],
    } as FeedbackAblationIntakeRow;
  });
  validateFeedbackAblationIntakeRows(rows);
  return rows;
}

export function validateFeedbackAblationIntakeRows(
  rows: readonly FeedbackAblationIntakeRow[],
): Array<{
  queryId: string;
  startupId: string;
  fundingRoundId: string;
}> {
  if (rows.length !== 60) {
    throw new Error(
      `Feedback ablation intake must contain 60 rows; found ${rows.length}.`,
    );
  }

  const queryOrder: string[] = [];
  const queryIdentities = new Map<
    string,
    { startupId: string; fundingRoundId: string }
  >();
  const groups = new Map<string, FeedbackAblationIntakeRow[]>();

  rows.forEach((row, index) => {
    if (row.schemaVersion !== FEEDBACK_ABLATION_INTAKE_SCHEMA_VERSION) {
      throw new Error(
        `Feedback ablation intake row ${index + 1} has an unsupported schemaVersion.`,
      );
    }
    if (
      !(FEEDBACK_ABLATION_METHODS as readonly string[]).includes(row.method)
    ) {
      throw new Error(
        `Feedback ablation intake row ${index + 1} has an unknown method.`,
      );
    }
    const queryId = requireString(row.queryId, `rows[${index}].queryId`);
    const startupId = requireString(row.startupId, `rows[${index}].startupId`);
    const fundingRoundId = requireString(
      row.fundingRoundId,
      `rows[${index}].fundingRoundId`,
    );
    requireString(row.investorId, `rows[${index}].investorId`);
    if (!RANKS.includes(row.rank as (typeof RANKS)[number])) {
      throw new Error(
        `Feedback ablation intake row ${index + 1} rank must be 1-10.`,
      );
    }

    const identity = queryIdentities.get(queryId);
    if (!identity) {
      queryOrder.push(queryId);
      queryIdentities.set(queryId, { startupId, fundingRoundId });
    } else if (
      identity.startupId !== startupId ||
      identity.fundingRoundId !== fundingRoundId
    ) {
      throw new Error(
        `Query ${queryId} has inconsistent startup or funding-round IDs.`,
      );
    }

    const groupKey = `${queryId}\u0000${row.method}`;
    const group = groups.get(groupKey) || [];
    group.push(row);
    groups.set(groupKey, group);
  });

  if (queryOrder.length !== 3) {
    throw new Error(
      `Feedback ablation intake must contain three queries; found ${queryOrder.length}.`,
    );
  }

  for (const queryId of queryOrder) {
    for (const method of FEEDBACK_ABLATION_METHODS) {
      const group = groups.get(`${queryId}\u0000${method}`) || [];
      if (group.length !== 10) {
        throw new Error(
          `Query ${queryId} method ${method} must contain 10 rows.`,
        );
      }
      const ranks = group
        .map((row) => row.rank)
        .sort((left, right) => left - right);
      if (!arraysEqual(ranks, RANKS)) {
        throw new Error(
          `Query ${queryId} method ${method} must contain ranks 1-10.`,
        );
      }
      const investorIds = group.map((row) => row.investorId);
      if (new Set(investorIds).size !== 10) {
        throw new Error(
          `Query ${queryId} method ${method} has duplicate investors.`,
        );
      }
    }
  }

  return queryOrder.map((queryId) => ({
    queryId,
    ...queryIdentities.get(queryId)!,
  }));
}

function parseComparisonFiles(args: {
  manifest: FeedbackComparisonBatchManifest;
  files: readonly { fileName: string; text: string }[];
}): FeedbackComparisonExport[] {
  if (args.files.length !== 3) {
    throw new Error("Exactly three feedback comparison files are required.");
  }
  const byName = new Map(args.files.map((file) => [file.fileName, file]));
  if (byName.size !== args.files.length) {
    throw new Error("Feedback comparison file names must be unique.");
  }
  if (
    args.files.some(
      (file) =>
        !args.manifest.files.some((entry) => entry.fileName === file.fileName),
    )
  ) {
    throw new Error(
      "A feedback comparison file is not listed in the batch manifest.",
    );
  }

  return args.manifest.files.map((manifestFile, index) => {
    const file = byName.get(manifestFile.fileName);
    if (!file) {
      throw new Error(
        `Missing feedback comparison file: ${manifestFile.fileName}.`,
      );
    }
    if (sha256Text(file.text) !== manifestFile.sha256) {
      throw new Error(
        `Feedback comparison file hash mismatch: ${manifestFile.fileName}.`,
      );
    }
    const output = JSON.parse(file.text) as FeedbackComparisonExport;
    const summary = validateFeedbackComparisonExport(output);
    if (
      summary.queryId !== manifestFile.queryId ||
      summary.startupId !== manifestFile.startupId ||
      summary.fundingRoundId !== manifestFile.fundingRoundId ||
      summary.candidateCount !== manifestFile.candidateCount ||
      summary.candidatePoolHash !== manifestFile.candidatePoolHash ||
      output.run.matchingConfigHash !==
        args.manifest.experiment.matchingConfigHash ||
      summary.feedbackSetHash !== args.manifest.experiment.feedbackSetHash
    ) {
      throw new Error(
        `Feedback comparison file ${index + 1} does not match the batch manifest.`,
      );
    }
    return output;
  });
}

function rowsFromComparisons(
  outputs: readonly FeedbackComparisonExport[],
): FeedbackAblationIntakeRow[] {
  const methodMap = {
    none: "no_feedback_gpt",
    curated: "curated_feedback",
  } as const;
  return outputs.flatMap((output) =>
    output.runs.flatMap((run) =>
      run.matches.map((match) => ({
        schemaVersion: FEEDBACK_ABLATION_INTAKE_SCHEMA_VERSION,
        method: methodMap[run.feedbackMode],
        queryId: output.query.queryId,
        startupId: output.query.startupId,
        fundingRoundId: output.query.fundingRoundId,
        rank: match.rank,
        investorId: match.investor.id,
      })),
    ),
  );
}

function validateFrozenInputs(args: {
  csv: string;
  csvFileName: string;
  manifestText: string;
  manifestFileName: string;
  queryIdentities: readonly {
    queryId: string;
    startupId: string;
    fundingRoundId: string;
  }[];
}) {
  requirePrivateFileName(
    args.csvFileName,
    "frozenLabels.csvFileName",
    ".local.csv",
  );
  requirePrivateFileName(
    args.manifestFileName,
    "frozenLabels.manifestFileName",
    ".local.json",
  );
  const rows = parseBlindLabellingCsv(args.csv, "Frozen label CSV");
  const validation = validateFrozenLabellingRows(rows);
  if (validation.errors.length > 0) {
    throw new Error(validation.errors.join("\n"));
  }
  const manifest = parseFrozenLabelManifest(JSON.parse(args.manifestText), {
    csv: args.csv,
    fileName: args.csvFileName,
    summary: validation.summary,
  });

  const identityByQuery = new Map(
    args.queryIdentities.map((identity) => [identity.queryId, identity]),
  );
  const frozenQueryIds = new Set<string>();
  for (const row of rows) {
    const identity = identityByQuery.get(row.queryId);
    if (!identity) {
      throw new Error(
        `Frozen labels contain an unknown query: ${row.queryId}.`,
      );
    }
    if (
      row.startupId !== identity.startupId ||
      row.fundingRoundId !== identity.fundingRoundId
    ) {
      throw new Error(
        `Frozen labels do not match the identity of query ${row.queryId}.`,
      );
    }
    frozenQueryIds.add(row.queryId);
  }
  if (
    frozenQueryIds.size !== 3 ||
    args.queryIdentities.some(
      (identity) => !frozenQueryIds.has(identity.queryId),
    )
  ) {
    throw new Error(
      "Frozen labels must cover the same three query identities.",
    );
  }

  return { rows, validation, manifest };
}

export function buildFeedbackAblationIntake(args: {
  batchManifestFileName: string;
  batchManifestText: string;
  comparisonFiles: readonly { fileName: string; text: string }[];
  frozenLabelsCsv: string;
  frozenLabelsFileName: string;
  frozenManifestText: string;
  frozenManifestFileName: string;
  csvFileName: string;
  createdAt?: string;
}): FeedbackAblationIntakeArtifacts {
  const batchManifestFileName = requirePrivateFileName(
    args.batchManifestFileName,
    "batchManifestFileName",
    ".local.manifest.json",
  );
  const csvFileName = requirePrivateFileName(
    args.csvFileName,
    "csvFileName",
    ".local.csv",
  );
  const batchManifest = JSON.parse(
    args.batchManifestText,
  ) as FeedbackComparisonBatchManifest;
  const batchSummary = validateFeedbackComparisonBatchManifest(batchManifest);
  const outputs = parseComparisonFiles({
    manifest: batchManifest,
    files: args.comparisonFiles,
  });
  const rows = rowsFromComparisons(outputs);
  const queryIdentities = validateFeedbackAblationIntakeRows(rows);
  const csv = serialiseFeedbackAblationIntakeCsv(rows);
  const frozen = validateFrozenInputs({
    csv: args.frozenLabelsCsv,
    csvFileName: args.frozenLabelsFileName,
    manifestText: args.frozenManifestText,
    manifestFileName: args.frozenManifestFileName,
    queryIdentities,
  });

  const topTenPairs = new Set(
    rows.map((row) => pairKey(row.queryId, row.investorId)),
  );
  const frozenPairs = new Set(
    frozen.rows.map((row) => pairKey(row.queryId, row.investorId)),
  );
  const coveredPairCount = Array.from(topTenPairs).filter((pair) =>
    frozenPairs.has(pair),
  ).length;
  const missingPairCount = topTenPairs.size - coveredPairCount;
  const frozenLabelsComplete =
    frozen.validation.summary.incompleteQueryCount === 0;
  const evaluationStatus: FeedbackAblationEvaluationStatus =
    missingPairCount > 0
      ? "requires-supplementary-blind-labelling"
      : frozenLabelsComplete
        ? "ready-for-metrics"
        : "requires-complete-frozen-labels";

  const manifest: FeedbackAblationIntakeManifest = {
    schemaVersion: FEEDBACK_ABLATION_INTAKE_MANIFEST_SCHEMA_VERSION,
    intakeVersion: FEEDBACK_ABLATION_INTAKE_SCHEMA_VERSION,
    createdAt: normaliseTimestamp(args.createdAt),
    batch: {
      batchId: batchSummary.batchId,
      manifestFileName: batchManifestFileName,
      manifestSha256: sha256Text(args.batchManifestText),
    },
    csv: {
      fileName: csvFileName,
      sha256: sha256Text(csv),
      rowCount: 60,
      queryCount: 3,
      methods: FEEDBACK_ABLATION_METHODS,
      ranks: RANKS,
    },
    frozenLabels: {
      csvFileName: args.frozenLabelsFileName,
      csvSha256: sha256Text(args.frozenLabelsCsv),
      manifestFileName: args.frozenManifestFileName,
      manifestSha256: sha256Text(args.frozenManifestText),
      frozenVersion: frozen.manifest.frozenVersion,
      sourcePackSha256: frozen.manifest.sourcePackSha256,
    },
    queries: batchManifest.files.map((file) => ({
      queryId: file.queryId,
      startupId: file.startupId,
      fundingRoundId: file.fundingRoundId,
      candidatePoolSha256: file.candidatePoolHash,
    })),
    labelCoverage: {
      uniqueTopTenPairCount: topTenPairs.size,
      coveredPairCount,
      missingPairCount,
      frozenLabelsComplete,
    },
    evaluationStatus,
  };
  validateFeedbackAblationIntakeArtifacts({
    csv,
    manifest,
    batchManifestText: args.batchManifestText,
    frozenLabelsCsv: args.frozenLabelsCsv,
    frozenManifestText: args.frozenManifestText,
  });
  return { csv, manifest };
}

export function validateFeedbackAblationIntakeArtifacts(args: {
  csv: string;
  manifest: unknown;
  batchManifestText: string;
  frozenLabelsCsv: string;
  frozenManifestText: string;
}): FeedbackAblationIntakeSummary {
  const rows = parseFeedbackAblationIntakeCsv(args.csv);
  const queryIdentities = validateFeedbackAblationIntakeRows(rows);
  const manifest = requireObject(
    args.manifest,
    "feedback ablation intake manifest",
  );
  requireOnlyKeys(
    manifest,
    [
      "schemaVersion",
      "intakeVersion",
      "createdAt",
      "batch",
      "csv",
      "frozenLabels",
      "queries",
      "labelCoverage",
      "evaluationStatus",
    ],
    "feedback ablation intake manifest",
  );
  if (
    manifest.schemaVersion !== FEEDBACK_ABLATION_INTAKE_MANIFEST_SCHEMA_VERSION
  ) {
    throw new Error(
      "Feedback ablation intake manifest schemaVersion is not recognised.",
    );
  }
  if (manifest.intakeVersion !== FEEDBACK_ABLATION_INTAKE_SCHEMA_VERSION) {
    throw new Error(
      "Feedback ablation intake manifest intakeVersion is not recognised.",
    );
  }
  const createdAt = requireString(manifest.createdAt, "manifest.createdAt");
  if (Number.isNaN(new Date(createdAt).getTime())) {
    throw new Error("Feedback ablation intake manifest createdAt is invalid.");
  }

  const batch = requireObject(manifest.batch, "manifest.batch");
  requireOnlyKeys(
    batch,
    ["batchId", "manifestFileName", "manifestSha256"],
    "manifest.batch",
  );
  const batchId = requireString(batch.batchId, "manifest.batch.batchId");
  requirePrivateFileName(
    batch.manifestFileName,
    "manifest.batch.manifestFileName",
    ".local.manifest.json",
  );
  if (
    requireSha256(batch.manifestSha256, "manifest.batch.manifestSha256") !==
    sha256Text(args.batchManifestText)
  ) {
    throw new Error("Feedback ablation intake batch-manifest hash mismatch.");
  }
  const sourceBatch = JSON.parse(
    args.batchManifestText,
  ) as FeedbackComparisonBatchManifest;
  const sourceBatchSummary =
    validateFeedbackComparisonBatchManifest(sourceBatch);
  if (sourceBatchSummary.batchId !== batchId) {
    throw new Error(
      "Feedback ablation intake batch ID does not match its source manifest.",
    );
  }

  const csvEntry = requireObject(manifest.csv, "manifest.csv");
  requireOnlyKeys(
    csvEntry,
    ["fileName", "sha256", "rowCount", "queryCount", "methods", "ranks"],
    "manifest.csv",
  );
  requirePrivateFileName(
    csvEntry.fileName,
    "manifest.csv.fileName",
    ".local.csv",
  );
  if (
    requireSha256(csvEntry.sha256, "manifest.csv.sha256") !==
    sha256Text(args.csv)
  ) {
    throw new Error("Feedback ablation intake CSV hash mismatch.");
  }
  if (csvEntry.rowCount !== 60 || csvEntry.queryCount !== 3) {
    throw new Error(
      "Feedback ablation intake manifest must describe 60 rows and three queries.",
    );
  }
  if (
    !Array.isArray(csvEntry.methods) ||
    !arraysEqual(csvEntry.methods, FEEDBACK_ABLATION_METHODS)
  ) {
    throw new Error(
      "Feedback ablation intake manifest methods are not recognised.",
    );
  }
  if (!Array.isArray(csvEntry.ranks) || !arraysEqual(csvEntry.ranks, RANKS)) {
    throw new Error(
      "Feedback ablation intake manifest must record ranks 1-10.",
    );
  }

  const frozenLabels = requireObject(
    manifest.frozenLabels,
    "manifest.frozenLabels",
  );
  requireOnlyKeys(
    frozenLabels,
    [
      "csvFileName",
      "csvSha256",
      "manifestFileName",
      "manifestSha256",
      "frozenVersion",
      "sourcePackSha256",
    ],
    "manifest.frozenLabels",
  );
  const frozenCsvFileName = requirePrivateFileName(
    frozenLabels.csvFileName,
    "manifest.frozenLabels.csvFileName",
    ".local.csv",
  );
  requirePrivateFileName(
    frozenLabels.manifestFileName,
    "manifest.frozenLabels.manifestFileName",
    ".local.json",
  );
  if (
    requireSha256(frozenLabels.csvSha256, "manifest.frozenLabels.csvSha256") !==
    sha256Text(args.frozenLabelsCsv)
  ) {
    throw new Error("Feedback ablation intake frozen-label CSV hash mismatch.");
  }
  if (
    requireSha256(
      frozenLabels.manifestSha256,
      "manifest.frozenLabels.manifestSha256",
    ) !== sha256Text(args.frozenManifestText)
  ) {
    throw new Error(
      "Feedback ablation intake frozen-label manifest hash mismatch.",
    );
  }
  const frozenRows = parseBlindLabellingCsv(
    args.frozenLabelsCsv,
    "Frozen label CSV",
  );
  const frozenValidation = validateFrozenLabellingRows(frozenRows);
  if (frozenValidation.errors.length > 0) {
    throw new Error(frozenValidation.errors.join("\n"));
  }
  const frozenManifest = parseFrozenLabelManifest(
    JSON.parse(args.frozenManifestText),
    {
      csv: args.frozenLabelsCsv,
      fileName: frozenCsvFileName,
      summary: frozenValidation.summary,
    },
  );
  if (
    frozenLabels.frozenVersion !== frozenManifest.frozenVersion ||
    requireSha256(
      frozenLabels.sourcePackSha256,
      "manifest.frozenLabels.sourcePackSha256",
    ) !== frozenManifest.sourcePackSha256
  ) {
    throw new Error(
      "Feedback ablation intake frozen-label provenance mismatch.",
    );
  }

  if (!Array.isArray(manifest.queries) || manifest.queries.length !== 3) {
    throw new Error(
      "Feedback ablation intake manifest must contain three queries.",
    );
  }
  const manifestQueries = manifest.queries.map((rawQuery, index) => {
    const query = requireObject(rawQuery, `manifest.queries[${index}]`);
    requireOnlyKeys(
      query,
      ["queryId", "startupId", "fundingRoundId", "candidatePoolSha256"],
      `manifest.queries[${index}]`,
    );
    return {
      queryId: requireString(
        query.queryId,
        `manifest.queries[${index}].queryId`,
      ),
      startupId: requireString(
        query.startupId,
        `manifest.queries[${index}].startupId`,
      ),
      fundingRoundId: requireString(
        query.fundingRoundId,
        `manifest.queries[${index}].fundingRoundId`,
      ),
      candidatePoolSha256: requireSha256(
        query.candidatePoolSha256,
        `manifest.queries[${index}].candidatePoolSha256`,
      ),
    };
  });
  if (
    !arraysEqual(
      manifestQueries.map(({ queryId, startupId, fundingRoundId }) => ({
        queryId,
        startupId,
        fundingRoundId,
      })),
      queryIdentities,
    )
  ) {
    throw new Error(
      "Feedback ablation intake CSV and manifest query identities differ.",
    );
  }
  if (
    !arraysEqual(
      manifestQueries,
      sourceBatch.files.map((file) => ({
        queryId: file.queryId,
        startupId: file.startupId,
        fundingRoundId: file.fundingRoundId,
        candidatePoolSha256: file.candidatePoolHash,
      })),
    )
  ) {
    throw new Error(
      "Feedback ablation intake candidate pools do not match the source batch.",
    );
  }

  validateFrozenInputs({
    csv: args.frozenLabelsCsv,
    csvFileName: frozenCsvFileName,
    manifestText: args.frozenManifestText,
    manifestFileName: requireString(
      frozenLabels.manifestFileName,
      "manifest.frozenLabels.manifestFileName",
    ),
    queryIdentities,
  });
  const topTenPairs = new Set(
    rows.map((row) => pairKey(row.queryId, row.investorId)),
  );
  const frozenPairs = new Set(
    frozenRows.map((row) => pairKey(row.queryId, row.investorId)),
  );
  const coveredPairCount = Array.from(topTenPairs).filter((pair) =>
    frozenPairs.has(pair),
  ).length;
  const missingPairCount = topTenPairs.size - coveredPairCount;
  const frozenLabelsComplete =
    frozenValidation.summary.incompleteQueryCount === 0;
  const expectedStatus: FeedbackAblationEvaluationStatus =
    missingPairCount > 0
      ? "requires-supplementary-blind-labelling"
      : frozenLabelsComplete
        ? "ready-for-metrics"
        : "requires-complete-frozen-labels";

  const coverage = requireObject(
    manifest.labelCoverage,
    "manifest.labelCoverage",
  );
  requireOnlyKeys(
    coverage,
    [
      "uniqueTopTenPairCount",
      "coveredPairCount",
      "missingPairCount",
      "frozenLabelsComplete",
    ],
    "manifest.labelCoverage",
  );
  if (
    requireInteger(
      coverage.uniqueTopTenPairCount,
      "manifest.labelCoverage.uniqueTopTenPairCount",
    ) !== topTenPairs.size ||
    requireInteger(
      coverage.coveredPairCount,
      "manifest.labelCoverage.coveredPairCount",
    ) !== coveredPairCount ||
    requireInteger(
      coverage.missingPairCount,
      "manifest.labelCoverage.missingPairCount",
    ) !== missingPairCount ||
    coverage.frozenLabelsComplete !== frozenLabelsComplete
  ) {
    throw new Error(
      "Feedback ablation intake label coverage does not match the inputs.",
    );
  }
  if (manifest.evaluationStatus !== expectedStatus) {
    throw new Error(
      "Feedback ablation intake evaluationStatus does not match label coverage.",
    );
  }

  return {
    batchId,
    queryIds: queryIdentities.map((identity) => identity.queryId),
    rowCount: rows.length,
    uniqueTopTenPairCount: topTenPairs.size,
    missingPairCount,
    evaluationStatus: expectedStatus,
  };
}

function resolvePrivateOutput(args: {
  filePath: string;
  workingDirectory: string;
  suffix: ".local.csv" | ".local.manifest.json";
}): string {
  const exportsRoot = path.resolve(args.workingDirectory, "exports");
  const resolved = path.resolve(args.workingDirectory, args.filePath);
  const relative = path.relative(exportsRoot, resolved);
  if (
    relative.length === 0 ||
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    !path.basename(resolved).endsWith(args.suffix)
  ) {
    throw new Error(
      `Feedback ablation output must stay inside exports/ and end with ${args.suffix}.`,
    );
  }
  return resolved;
}

async function assertAvailable(filePath: string) {
  try {
    await access(filePath);
    throw new Error(`Feedback ablation output already exists: ${filePath}.`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export async function writeFeedbackAblationIntakeArtifacts(args: {
  artifacts: FeedbackAblationIntakeArtifacts;
  csvPath: string;
  manifestPath: string;
  workingDirectory?: string;
}): Promise<{ csvPath: string; manifestPath: string }> {
  const workingDirectory = args.workingDirectory ?? process.cwd();
  const csvPath = resolvePrivateOutput({
    filePath: args.csvPath,
    workingDirectory,
    suffix: ".local.csv",
  });
  const manifestPath = resolvePrivateOutput({
    filePath: args.manifestPath,
    workingDirectory,
    suffix: ".local.manifest.json",
  });
  if (path.basename(csvPath) !== args.artifacts.manifest.csv.fileName) {
    throw new Error(
      "Feedback ablation CSV output name does not match the manifest.",
    );
  }
  if (sha256Text(args.artifacts.csv) !== args.artifacts.manifest.csv.sha256) {
    throw new Error(
      "Feedback ablation CSV content does not match the manifest hash.",
    );
  }
  await Promise.all([assertAvailable(csvPath), assertAvailable(manifestPath)]);
  await Promise.all([
    mkdir(path.dirname(csvPath), { recursive: true }),
    mkdir(path.dirname(manifestPath), { recursive: true }),
  ]);

  const csvTemporaryPath = `${csvPath}.${process.pid}.${randomUUID()}.tmp`;
  const manifestTemporaryPath = `${manifestPath}.${process.pid}.${randomUUID()}.tmp`;
  let csvLinked = false;
  let manifestLinked = false;
  try {
    await Promise.all([
      writeFile(csvTemporaryPath, args.artifacts.csv, {
        encoding: "utf8",
        flag: "wx",
      }),
      writeFile(
        manifestTemporaryPath,
        `${JSON.stringify(args.artifacts.manifest, null, 2)}\n`,
        { encoding: "utf8", flag: "wx" },
      ),
    ]);
    await link(csvTemporaryPath, csvPath);
    csvLinked = true;
    await link(manifestTemporaryPath, manifestPath);
    manifestLinked = true;
  } catch (error) {
    if (csvLinked) await unlink(csvPath);
    if (manifestLinked) await unlink(manifestPath);
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error(
        "A feedback ablation output was created by another process.",
      );
    }
    throw error;
  } finally {
    await Promise.all(
      [csvTemporaryPath, manifestTemporaryPath].map(async (temporaryPath) => {
        try {
          await unlink(temporaryPath);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
      }),
    );
  }
  return { csvPath, manifestPath };
}
