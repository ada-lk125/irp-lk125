import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { FinalEvidencePageManifest } from "../services/final-evidence-page";
import {
  buildFinalDeliveryReport,
  FINAL_DELIVERY_REQUIRED_SCRIPTS,
  FINAL_DELIVERY_SOURCE_FILES,
  type FinalEvaluationEvidence,
  writeFinalDeliveryReport,
} from "../services/final-delivery-report";
import type { FinalMatcherHandoff } from "../services/final-matcher-handoff";

const createdAt = "2026-07-31T12:00:00.000Z";
const matchingConfigHash = "b".repeat(64);
const feedbackSetHash = "c".repeat(64);
const implementationCommitSha = "1".repeat(40);

function hash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function source(fileName: string, text: string) {
  return { fileName, sha256: hash(text) };
}

const implementationSources = FINAL_DELIVERY_SOURCE_FILES.map(fileName => ({
  fileName,
  text: `export const ${fileName.replaceAll(/[^a-zA-Z0-9]/g, "_")} = true;\n`,
}));

const handoff: FinalMatcherHandoff = {
  schemaVersion: "final-matcher-handoff-v1",
  createdAt,
  batchId: "fictional-final-delivery",
  selectedMethod: "curated_feedback",
  semanticMethod: "gpt-semantic",
  aiModel: "gpt-4o-mini",
  matchingConfigHash,
  feedbackSetHash,
  implementationCommitSha,
  evaluation: {
    evidencePattern: "consistent-improvement",
    recommendation: "review-curated-candidate",
    reviewOutcome: "approve-curated",
  },
  sources: {
    receipt: {
      fileName: "fictional.local.receipt.json",
      sha256: "2".repeat(64),
    },
    decision: {
      fileName: "fictional.local.decision.json",
      sha256: "3".repeat(64),
    },
    visualisation: {
      fileName: "fictional.local.visualisation.json",
      sha256: "4".repeat(64),
    },
    errorReview: {
      fileName: "fictional.local.error-review.json",
      sha256: "5".repeat(64),
    },
  },
  resultContract: {
    investor: true,
    scoreBreakdown: [
      "stageMatch",
      "ticketSizeMatch",
      "sectorOverlap",
      "geographyMatch",
      "instrumentMatch",
      "semanticScore",
      "totalScore",
    ],
    matchReasons: true,
    aiInsight: true,
  },
  status: "ready-for-runtime-integration",
};
const handoffText = json(handoff);
const handoffSource = source(
  "fictional.local.final-matcher.json",
  handoffText,
);

const evidence: FinalEvidencePageManifest = {
  schemaVersion: "final-evidence-page-v1",
  createdAt,
  batchId: handoff.batchId,
  selectedMethod: handoff.selectedMethod,
  aiModel: handoff.aiModel,
  matchingConfigHash,
  feedbackSetHash,
  implementationCommitSha,
  decision: handoff.evaluation,
  sources: {
    handoff: handoffSource,
    metricManifest: {
      fileName: "fictional.local.visualisation.json",
      sha256: "6".repeat(64),
    },
    metricSvg: {
      fileName: "fictional.local.svg",
      sha256: "7".repeat(64),
    },
    rankings: [],
  },
  page: {
    fileName: "fictional.local.final-evidence.html",
    sha256: "8".repeat(64),
  },
};
const evidenceText = json(evidence);

const finalEvidence: FinalEvaluationEvidence = {
  handoff,
  handoffText,
  handoffSource,
  evidence,
  evidenceText,
  evidenceSource: source(
    "fictional.local.final-evidence.json",
    evidenceText,
  ),
};

const buildArgs = {
  sources: implementationSources,
  availableScripts: [...FINAL_DELIVERY_REQUIRED_SCRIPTS],
  createdAt,
  htmlFileName: "fictional.local.final-delivery.html",
};

