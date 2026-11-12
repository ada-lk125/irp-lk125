import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Investor } from "../services/airtable";
import {
  assertFeedbackComparisonOutputAvailable,
  buildFeedbackComparisonExport,
  validateFeedbackComparisonExport,
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

const investors: Investor[] = Array.from({ length: 10 }, (_, index) => ({
  id: `investor-${String(index + 1).padStart(2, "0")}`,
  organisation: `Investor ${index + 1}`,
}));

function matches(semanticScore: number): MatchResult[] {
  return investors.map(investor => ({
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
    matchReasons: ["Offline feedback export check"],
    aiInsight: semanticScore > 50 ? "Curated run insight" : "Control insight",
  }));
}

function sampleComparison(): FeedbackComparisonRun {
  return {
    query: {
      queryId: "query-feedback-export",
      startupId: "startup-feedback-export",
      fundingRoundId: "round-feedback-export",
      candidateCount: 12,
      candidatePoolHash: hash("candidate-pool"),
    },
    feedbackContext: {
      schemaVersion: CURATED_FEEDBACK_CONTEXT_SCHEMA_VERSION,
      feedbackSetVersion: "curated-feedback-2026-07-22",
      feedbackSetHash: hash("curated-feedback"),
      characterCount: 320,
      selectedUpCount: 2,
      selectedDownCount: 2,
    },
    runs: [
      { feedbackMode: "none", matches: matches(40) },
      { feedbackMode: "curated", matches: matches(80) },
    ],
  };
}

function definition(comparison: FeedbackComparisonRun) {
  return buildFeedbackExperimentDefinition({
    matchingConfigHash: hash("fixed-config"),
    feedbackSetVersion: comparison.feedbackContext.feedbackSetVersion,
    feedbackSetHash: comparison.feedbackContext.feedbackSetHash,
    queries: [
      comparison.query,
      {
        queryId: "query-2",
        startupId: "startup-2",
        fundingRoundId: "round-2",
        candidatePoolHash: hash("candidate-pool-2"),
      },
      {
        queryId: "query-3",
        startupId: "startup-3",
        fundingRoundId: "round-3",
        candidatePoolHash: hash("candidate-pool-3"),
      },
    ],
  });
}

async function checkOutputGuard() {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "feedback-comparison-"));
  try {
    const outputPath = await assertFeedbackComparisonOutputAvailable(
      "exports/check.local.json",
      temporaryRoot,
    );
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, "{}\n", "utf8");

    await assert.rejects(
      () => assertFeedbackComparisonOutputAvailable(
        "exports/check.local.json",
        temporaryRoot,
      ),
      /will not be overwritten/,
    );
    await assert.rejects(
      () => assertFeedbackComparisonOutputAvailable(
        "outside.local.json",
        temporaryRoot,
      ),
      /inside exports/,
    );
    await assert.rejects(
      () => assertFeedbackComparisonOutputAvailable(
        "exports/check.json",
        temporaryRoot,
      ),
      /end with .local.json/,
    );
    await assert.rejects(
      () => assertFeedbackComparisonOutputAvailable(
        "exports/../escaped.local.json",
        temporaryRoot,
      ),
      /inside exports/,
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

async function checkWriter(output: FeedbackComparisonExport) {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "feedback-writer-"));
  try {
    const filePath = "exports/feedback-check.local.json";
    const resolved = await writeFeedbackComparisonExport({
      output,
      filePath,
      workingDirectory: temporaryRoot,
    });
    const written = JSON.parse(await readFile(resolved, "utf8"));
    const summary = validateFeedbackComparisonExport(written);
    assert.equal(summary.queryId, output.query.queryId);
    assert.equal(summary.feedbackSetHash, output.feedback.feedbackSetHash);

    await assert.rejects(
      () => writeFeedbackComparisonExport({
        output,
        filePath,
        workingDirectory: temporaryRoot,
      }),
      /will not be overwritten/,
    );

    const concurrentPath = "exports/feedback-concurrent.local.json";
    const concurrentWrites = await Promise.allSettled([
      writeFeedbackComparisonExport({
        output,
        filePath: concurrentPath,
        workingDirectory: temporaryRoot,
      }),
      writeFeedbackComparisonExport({
        output,
        filePath: concurrentPath,
        workingDirectory: temporaryRoot,
      }),
    ]);
    assert.equal(
      concurrentWrites.filter(({ status }) => status === "fulfilled").length,
      1,
    );
    assert.equal(
      concurrentWrites.filter(({ status }) => status === "rejected").length,
      1,
    );

    const files = (await readdir(path.dirname(resolved))).sort();
    assert.deepEqual(files, [
      "feedback-check.local.json",
      "feedback-concurrent.local.json",
    ]);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

async function main() {
  const comparison = sampleComparison();
  const output = buildFeedbackComparisonExport({
    comparison,
    definition: definition(comparison),
    runId: "feedback-comparison-export-check",
    source: "offline-feedback-fixture.json",
    createdAt: "2026-07-22T00:00:00.000Z",
  });
  const summary = validateFeedbackComparisonExport(output);

  assert.equal(summary.queryId, comparison.query.queryId);
  assert.equal(summary.candidateCount, 12);
  assert.equal(summary.feedbackSetHash, comparison.feedbackContext.feedbackSetHash);
  assert.deepEqual(summary.runMatchCounts, { none: 10, curated: 10 });
  assert.equal(output.runs[0].matches[0].rank, 1);
  assert.equal(output.runs[1].matches[9].rank, 10);
  assert.doesNotMatch(
    JSON.stringify(output.feedback),
    /"text"\s*:|Private Startup|private feedback reason/i,
  );

  const withFeedbackText = structuredClone(output) as unknown as {
    feedback: Record<string, unknown>;
  };
  withFeedbackText.feedback.text = "private feedback reason";
  assert.throws(
    () => validateFeedbackComparisonExport(withFeedbackText),
    /must not contain feedback text/,
  );

  const incomplete = structuredClone(output);
  incomplete.runs[1].matches.pop();
  assert.throws(
    () => validateFeedbackComparisonExport(incomplete),
    /must contain 10 matches/,
  );

  const repeatedMode = structuredClone(output);
  repeatedMode.runs[1].feedbackMode = "none";
  assert.throws(
    () => validateFeedbackComparisonExport(repeatedMode),
    /must be none, curated in that order/,
  );

  const wrongDefinition = definition(comparison);
  wrongDefinition.queries[0].candidatePoolHash = hash("different-pool");
  assert.throws(
    () => buildFeedbackComparisonExport({
      comparison,
      definition: wrongDefinition,
      runId: "wrong-definition",
      source: "offline-feedback-fixture.json",
    }),
    /query does not match the experiment definition/,
  );

  await checkOutputGuard();
  await checkWriter(output);
  console.log("Feedback comparison export check passed.");
  console.log("Checked identity, feedback omission, private paths, and protected file writing.");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
