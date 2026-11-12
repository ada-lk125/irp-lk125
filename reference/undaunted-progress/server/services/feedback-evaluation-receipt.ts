import { createHash } from "node:crypto";
import path from "node:path";
import {
  validateFeedbackComparisonBatchManifest,
  type FeedbackComparisonBatchManifest,
} from "./feedback-comparison-batch-manifest";

export const FROZEN_RANKING_METRICS_SCHEMA_VERSION =
  "frozen-ranking-metrics-v1";
export const FEEDBACK_EVALUATION_RECEIPT_SCHEMA_VERSION =
  "feedback-evaluation-receipt-v1";

export type FeedbackEvaluationMode = "none" | "curated";

export interface FeedbackEvaluationQueryIdentity {
  queryId: string;
  startupId: string;
  fundingRoundId: string;
}

const REQUIRED_METRIC_FIELDS = [
  "precisionAt5",
  "precisionAt10",
  "mrr",
  "ndcgAt10",
] as const;

const REQUIRED_SUMMARY_FIELDS = [
  "macroPrecisionAt5",
  "macroPrecisionAt10",
  "macroMrr",
  "macroNdcgAt10",
] as const;

export interface FeedbackEvaluationMetricSummary {
  generatedAt: string;
  inputFileName: string;
  queryIds: string[];
  metrics: {
    precisionAt5: number;
    precisionAt10: number;
    mrr: number;
    ndcgAt10: number;
  };
  perQuery: Array<{
    queryId: string;
    startupId: string;
    fundingRoundId: string;
    metrics: {
      precisionAt5: number;
      precisionAt10: number;
      mrr: number;
      ndcgAt10: number;
    };
  }>;
}

export interface FeedbackEvaluationReceipt {
  schemaVersion: typeof FEEDBACK_EVALUATION_RECEIPT_SCHEMA_VERSION;
  createdAt: string;
  batch: {
    batchId: string;
    manifestFileName: string;
    manifestSha256: string;
    matchingConfigHash: string;
    feedbackSetHash: string;
  };
  queryIds: string[];
  runs: [
    FeedbackEvaluationReceiptRun<"none">,
    FeedbackEvaluationReceiptRun<"curated">,
  ];
  decisionStatus: "ready-for-review";
}

export interface FeedbackEvaluationReceiptRun<
  Mode extends FeedbackEvaluationMode = FeedbackEvaluationMode,
> {
  feedbackMode: Mode;
  metricsFileName: string;
  metricsSha256: string;
  generatedAt: string;
  joinedInputFileName: string;
  metrics: FeedbackEvaluationMetricSummary["metrics"];
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value.trim();
}

