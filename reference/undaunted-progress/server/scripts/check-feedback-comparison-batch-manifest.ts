import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Investor } from "../services/airtable";
import {
  buildFeedbackComparisonBatchManifest,
  validateFeedbackComparisonBatchManifest,
  verifyFeedbackComparisonBatchFiles,
  writeFeedbackComparisonBatchManifest,
} from "../services/feedback-comparison-batch-manifest";
import {
  buildFeedbackComparisonExport,
  writeFeedbackComparisonExport,
  type FeedbackComparisonExport,
} from "../services/feedback-comparison-export";
import type { FeedbackComparisonRun } from "../services/feedback-comparison-runner";
import { CURATED_FEEDBACK_CONTEXT_SCHEMA_VERSION } from "../services/feedback-context";
import { buildFeedbackExperimentDefinition } from "../services/feedback-experiment";
import type { MatchResult } from "../services/matching";

function hash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function comparison(queryNumber: number): FeedbackComparisonRun {
  const queryId = `query-${queryNumber}`;
  const investors: Investor[] = Array.from({ length: 10 }, (_, index) => ({
    id: `${queryId}-investor-${String(index + 1).padStart(2, "0")}`,
    organisation: `Private investor ${queryNumber}-${index + 1}`,
  }));
  const matches = (semanticScore: number): MatchResult[] => investors.map(investor => ({
    investor,
    scoreBreakdown: {
      stageMatch: 80,
      ticketSizeMatch: 70,
      sectorOverlap: 90,
      geographyMatch: 100,
      instrumentMatch: 100,
      semanticScore,
      totalScore: 85,
    },
    matchReasons: ["Private comparison reason"],
    aiInsight: "Private comparison insight",
  }));
  return {
    query: {
      queryId,
      startupId: `startup-${queryNumber}`,
      fundingRoundId: `round-${queryNumber}`,
      candidateCount: 12,
      candidatePoolHash: hash(`candidate-pool-${queryNumber}`),
    },
    feedbackContext: {
      schemaVersion: CURATED_FEEDBACK_CONTEXT_SCHEMA_VERSION,
      feedbackSetVersion: "curated-feedback-2026-07-23",
      feedbackSetHash: hash("curated-feedback-set"),
      characterCount: 300,
      selectedUpCount: 2,
      selectedDownCount: 2,
    },
    runs: [
      { feedbackMode: "none", matches: matches(45) },
      { feedbackMode: "curated", matches: matches(75) },
    ],
  };
}

async function main() {
  const comparisons = [comparison(1), comparison(2), comparison(3)];
  const definition = buildFeedbackExperimentDefinition({
    matchingConfigHash: hash("fixed-feedback-config"),
    feedbackSetVersion: comparisons[0].feedbackContext.feedbackSetVersion,
    feedbackSetHash: comparisons[0].feedbackContext.feedbackSetHash,
    queries: comparisons.map(({ query }) => query),
  });
  const outputs = comparisons.map((item, index) => ({
    fileName: `feedback-query-${String(index + 1).padStart(2, "0")}.local.json`,
    output: buildFeedbackComparisonExport({
      comparison: item,
      definition,
      runId: `feedback-batch-check-${index + 1}`,
      source: `offline-query-${index + 1}.json`,
      createdAt: "2026-07-23T00:00:00.000Z",
    }),
  }));
  const manifest = buildFeedbackComparisonBatchManifest({
    batchId: "feedback-batch-check",
    definition,
    outputs,
    createdAt: "2026-07-23T01:00:00.000Z",
  });
  const summary = validateFeedbackComparisonBatchManifest(manifest);
  assert.deepEqual(summary.queryIds, ["query-1", "query-2", "query-3"]);
  assert.equal(summary.fileNames.length, 3);
  assert.equal(summary.feedbackSetHash, comparisons[0].feedbackContext.feedbackSetHash);
  assert.doesNotMatch(
    JSON.stringify(manifest),
    /Private investor|Private comparison reason|Private comparison insight/,
  );

  const withFeedbackText = structuredClone(manifest) as unknown as Record<string, unknown>;
  withFeedbackText.feedbackText = "private feedback";
  assert.throws(
    () => validateFeedbackComparisonBatchManifest(withFeedbackText),
    /unexpected fields: feedbackText/,
  );
  const repeatedFile = structuredClone(manifest);
  repeatedFile.files[1].fileName = repeatedFile.files[0].fileName;
  assert.throws(
    () => validateFeedbackComparisonBatchManifest(repeatedFile),
    /file names must be unique/,
  );

  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "feedback-batch-manifest-"));
  try {
    for (const entry of outputs) {
      await writeFeedbackComparisonExport({
        output: entry.output,
        filePath: `exports/${entry.fileName}`,
        workingDirectory: temporaryRoot,
      });
    }
    await verifyFeedbackComparisonBatchFiles({ manifest, workingDirectory: temporaryRoot });
    const manifestPath = await writeFeedbackComparisonBatchManifest({
      manifest,
      filePath: "exports/feedback-batch-check.local.manifest.json",
      workingDirectory: temporaryRoot,
    });
    const written = JSON.parse(await readFile(manifestPath, "utf8"));
    assert.equal(
      validateFeedbackComparisonBatchManifest(written).batchId,
      manifest.batchId,
    );
    await assert.rejects(
      () => writeFeedbackComparisonBatchManifest({
        manifest,
        filePath: "exports/feedback-batch-check.local.manifest.json",
        workingDirectory: temporaryRoot,
      }),
      /already exists/,
    );

    const firstOutputPath = path.join(
      temporaryRoot,
      "exports",
      manifest.files[0].fileName,
    );
    const firstOutput = JSON.parse(await readFile(firstOutputPath, "utf8")) as FeedbackComparisonExport;
    firstOutput.run.runId = "tampered-run";
    await writeFile(firstOutputPath, `${JSON.stringify(firstOutput, null, 2)}\n`, "utf8");
    await assert.rejects(
      () => verifyFeedbackComparisonBatchFiles({
        manifest,
        workingDirectory: temporaryRoot,
      }),
      /file hash mismatch/,
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }

  console.log("Feedback comparison batch manifest check passed.");
  console.log("Checked three private files, SHA-256 verification, and protected publication.");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
