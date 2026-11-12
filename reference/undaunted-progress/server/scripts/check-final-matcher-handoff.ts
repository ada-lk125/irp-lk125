import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildFeedbackEvaluationDecision } from "../services/feedback-evaluation-decision";
import type { FeedbackEvaluationReceipt } from "../services/feedback-evaluation-receipt";
import type { FeedbackEvaluationVisualisationManifest } from "../services/feedback-evaluation-visualisation";
import {
  buildFinalMatcherHandoff,
  hashFinalMatcherSource,
  writeFinalMatcherHandoff,
  type FinalMatcherHandoffSource,
} from "../services/final-matcher-handoff";

const hash = (character: string) => character.repeat(64);
const implementationCommitSha = "1".repeat(40);

function receipt(curatedMrr = 0.55): FeedbackEvaluationReceipt {
  return {
    schemaVersion: "feedback-evaluation-receipt-v1",
    createdAt: "2026-07-28T08:00:00.000Z",
    batch: {
      batchId: "fictional-feedback-batch",
      manifestFileName: "batch.local.manifest.json",
      manifestSha256: hash("a"),
      matchingConfigHash: hash("b"),
      feedbackSetHash: hash("c"),
    },
    queryIds: ["query-one", "query-two", "query-three"],
    runs: [
      {
        feedbackMode: "none",
        metricsFileName: "none.local.json",
        metricsSha256: hash("d"),
        generatedAt: "2026-07-28T07:00:00.000Z",
        joinedInputFileName: "none-input.local.json",
        metrics: {
          precisionAt5: 0.4,
          precisionAt10: 0.5,
          mrr: 0.5,
          ndcgAt10: 0.5,
        },
      },
      {
        feedbackMode: "curated",
        metricsFileName: "curated.local.json",
        metricsSha256: hash("e"),
        generatedAt: "2026-07-28T07:30:00.000Z",
        joinedInputFileName: "curated-input.local.json",
        metrics: {
          precisionAt5: 0.5,
          precisionAt10: 0.6,
          mrr: curatedMrr,
          ndcgAt10: 0.6,
        },
      },
    ],
    decisionStatus: "ready-for-review",
  };
}

function visualisation(
  evaluationReceipt: FeedbackEvaluationReceipt,
): FeedbackEvaluationVisualisationManifest {
  const decision = buildFeedbackEvaluationDecision(evaluationReceipt);
  return {
    schemaVersion: "feedback-evaluation-visualisation-v1",
    batchId: evaluationReceipt.batch.batchId,
    aiModel: "gpt-4o-mini",
    matchingConfigHash: evaluationReceipt.batch.matchingConfigHash,
    implementationCommitSha,
    metricFiles: {
      none: {
        fileName: evaluationReceipt.runs[0].metricsFileName,
        sha256: evaluationReceipt.runs[0].metricsSha256,
      },
      curated: {
        fileName: evaluationReceipt.runs[1].metricsFileName,
        sha256: evaluationReceipt.runs[1].metricsSha256,
      },
    },
    decision: {
      evidencePattern: decision.evidencePattern,
      recommendation: decision.recommendation,
      reviewStatus: decision.reviewStatus,
    },
    svg: {
      fileName: "feedback-evaluation.local.svg",
      sha256: hash("f"),
    },
  };
}

const sources: Record<
  "receipt" | "decision" | "visualisation" | "errorReview",
  FinalMatcherHandoffSource
> = {
  receipt: {
    fileName: "feedback.local.receipt.json",
    sha256: hash("1"),
  },
  decision: {
    fileName: "feedback.local.decision.json",
    sha256: hash("2"),
  },
  visualisation: {
    fileName: "feedback.local.visualisation.json",
    sha256: hash("3"),
  },
  errorReview: {
    fileName: "feedback.local.error-review.json",
    sha256: hash("4"),
  },
};

async function main() {
  const improvedReceipt = receipt();
  const improvedDecision =
    buildFeedbackEvaluationDecision(improvedReceipt);
  const curatedHandoff = buildFinalMatcherHandoff({
    receipt: improvedReceipt,
    decision: improvedDecision,
    visualisation: visualisation(improvedReceipt),
    selectedMethod: "curated_feedback",
    reviewOutcome: "approve-curated",
    sources,
    createdAt: "2026-07-28T09:00:00.000Z",
  });
  assert.equal(curatedHandoff.selectedMethod, "curated_feedback");
  assert.equal(curatedHandoff.aiModel, "gpt-4o-mini");
  assert.equal(curatedHandoff.feedbackSetHash, hash("c"));
  assert.equal(curatedHandoff.implementationCommitSha, implementationCommitSha);
  assert.equal(curatedHandoff.status, "ready-for-runtime-integration");
  assert.deepEqual(curatedHandoff.resultContract.scoreBreakdown, [
    "stageMatch",
    "ticketSizeMatch",
    "sectorOverlap",
    "geographyMatch",
    "instrumentMatch",
    "semanticScore",
    "totalScore",
  ]);

  const mixedReceipt = receipt(0.45);
  const mixedDecision = buildFeedbackEvaluationDecision(mixedReceipt);
  assert.equal(mixedDecision.evidencePattern, "mixed");
  assert.throws(
    () =>
      buildFinalMatcherHandoff({
        receipt: mixedReceipt,
        decision: mixedDecision,
        visualisation: visualisation(mixedReceipt),
        selectedMethod: "curated_feedback",
        reviewOutcome: "approve-curated",
        sources,
      }),
    /cannot be promoted/,
  );
  const controlHandoff = buildFinalMatcherHandoff({
    receipt: mixedReceipt,
    decision: mixedDecision,
    visualisation: visualisation(mixedReceipt),
    selectedMethod: "no_feedback_gpt",
    reviewOutcome: "keep-control",
    sources,
  });
  assert.equal(controlHandoff.selectedMethod, "no_feedback_gpt");

  assert.throws(
    () =>
      buildFinalMatcherHandoff({
        receipt: improvedReceipt,
        decision: improvedDecision,
        visualisation: {
          ...visualisation(improvedReceipt),
          matchingConfigHash: hash("9"),
        },
        selectedMethod: "curated_feedback",
        reviewOutcome: "approve-curated",
        sources,
      }),
    /does not match the evaluation receipt/,
  );

  const temporaryRoot = await mkdtemp(
    path.join(tmpdir(), "final-matcher-handoff-check-"),
  );
  try {
    const outputPath = "exports/result.local.final-matcher.json";
    const writtenPath = await writeFinalMatcherHandoff({
      handoff: curatedHandoff,
      outputPath,
      workingDirectory: temporaryRoot,
    });
    assert.deepEqual(
      JSON.parse(await readFile(writtenPath, "utf8")),
      curatedHandoff,
    );
    await assert.rejects(
      writeFinalMatcherHandoff({
        handoff: curatedHandoff,
        outputPath,
        workingDirectory: temporaryRoot,
      }),
      /already exists/,
    );
    await assert.rejects(
      writeFinalMatcherHandoff({
        handoff: curatedHandoff,
        outputPath: "../escaped.local.final-matcher.json",
        workingDirectory: temporaryRoot,
      }),
      /must stay inside exports/,
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }

  assert.equal(hashFinalMatcherSource("private review\n").length, 64);
  assert.throws(() => hashFinalMatcherSource(" \n"), /empty/);

  console.log("Final matcher handoff check passed.");
  console.log(
    "Checked evidence binding, conservative promotion, result fields and private output guards.",
  );
}

main().catch(error => {
  console.error(
    `Final matcher handoff check failed: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exitCode = 1;
});