function requireFileText(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must contain text.`);
  }
  return value;
}

function requirePrivateJsonFileName(value: unknown, label: string): string {
  const fileName = requireString(value, label);
  if (fileName !== path.basename(fileName) || !fileName.endsWith(".local.json")) {
    throw new Error(`${label} must be a private .local.json file name.`);
  }
  return fileName;
}

function sha256(contents: string): string {
  return createHash("sha256").update(contents, "utf8").digest("hex");
}

function parseJson(contents: string, label: string): unknown {
  try {
    return JSON.parse(contents) as unknown;
  } catch {
    throw new Error(`${label} must contain valid JSON.`);
  }
}

function normaliseTimestamp(value?: string): string {
  const timestamp = value ? new Date(value) : new Date();
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error("createdAt must be a valid date or ISO timestamp.");
  }
  return timestamp.toISOString();
}

function requireMetric(value: unknown, label: string): number {
  if (
    typeof value !== "number"
    || !Number.isFinite(value)
    || value < 0
    || value > 1
  ) {
    throw new Error(`${label} must be a number from 0 to 1.`);
  }
  return value;
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function requireCount(value: unknown, expected: number, label: string): number {
  if (!Number.isInteger(value) || value !== expected) {
    throw new Error(`${label} must be ${expected}.`);
  }
  return Number(value);
}

function requireCountMap(value: unknown, label: string): Record<string, number> {
  const counts = requireObject(value, label);
  const parsed: Record<string, number> = {};
  Object.entries(counts).forEach(([name, count]) => {
    if (!Number.isInteger(count) || Number(count) < 0) {
      throw new Error(`${label}.${name} must be a non-negative integer.`);
    }
    parsed[name] = Number(count);
  });
  if (Object.values(parsed).reduce((total, count) => total + count, 0) !== 30) {
    throw new Error(`${label} must account for all 30 judged pairs.`);
  }
  return parsed;
}

function requireExactNumberArray(
  value: unknown,
  expected: readonly number[],
  label: string,
) {
  if (
    !Array.isArray(value)
    || value.length !== expected.length
    || value.some((entry, index) => entry !== expected[index])
  ) {
    throw new Error(`${label} must be [${expected.join(", ")}].`);
  }
}

export function validateFrozenRankingMetricsForFeedback(args: {
  rawMetrics: unknown;
  expectedQueryIds: readonly string[];
  expectedQueryIdentities?: readonly FeedbackEvaluationQueryIdentity[];
}): FeedbackEvaluationMetricSummary {
  if (args.expectedQueryIds.length !== 3 || new Set(args.expectedQueryIds).size !== 3) {
    throw new Error("The feedback evaluation must expect three unique query IDs.");
  }

  const metrics = requireObject(args.rawMetrics, "frozen ranking metrics");
  if (metrics.schemaVersion !== FROZEN_RANKING_METRICS_SCHEMA_VERSION) {
    throw new Error(
      `frozen ranking metrics.schemaVersion must be ${FROZEN_RANKING_METRICS_SCHEMA_VERSION}.`,
    );
  }
  const generatedAt = requireString(metrics.generatedAt, "frozen ranking metrics.generatedAt");
  if (Number.isNaN(new Date(generatedAt).getTime())) {
    throw new Error("frozen ranking metrics.generatedAt must be a valid timestamp.");
  }
  const inputFileName = requireString(
    metrics.inputFileName,
    "frozen ranking metrics.inputFileName",
  );
  if (
    inputFileName !== path.basename(inputFileName)
    || !inputFileName.endsWith(".local.json")
  ) {
    throw new Error(
      "frozen ranking metrics.inputFileName must be a private .local.json file name.",
    );
  }

  const definition = requireObject(
    metrics.metricDefinition,
    "frozen ranking metrics.metricDefinition",
  );
  requireExactNumberArray(
    definition.binaryRelevantValues,
    [1, 2],
    "metricDefinition.binaryRelevantValues",
  );
  if (definition.ndcgGain !== "2^relevanceValue - 1") {
    throw new Error("metricDefinition.ndcgGain does not match the agreed rule.");
  }
  requireExactNumberArray(definition.cutoffs, [5, 10], "metricDefinition.cutoffs");
  if (definition.aggregation !== "macro mean across complete queries") {
    throw new Error("metricDefinition.aggregation does not match the agreed rule.");
  }

  const summary = requireObject(metrics.summary, "frozen ranking metrics.summary");
  requireCount(summary.queryCount, 3, "summary.queryCount");
  requireCount(summary.judgedPairs, 30, "summary.judgedPairs");
  requireCountMap(summary.labelCounts, "summary.labelCounts");
  requireCountMap(summary.errorCategoryCounts, "summary.errorCategoryCounts");
  const summaryValues = REQUIRED_SUMMARY_FIELDS.map(field =>
    requireMetric(summary[field], `summary.${field}`)
  );

  if (!Array.isArray(metrics.perQuery) || metrics.perQuery.length !== 3) {
    throw new Error("frozen ranking metrics.perQuery must contain three results.");
  }
  const perQuery = metrics.perQuery.map((rawQuery, index) => {
    const query = requireObject(rawQuery, `perQuery[${index}]`);
    const queryId = requireString(query.queryId, `perQuery[${index}].queryId`);
    const startupId = requireString(query.startupId, `perQuery[${index}].startupId`);
    const fundingRoundId = requireString(
      query.fundingRoundId,
      `perQuery[${index}].fundingRoundId`,
    );
    requireCount(query.judgedPairs, 10, `perQuery[${index}].judgedPairs`);
    const metricValues = REQUIRED_METRIC_FIELDS.map(field =>
      requireMetric(query[field], `perQuery[${index}].${field}`)
    );
    return {
      queryId,
      startupId,
      fundingRoundId,
      metricValues,
      metrics: {
        precisionAt5: metricValues[0],
        precisionAt10: metricValues[1],
        mrr: metricValues[2],
        ndcgAt10: metricValues[3],
      },
    };
  });
  const queryIds = perQuery.map(({ queryId }) => queryId);
  if (new Set(queryIds).size !== 3) {
    throw new Error("frozen ranking metrics.perQuery contains duplicate query IDs.");
  }
  const expected = [...args.expectedQueryIds].sort();
  const received = [...queryIds].sort();
  if (JSON.stringify(received) !== JSON.stringify(expected)) {
    throw new Error("frozen ranking metrics query IDs do not match the feedback batch.");
  }
  if (args.expectedQueryIdentities) {
    if (
      args.expectedQueryIdentities.length !== 3
      || new Set(args.expectedQueryIdentities.map(({ queryId }) => queryId)).size !== 3
    ) {
      throw new Error("The feedback batch must provide three unique query identities.");
    }
    const expectedByQueryId = new Map(
      args.expectedQueryIdentities.map(identity => [identity.queryId, identity]),
    );
    perQuery.forEach(({ queryId, startupId, fundingRoundId }) => {
      const identity = expectedByQueryId.get(queryId);
      if (
        !identity
        || identity.startupId !== startupId
        || identity.fundingRoundId !== fundingRoundId
      ) {
        throw new Error(
          `frozen ranking metrics query ${queryId} does not match its startup and funding round.`,
        );
      }
    });
  }
  REQUIRED_SUMMARY_FIELDS.forEach((field, metricIndex) => {
    const mean = round(
      perQuery.reduce(
        (total, query) => total + query.metricValues[metricIndex],
        0,
      ) / perQuery.length,
    );
    if (summaryValues[metricIndex] !== mean) {
      throw new Error(`summary.${field} does not match the per-query macro mean.`);
    }
  });

  return {
    generatedAt: new Date(generatedAt).toISOString(),
    inputFileName,
    queryIds: received,
    metrics: {
      precisionAt5: summaryValues[0],
      precisionAt10: summaryValues[1],
      mrr: summaryValues[2],
      ndcgAt10: summaryValues[3],
    },
    perQuery: perQuery.map(
      ({ queryId, startupId, fundingRoundId, metrics: queryMetrics }) => ({
        queryId,
        startupId,
        fundingRoundId,
        metrics: queryMetrics,
      }),
    ),
  };
}

export function buildFeedbackEvaluationReceipt(args: {
  batchManifestFileName: string;
  batchManifestText: string;
  metrics: {
    none: { fileName: string; text: string };
    curated: { fileName: string; text: string };
  };
  createdAt?: string;
}): FeedbackEvaluationReceipt {
  const manifestFileName = requireString(
    args.batchManifestFileName,
    "batchManifestFileName",
  );
  if (
    manifestFileName !== path.basename(manifestFileName)
    || !manifestFileName.endsWith(".local.manifest.json")
  ) {
    throw new Error(
      "batchManifestFileName must be a private .local.manifest.json file name.",
    );
  }
  const batchManifestText = requireFileText(
    args.batchManifestText,
    "batchManifestText",
  );
  const rawBatchManifest = parseJson(
    batchManifestText,
    "batchManifestText",
  ) as FeedbackComparisonBatchManifest;
  const batch = validateFeedbackComparisonBatchManifest(rawBatchManifest);

  const modes: FeedbackEvaluationMode[] = ["none", "curated"];
  const metricFileNames = modes.map(mode =>
    requirePrivateJsonFileName(args.metrics[mode].fileName, `${mode}.fileName`)
  );
  if (new Set(metricFileNames).size !== metricFileNames.length) {
    throw new Error("The control and curated metrics must use different file names.");
  }

  const runs = modes.map((feedbackMode, index) => {
    const metricText = requireFileText(
      args.metrics[feedbackMode].text,
      `${feedbackMode}.text`,
    );
    const summary = validateFrozenRankingMetricsForFeedback({
      rawMetrics: parseJson(metricText, `${feedbackMode}.text`),
      expectedQueryIds: batch.queryIds,
      expectedQueryIdentities: rawBatchManifest.files.map(
        ({ queryId, startupId, fundingRoundId }) => ({
          queryId,
          startupId,
          fundingRoundId,
        }),
      ),
    });
    return {
      feedbackMode,
      metricsFileName: metricFileNames[index],
      metricsSha256: sha256(metricText),
      generatedAt: summary.generatedAt,
      joinedInputFileName: summary.inputFileName,
      metrics: summary.metrics,
    };
  }) as FeedbackEvaluationReceipt["runs"];
  if (runs[0].joinedInputFileName === runs[1].joinedInputFileName) {
    throw new Error("The control and curated metrics must use different joined inputs.");
  }

  return {
    schemaVersion: FEEDBACK_EVALUATION_RECEIPT_SCHEMA_VERSION,
    createdAt: normaliseTimestamp(args.createdAt),
    batch: {
      batchId: batch.batchId,
      manifestFileName,
      manifestSha256: sha256(batchManifestText),
      matchingConfigHash: batch.matchingConfigHash,
      feedbackSetHash: batch.feedbackSetHash,
    },
    queryIds: [...batch.queryIds].sort(),
    runs,
    decisionStatus: "ready-for-review",
  };
}

export function serialiseFeedbackEvaluationReceipt(
  receipt: FeedbackEvaluationReceipt,
): string {
  return `${JSON.stringify(receipt, null, 2)}\n`;
}
