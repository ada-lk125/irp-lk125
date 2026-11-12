import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { FEEDBACK_COMPARISON_BATCH_MANIFEST_SCHEMA_VERSION } from "../services/feedback-comparison-batch-manifest";
import {
  buildFeedbackEvaluationReceipt,
  FEEDBACK_EVALUATION_RECEIPT_SCHEMA_VERSION,
  FROZEN_RANKING_METRICS_SCHEMA_VERSION,
  serialiseFeedbackEvaluationReceipt,
  validateFrozenRankingMetricsForFeedback,
} from "../services/feedback-evaluation-receipt";

const queryIds = ["query-1", "query-2", "query-3"];

function hash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function metricsFixture(mode: "none" | "curated" = "none") {
  const curated = mode === "curated";
  return {
    schemaVersion: FROZEN_RANKING_METRICS_SCHEMA_VERSION,
    generatedAt: "2026-07-24T09:00:00.000Z",
    inputFileName: `feedback-${mode}-joined.local.json`,
    metricDefinition: {
      binaryRelevantValues: [1, 2],
      ndcgGain: "2^relevanceValue - 1",
      cutoffs: [5, 10],
      aggregation: "macro mean across complete queries",
    },
    summary: {
      queryCount: 3,
      judgedPairs: 30,
      labelCounts: { strong_fit: 9, possible_fit: 12, weak_fit: 9 },
      errorCategoryCounts: { blank: 24, stage: 3, ticket: 3 },
      macroPrecisionAt5: curated ? 0.8 : 0.7333,
      macroPrecisionAt10: curated ? 0.7333 : 0.7,
      macroMrr: 1,
      macroNdcgAt10: curated ? 0.8421 : 0.8123,
    },
    perQuery: queryIds.map((queryId, index) => ({
      queryId,
      startupId: `startup-${index + 1}`,
      fundingRoundId: `round-${index + 1}`,
      judgedPairs: 10,
      labelCounts: { strong_fit: 3, possible_fit: 4, weak_fit: 3 },
      errorCategoryCounts: { blank: 8, stage: 1, ticket: 1 },
      precisionAt5: curated ? 0.8 : [0.7, 0.7, 0.8][index],
      precisionAt10: curated ? [0.7, 0.7, 0.8][index] : 0.7,
      mrr: 1,
      ndcgAt10: curated ? 0.8421 : 0.8123,
    })),
  };
}

function batchManifestFixture() {
  return {
    schemaVersion: FEEDBACK_COMPARISON_BATCH_MANIFEST_SCHEMA_VERSION,
    batchId: "feedback-batch-2026-07-23",
    createdAt: "2026-07-23T10:00:00.000Z",
    experiment: {
      semanticMethod: "gpt-semantic",
      topK: 10,
      queryCount: 3,
      matchingConfigHash: hash("fixed-matching-config"),
      feedbackSetVersion: "curated-feedback-2026-07-23",
      feedbackSetHash: hash("fixed-feedback-set"),
    },
    files: queryIds.map((queryId, index) => ({
      queryId,
      startupId: `startup-${index + 1}`,
      fundingRoundId: `round-${index + 1}`,
      candidateCount: 12,
      candidatePoolHash: hash(`candidate-pool-${index + 1}`),
      fileName: `feedback-query-${index + 1}.local.json`,
      sha256: hash(`feedback-output-${index + 1}`),
      runMatchCounts: { none: 10, curated: 10 },
    })),
    evaluationStatus: "requires-frozen-labels",
  };
}

function receiptFixture() {
  const batchManifestText = `${JSON.stringify(batchManifestFixture(), null, 2)}\n`;
  const noneText = `${JSON.stringify(metricsFixture("none"), null, 2)}\n`;
  const curatedText = `${JSON.stringify(metricsFixture("curated"), null, 2)}\n`;
  return {
    receipt: buildFeedbackEvaluationReceipt({
      batchManifestFileName: "feedback-batch.local.manifest.json",
      batchManifestText,
      metrics: {
        none: { fileName: "feedback-none-metrics.local.json", text: noneText },
        curated: {
          fileName: "feedback-curated-metrics.local.json",
          text: curatedText,
        },
      },
      createdAt: "2026-07-24T10:00:00.000Z",
    }),
    batchManifestText,
    noneText,
    curatedText,
  };
}

function validate(rawMetrics: unknown, expectedQueryIds = queryIds) {
  return validateFrozenRankingMetricsForFeedback({
    rawMetrics,
    expectedQueryIds,
    expectedQueryIdentities: queryIds.map((queryId, index) => ({
      queryId,
      startupId: `startup-${index + 1}`,
      fundingRoundId: `round-${index + 1}`,
    })),
  });
}

