import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildFeedbackEvaluationDecision } from "../services/feedback-evaluation-decision";
import type {
  FeedbackEvaluationMetricSummary,
  FeedbackEvaluationReceipt,
} from "../services/feedback-evaluation-receipt";
import {
  buildFeedbackEvaluationVisualisation,
  writeFeedbackEvaluationVisualisation,
} from "../services/feedback-evaluation-visualisation";

const hash = (character: string) => character.repeat(64);
const commitSha = "1".repeat(40);
const queryIds = ["query-alpha", "query-beta", "query-gamma"];

const receipt: FeedbackEvaluationReceipt = {
  schemaVersion: "feedback-evaluation-receipt-v1",
  createdAt: "2026-07-27T09:00:00.000Z",
  batch: {
    batchId: "feedback-ablation-fictional",
    manifestFileName: "feedback-fictional.local.manifest.json",
    manifestSha256: hash("a"),
    matchingConfigHash: hash("b"),
    feedbackSetHash: hash("c"),
  },
  queryIds,
  runs: [
    {
      feedbackMode: "none",
      metricsFileName: "feedback-none-fictional.local.json",
      metricsSha256: hash("d"),
      generatedAt: "2026-07-27T08:00:00.000Z",
      joinedInputFileName: "joined-none-fictional.local.json",
      metrics: {
        precisionAt5: 0.4,
        precisionAt10: 0.5,
        mrr: 0.45,
        ndcgAt10: 0.48,
      },
    },
    {
      feedbackMode: "curated",
      metricsFileName: "feedback-curated-fictional.local.json",
      metricsSha256: hash("e"),
      generatedAt: "2026-07-27T08:30:00.000Z",
      joinedInputFileName: "joined-curated-fictional.local.json",
      metrics: {
        precisionAt5: 0.5,
        precisionAt10: 0.55,
        mrr: 0.52,
        ndcgAt10: 0.56,
      },
    },
  ],
  decisionStatus: "ready-for-review",
};

function perQuery(
  values: Array<[number, number, number, number]>,
): FeedbackEvaluationMetricSummary["perQuery"] {
  return queryIds.map((queryId, index) => ({
    queryId,
    startupId: `startup-private-${index + 1}`,
    fundingRoundId: `round-private-${index + 1}`,
    metrics: {
      precisionAt5: values[index][0],
      precisionAt10: values[index][1],
      mrr: values[index][2],
      ndcgAt10: values[index][3],
    },
  }));
}

async function main() {
  const decision = buildFeedbackEvaluationDecision(receipt);
  const visualisation = buildFeedbackEvaluationVisualisation({
    receipt,
    decision,
    perQuery: {
      none: perQuery([
        [0.4, 0.5, 0.4, 0.45],
        [0.4, 0.5, 0.45, 0.48],
        [0.4, 0.5, 0.5, 0.51],
      ]),
      curated: perQuery([
        [0.6, 0.6, 0.55, 0.58],
        [0.4, 0.5, 0.46, 0.5],
        [0.5, 0.55, 0.55, 0.6],
      ]),
    },
    aiModel: "gpt-4o-mini",
    implementationCommitSha: commitSha,
    svgFileName: "feedback-evaluation-fictional.local.svg",
  });

  assert.match(visualisation.svg, /Feedback ablation evaluation/);
  assert.match(visualisation.svg, /Precision@5/);
  assert.match(visualisation.svg, /NDCG@10/);
  assert.match(visualisation.svg, /Q1/);
  assert.match(visualisation.svg, /\+0\.100/);
  assert.match(visualisation.svg, /Model: gpt-4o-mini/);
  assert.doesNotMatch(visualisation.svg, /query-alpha/);
  assert.doesNotMatch(visualisation.svg, /startup-private/);
  assert.doesNotMatch(visualisation.svg, /round-private/);
  assert.equal(visualisation.manifest.svg.sha256.length, 64);
  assert.equal(visualisation.manifest.matchingConfigHash, hash("b"));
  assert.equal(visualisation.manifest.implementationCommitSha, commitSha);

  const temporaryRoot = await mkdtemp(
    path.join(tmpdir(), "feedback-visualisation-check-"),
  );
  try {
    const svgPath = "exports/feedback-evaluation-fictional.local.svg";
    const manifestPath =
      "exports/feedback-evaluation-fictional.local.visualisation.json";
    const written = await writeFeedbackEvaluationVisualisation({
      visualisation,
      svgPath,
      manifestPath,
      workingDirectory: temporaryRoot,
    });
    const [writtenSvg, writtenManifest] = await Promise.all([
      readFile(written.svgPath, "utf8"),
      readFile(written.manifestPath, "utf8"),
    ]);
    assert.equal(writtenSvg, visualisation.svg);
    assert.deepEqual(JSON.parse(writtenManifest), visualisation.manifest);
    await assert.rejects(
      writeFeedbackEvaluationVisualisation({
        visualisation,
        svgPath,
        manifestPath,
        workingDirectory: temporaryRoot,
      }),
      /already exists/,
    );
    await assert.rejects(
      writeFeedbackEvaluationVisualisation({
        visualisation,
        svgPath: "../escaped.local.svg",
        manifestPath,
        workingDirectory: temporaryRoot,
      }),
      /must stay inside exports/,
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }

  assert.throws(
    () =>
      buildFeedbackEvaluationVisualisation({
        receipt,
        decision,
        perQuery: {
          none: perQuery([
            [0.4, 0.5, 0.4, 0.45],
            [0.4, 0.5, 0.45, 0.48],
            [0.4, 0.5, 0.5, 0.51],
          ]).slice(0, 2),
          curated: perQuery([
            [0.6, 0.6, 0.55, 0.58],
            [0.4, 0.5, 0.46, 0.5],
            [0.5, 0.55, 0.55, 0.6],
          ]),
        },
        aiModel: "gpt-4o-mini",
        implementationCommitSha: commitSha,
        svgFileName: "feedback-evaluation-fictional.local.svg",
      }),
    /does not match the receipt query set/,
  );

  console.log("Feedback evaluation visualisation check passed.");
  console.log("Checked metric bars, anonymised query deltas, hashes and output guards.");
}

main().catch(error => {
  console.error(
    `Feedback evaluation visualisation check failed: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exitCode = 1;
});
