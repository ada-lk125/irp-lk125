import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildFeedbackEvaluationDecision,
  FEEDBACK_EVALUATION_DECISION_SCHEMA_VERSION,
} from "../services/feedback-evaluation-decision";
import { writeFeedbackEvaluationArtifacts } from "../services/feedback-evaluation-files";
import type {
  FeedbackEvaluationReceipt,
  FeedbackEvaluationReceiptRun,
} from "../services/feedback-evaluation-receipt";

type MetricValues = FeedbackEvaluationReceiptRun["metrics"];

const control: MetricValues = {
  precisionAt5: 0.6,
  precisionAt10: 0.7,
  mrr: 0.75,
  ndcgAt10: 0.68,
};

function receipt(curatedMetrics: MetricValues): FeedbackEvaluationReceipt {
  const run = (
    feedbackMode: "none" | "curated",
    metrics: MetricValues,
  ): FeedbackEvaluationReceiptRun => ({
    feedbackMode,
    metricsFileName: `${feedbackMode}-metrics.local.json`,
    metricsSha256: feedbackMode.repeat(64).slice(0, 64),
    generatedAt: "2026-07-24T10:00:00.000Z",
    joinedInputFileName: `${feedbackMode}-joined.local.json`,
    metrics,
  });
  return {
    schemaVersion: "feedback-evaluation-receipt-v1",
    createdAt: "2026-07-24T10:30:00.000Z",
    batch: {
      batchId: "feedback-batch-check",
      manifestFileName: "feedback-batch.local.manifest.json",
      manifestSha256: "a".repeat(64),
      matchingConfigHash: "b".repeat(64),
      feedbackSetHash: "c".repeat(64),
    },
    queryIds: ["query-1", "query-2", "query-3"],
    runs: [run("none", control), run("curated", curatedMetrics)] as [
      FeedbackEvaluationReceiptRun<"none">,
      FeedbackEvaluationReceiptRun<"curated">,
    ],
    decisionStatus: "ready-for-review",
  };
}

async function main() {
  const improved = buildFeedbackEvaluationDecision(receipt({
    precisionAt5: 0.65,
    precisionAt10: 0.7,
    mrr: 0.8,
    ndcgAt10: 0.71,
  }));
  assert.equal(
    improved.schemaVersion,
    FEEDBACK_EVALUATION_DECISION_SCHEMA_VERSION,
  );
  assert.equal(improved.evidencePattern, "consistent-improvement");
  assert.equal(improved.recommendation, "review-curated-candidate");
  assert.equal(improved.reviewStatus, "requires-error-review");
  assert.deepEqual(
    improved.metricDeltas.map(({ delta }) => delta),
    [0.05, 0, 0.05, 0.03],
  );

  const mixed = buildFeedbackEvaluationDecision(receipt({
    precisionAt5: 0.65,
    precisionAt10: 0.65,
    mrr: 0.75,
    ndcgAt10: 0.7,
  }));
  assert.equal(mixed.evidencePattern, "mixed");
  assert.equal(mixed.recommendation, "keep-control");

  const unchanged = buildFeedbackEvaluationDecision(receipt(control));
  assert.equal(unchanged.evidencePattern, "no-measured-change");
  assert.equal(unchanged.recommendation, "keep-control");

  const regressed = buildFeedbackEvaluationDecision(receipt({
    precisionAt5: 0.55,
    precisionAt10: 0.7,
    mrr: 0.7,
    ndcgAt10: 0.65,
  }));
  assert.equal(regressed.evidencePattern, "consistent-regression");
  assert.equal(regressed.recommendation, "keep-control");

  const wrongOrder = receipt(control);
  wrongOrder.runs.reverse();
  assert.throws(
    () => buildFeedbackEvaluationDecision(wrongOrder),
    /must contain none, then curated/,
  );

  const unavailable = receipt(control);
  unavailable.decisionStatus = "waiting" as "ready-for-review";
  assert.throws(
    () => buildFeedbackEvaluationDecision(unavailable),
    /not ready for review/,
  );

  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "feedback-evaluation-"));
  try {
    const artifactReceipt = receipt({
      precisionAt5: 0.65,
      precisionAt10: 0.7,
      mrr: 0.8,
      ndcgAt10: 0.71,
    });
    const artifactDecision = buildFeedbackEvaluationDecision(artifactReceipt);
    const written = await writeFeedbackEvaluationArtifacts({
      receipt: artifactReceipt,
      decision: artifactDecision,
      receiptPath: "exports/feedback-check.local.receipt.json",
      decisionPath: "exports/feedback-check.local.decision.json",
      workingDirectory: temporaryRoot,
    });
    const savedDecision = JSON.parse(await readFile(written.decisionPath, "utf8"));
    assert.equal(savedDecision.evidencePattern, "consistent-improvement");
    await assert.rejects(
      () => writeFeedbackEvaluationArtifacts({
        receipt: artifactReceipt,
        decision: artifactDecision,
        receiptPath: "exports/feedback-check.local.receipt.json",
        decisionPath: "exports/feedback-check.local.decision.json",
        workingDirectory: temporaryRoot,
      }),
      /already exists/,
    );
    await assert.rejects(
      () => writeFeedbackEvaluationArtifacts({
        receipt: artifactReceipt,
        decision: artifactDecision,
        receiptPath: "outside.local.receipt.json",
        decisionPath: "exports/other.local.decision.json",
        workingDirectory: temporaryRoot,
      }),
      /must stay inside exports/,
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }

  console.log("Feedback evaluation decision check passed.");
  console.log("Checked improved, mixed, unchanged, and regressed metric patterns.");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