function main() {
  const summary = validate(metricsFixture());
  assert.deepEqual(summary.queryIds, queryIds);
  assert.deepEqual(summary.metrics, {
    precisionAt5: 0.7333,
    precisionAt10: 0.7,
    mrr: 1,
    ndcgAt10: 0.8123,
  });

  const incomplete = metricsFixture();
  incomplete.summary.judgedPairs = 29;
  assert.throws(() => validate(incomplete), /summary.judgedPairs must be 30/);

  const repeatedQuery = metricsFixture();
  repeatedQuery.perQuery[2].queryId = "query-2";
  assert.throws(() => validate(repeatedQuery), /duplicate query IDs/);

  const wrongQuery = metricsFixture();
  wrongQuery.perQuery[2].queryId = "query-4";
  assert.throws(() => validate(wrongQuery), /do not match the feedback batch/);

  const wrongGain = metricsFixture();
  wrongGain.metricDefinition.ndcgGain = "relevanceValue";
  assert.throws(() => validate(wrongGain), /does not match the agreed rule/);

  const invalidMetric = metricsFixture();
  invalidMetric.summary.macroNdcgAt10 = 1.2;
  assert.throws(() => validate(invalidMetric), /must be a number from 0 to 1/);

  const missingCounts = metricsFixture();
  missingCounts.summary.labelCounts.weak_fit = 8;
  assert.throws(() => validate(missingCounts), /must account for all 30 judged pairs/);

  const wrongIdentity = metricsFixture();
  wrongIdentity.perQuery[1].fundingRoundId = "different-round";
  assert.throws(() => validate(wrongIdentity), /does not match its startup and funding round/);

  const wrongMacroMean = metricsFixture();
  wrongMacroMean.summary.macroPrecisionAt5 = 0.8;
  assert.throws(() => validate(wrongMacroMean), /does not match the per-query macro mean/);

  assert.throws(
    () => validate(metricsFixture(), ["query-1", "query-1", "query-3"]),
    /three unique query IDs/,
  );

  const { receipt, batchManifestText, noneText, curatedText } = receiptFixture();
  assert.equal(receipt.schemaVersion, FEEDBACK_EVALUATION_RECEIPT_SCHEMA_VERSION);
  assert.equal(receipt.batch.batchId, "feedback-batch-2026-07-23");
  assert.equal(receipt.batch.manifestSha256, hash(batchManifestText));
  assert.deepEqual(receipt.runs.map(({ feedbackMode }) => feedbackMode), [
    "none",
    "curated",
  ]);
  assert.equal(receipt.runs[0].metricsSha256, hash(noneText));
  assert.equal(receipt.runs[1].metricsSha256, hash(curatedText));
  assert.equal(receipt.runs[1].metrics.precisionAt5, 0.8);
  assert.equal(receipt.decisionStatus, "ready-for-review");
  assert.doesNotMatch(
    serialiseFeedbackEvaluationReceipt(receipt),
    /strong_fit|possible_fit|weak_fit|judgement_note/,
  );

  assert.throws(
    () => buildFeedbackEvaluationReceipt({
      batchManifestFileName: "feedback-batch.local.manifest.json",
      batchManifestText,
      metrics: {
        none: { fileName: "same.local.json", text: noneText },
        curated: { fileName: "same.local.json", text: curatedText },
      },
    }),
    /must use different file names/,
  );
  const wrongQueries = metricsFixture("curated");
  wrongQueries.perQuery[2].queryId = "query-4";
  assert.throws(
    () => buildFeedbackEvaluationReceipt({
      batchManifestFileName: "feedback-batch.local.manifest.json",
      batchManifestText,
      metrics: {
        none: { fileName: "none.local.json", text: noneText },
        curated: {
          fileName: "curated.local.json",
          text: JSON.stringify(wrongQueries),
        },
      },
    }),
    /do not match the feedback batch/,
  );
  const repeatedInput = metricsFixture("curated");
  repeatedInput.inputFileName = "feedback-none-joined.local.json";
  assert.throws(
    () => buildFeedbackEvaluationReceipt({
      batchManifestFileName: "feedback-batch.local.manifest.json",
      batchManifestText,
      metrics: {
        none: { fileName: "none.local.json", text: noneText },
        curated: {
          fileName: "curated.local.json",
          text: JSON.stringify(repeatedInput),
        },
      },
    }),
    /must use different joined inputs/,
  );

  console.log("Feedback evaluation receipt check passed.");
  console.log("Checked Chuan's metric contract, batch identity, and both file hashes.");
}

main();