async function main() {
  const waiting = buildFinalDeliveryReport(buildArgs);
  assert.equal(waiting.manifest.implementation.status, "ready");
  assert.equal(
    waiting.manifest.implementation.fileCount,
    FINAL_DELIVERY_SOURCE_FILES.length,
  );
  assert.match(
    waiting.manifest.implementation.sourceSetSha256,
    /^[a-f0-9]{64}$/,
  );
  assert.equal(
    waiting.manifest.evaluation.status,
    "waiting-for-frozen-evidence",
  );
  assert.equal(waiting.manifest.production.status, "blocked-by-evaluation");
  assert.match(waiting.html, />READY</);
  assert.match(waiting.html, />WAITING</);
  assert.match(waiting.html, />BLOCKED</);
  assert.match(
    waiting.html,
    new RegExp(waiting.manifest.implementation.sourceSetSha256),
  );
  assert.doesNotMatch(waiting.html, /<script\b/i);

  const reordered = buildFinalDeliveryReport({
    ...buildArgs,
    sources: [...implementationSources].reverse(),
  });
  assert.equal(
    reordered.manifest.implementation.sourceSetSha256,
    waiting.manifest.implementation.sourceSetSha256,
  );

  const ready = buildFinalDeliveryReport({
    ...buildArgs,
    finalEvidence,
  });
  assert.equal(ready.manifest.evaluation.status, "ready");
  assert.equal(
    ready.manifest.production.status,
    "awaiting-route-registration",
  );
  assert.match(ready.html, /gpt-4o-mini/);
  assert.match(ready.html, new RegExp(matchingConfigHash));
  assert.match(ready.html, new RegExp(implementationCommitSha));

  assert.throws(
    () =>
      buildFinalDeliveryReport({
        ...buildArgs,
        sources: implementationSources.slice(1),
      }),
    /Missing final implementation sources/,
  );
  assert.throws(
    () =>
      buildFinalDeliveryReport({
        ...buildArgs,
        sources: [...implementationSources, implementationSources[0]],
      }),
    /Duplicate final implementation source/,
  );
  assert.throws(
    () =>
      buildFinalDeliveryReport({
        ...buildArgs,
        availableScripts: FINAL_DELIVERY_REQUIRED_SCRIPTS.slice(1),
      }),
    /Missing final delivery scripts/,
  );
  assert.throws(
    () =>
      buildFinalDeliveryReport({
        ...buildArgs,
        finalEvidence: {
          ...finalEvidence,
          handoffText: `${handoffText} `,
        },
      }),
    /does not match its source hash/,
  );

  const mismatchedEvidence = {
    ...evidence,
    matchingConfigHash: "d".repeat(64),
  };
  const mismatchedEvidenceText = json(mismatchedEvidence);
  assert.throws(
    () =>
      buildFinalDeliveryReport({
        ...buildArgs,
        finalEvidence: {
          ...finalEvidence,
          evidence: mismatchedEvidence,
          evidenceText: mismatchedEvidenceText,
          evidenceSource: source(
            "fictional.local.final-evidence.json",
            mismatchedEvidenceText,
          ),
        },
      }),
    /identity does not match/,
  );

  const temporaryDirectory = await mkdtemp(
    path.join(tmpdir(), "final-delivery-report-"),
  );
  try {
    const outputs = await writeFinalDeliveryReport({
      report: waiting,
      htmlPath: "exports/fictional.local.final-delivery.html",
      manifestPath: "exports/fictional.local.final-delivery.json",
      workingDirectory: temporaryDirectory,
    });
    assert.equal(await readFile(outputs.htmlPath, "utf8"), waiting.html);
    assert.deepEqual(
      JSON.parse(await readFile(outputs.manifestPath, "utf8")),
      waiting.manifest,
    );
    await assert.rejects(
      writeFinalDeliveryReport({
        report: waiting,
        htmlPath: "exports/fictional.local.final-delivery.html",
        manifestPath: "exports/fictional.local.final-delivery.json",
        workingDirectory: temporaryDirectory,
      }),
      /already exists/,
    );
    await assert.rejects(
      writeFinalDeliveryReport({
        report: waiting,
        htmlPath: "../escaped.local.final-delivery.html",
        manifestPath: "exports/escaped.local.final-delivery.json",
        workingDirectory: temporaryDirectory,
      }),
      /must stay inside exports/,
    );
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }

  console.log("Final delivery report check passed.");
  console.log(
    "Checked source-set identity, command coverage, pending/ready evidence states and protected output.",
  );
}

main().catch(error => {
  console.error(
    `Final delivery report check failed: ${
      error instanceof Error ? error.message : String(error)
    }.`,
  );
  process.exitCode = 1;
});
