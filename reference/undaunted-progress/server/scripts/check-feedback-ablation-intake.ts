import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Investor } from "../services/airtable";
import {
  BLIND_LABELLING_COLUMNS,
  BLIND_LABELLING_SCHEMA_VERSION,
  type BlindLabellingRow,
} from "../services/blind-labelling";
import { serialiseBlindCsv } from "../services/blind-labelling-csv";
import { sha256Text } from "../services/blind-labelling-manifest";
import {
  buildFeedbackAblationIntake,
  FEEDBACK_ABLATION_INTAKE_MANIFEST_SCHEMA_VERSION,
  FEEDBACK_ABLATION_INTAKE_SCHEMA_VERSION,
  parseFeedbackAblationIntakeCsv,
  validateFeedbackAblationIntakeArtifacts,
  writeFeedbackAblationIntakeArtifacts,
} from "../services/feedback-ablation-intake";
import { buildFeedbackComparisonBatchManifest } from "../services/feedback-comparison-batch-manifest";
import {
  buildFeedbackComparisonExport,
  serialiseFeedbackComparisonExport,
} from "../services/feedback-comparison-export";
import type { FeedbackComparisonRun } from "../services/feedback-comparison-runner";
import { CURATED_FEEDBACK_CONTEXT_SCHEMA_VERSION } from "../services/feedback-context";
import { buildFeedbackExperimentDefinition } from "../services/feedback-experiment";
import { FROZEN_LABEL_MANIFEST_SCHEMA_VERSION } from "../services/frozen-labelling-manifest";
import type { MatchResult } from "../services/matching";

function hash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function match(
  queryNumber: number,
  investorNumber: number,
  semanticScore: number,
): MatchResult {
  const investor: Investor = {
    id: `query-${queryNumber}-investor-${String(investorNumber).padStart(2, "0")}`,
    organisation: `Private investor ${queryNumber}-${investorNumber}`,
  };
  return {
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
  };
}

function comparison(queryNumber: number): FeedbackComparisonRun {
  return {
    query: {
      queryId: `query-${queryNumber}`,
      startupId: `startup-${queryNumber}`,
      fundingRoundId: `round-${queryNumber}`,
      candidateCount: 15,
      candidatePoolHash: hash(`candidate-pool-${queryNumber}`),
    },
    feedbackContext: {
      schemaVersion: CURATED_FEEDBACK_CONTEXT_SCHEMA_VERSION,
      feedbackSetVersion: "curated-feedback-2026-07-22",
      feedbackSetHash: hash("curated-feedback-set"),
      characterCount: 300,
      selectedUpCount: 2,
      selectedDownCount: 2,
    },
    runs: [
      {
        feedbackMode: "none",
        matches: Array.from({ length: 10 }, (_, index) =>
          match(queryNumber, index + 1, 45),
        ),
      },
      {
        feedbackMode: "curated",
        matches: Array.from({ length: 10 }, (_, index) =>
          match(queryNumber, index + 6, 75),
        ),
      },
    ],
  };
}

function buildComparisonFixture() {
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
      runId: `feedback-intake-check-${index + 1}`,
      source: `offline-query-${index + 1}.json`,
      createdAt: "2026-07-22T08:00:00.000Z",
    }),
  }));
  const manifest = buildFeedbackComparisonBatchManifest({
    batchId: "feedback-intake-check",
    definition,
    outputs,
    createdAt: "2026-07-22T09:00:00.000Z",
  });
  return {
    batchManifestText: `${JSON.stringify(manifest, null, 2)}\n`,
    comparisonFiles: outputs.map((entry) => ({
      fileName: entry.fileName,
      text: serialiseFeedbackComparisonExport(entry.output),
    })),
  };
}

function frozenRow(
  queryNumber: number,
  investorNumber: number,
): BlindLabellingRow {
  const row = Object.fromEntries(
    BLIND_LABELLING_COLUMNS.map((column) => [column, ""]),
  ) as BlindLabellingRow;
  row.queryId = `query-${queryNumber}`;
  row.startupId = `startup-${queryNumber}`;
  row.fundingRoundId = `round-${queryNumber}`;
  row.investorId = `query-${queryNumber}-investor-${String(investorNumber).padStart(2, "0")}`;
  row.startupDescription = "An anonymised startup description.";
  row.solutionDescription = "An anonymised solution description.";
  row.investorDescription = "An anonymised investor description.";
  row.relevance_label =
    investorNumber % 3 === 0
      ? "weak_fit"
      : investorNumber % 2 === 0
        ? "possible_fit"
        : "strong_fit";
  row.relevance_value =
    row.relevance_label === "strong_fit"
      ? "2"
      : row.relevance_label === "possible_fit"
        ? "1"
        : "0";
  row.review_status = "complete";
  return row;
}

function buildFrozenFixture(investorsPerQuery: number) {
  const rows = [1, 2, 3].flatMap((queryNumber) =>
    Array.from({ length: investorsPerQuery }, (_, index) =>
      frozenRow(queryNumber, index + 1),
    ),
  );
  const csv = serialiseBlindCsv(rows);
  const manifest = {
    schemaVersion: FROZEN_LABEL_MANIFEST_SCHEMA_VERSION,
    labellingSchemaVersion: BLIND_LABELLING_SCHEMA_VERSION,
    frozenVersion: `formal-v3-frozen-${investorsPerQuery}`,
    frozenAt: "2026-07-22T10:00:00.000Z",
    fileName: "blind-labelling-formal-v3-labelled.local.csv",
    sha256: sha256Text(csv),
    sourcePackVersion: "formal-v3",
    sourcePackSha256: hash("formal-v3-source-pack"),
    rowCount: rows.length,
    queryCount: 3,
    judgedRowCount: rows.length,
    holdRowCount: 0,
    completeQueryCount: 3,
    incompleteQueryCount: 0,
    columnCount: BLIND_LABELLING_COLUMNS.length,
  };
  return { csv, manifestText: `${JSON.stringify(manifest, null, 2)}\n` };
}

function buildFixture(investorsPerQuery: number) {
  const comparison = buildComparisonFixture();
  const frozen = buildFrozenFixture(investorsPerQuery);
  return buildFeedbackAblationIntake({
    batchManifestFileName: "feedback-batch.local.manifest.json",
    batchManifestText: comparison.batchManifestText,
    comparisonFiles: comparison.comparisonFiles,
    frozenLabelsCsv: frozen.csv,
    frozenLabelsFileName: "blind-labelling-formal-v3-labelled.local.csv",
    frozenManifestText: frozen.manifestText,
    frozenManifestFileName:
      "blind-labelling-formal-v3-frozen-manifest.local.json",
    csvFileName: "feedback-ablation-intake-v1.local.csv",
    createdAt: "2026-07-22T11:00:00.000Z",
  });
}

async function main() {
  const comparison = buildComparisonFixture();
  const fullyCoveredFrozen = buildFrozenFixture(15);
  const ready = buildFixture(15);
  assert.equal(
    ready.manifest.schemaVersion,
    FEEDBACK_ABLATION_INTAKE_MANIFEST_SCHEMA_VERSION,
  );
  assert.equal(
    ready.manifest.intakeVersion,
    FEEDBACK_ABLATION_INTAKE_SCHEMA_VERSION,
  );
  assert.equal(ready.manifest.csv.rowCount, 60);
  assert.deepEqual(ready.manifest.csv.methods, [
    "no_feedback_gpt",
    "curated_feedback",
  ]);
  assert.deepEqual(ready.manifest.csv.ranks, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(ready.manifest.queries.length, 3);
  assert.equal(ready.manifest.labelCoverage.uniqueTopTenPairCount, 45);
  assert.equal(ready.manifest.labelCoverage.missingPairCount, 0);
  assert.equal(ready.manifest.evaluationStatus, "ready-for-metrics");
  assert.doesNotMatch(
    ready.csv,
    /score|matchReason|aiInsight|Private investor|Private comparison/,
  );

  const parsedRows = parseFeedbackAblationIntakeCsv(ready.csv);
  assert.equal(parsedRows.length, 60);
  assert.equal(
    parsedRows.filter((row) => row.method === "no_feedback_gpt").length,
    30,
  );
  assert.equal(
    parsedRows.filter((row) => row.method === "curated_feedback").length,
    30,
  );
  const summary = validateFeedbackAblationIntakeArtifacts({
    csv: ready.csv,
    manifest: ready.manifest,
    batchManifestText: comparison.batchManifestText,
    frozenLabelsCsv: fullyCoveredFrozen.csv,
    frozenManifestText: fullyCoveredFrozen.manifestText,
  });
  assert.equal(summary.rowCount, 60);
  assert.equal(summary.evaluationStatus, "ready-for-metrics");

  const needsSupplementary = buildFixture(10);
  assert.equal(needsSupplementary.manifest.labelCoverage.missingPairCount, 15);
  assert.equal(
    needsSupplementary.manifest.evaluationStatus,
    "requires-supplementary-blind-labelling",
  );

  const wrongRankCsv = ready.csv.replace(
    '"no_feedback_gpt","query-1","startup-1","round-1","10",',
    '"no_feedback_gpt","query-1","startup-1","round-1","9",',
  );
  const wrongRankManifest = structuredClone(ready.manifest);
  wrongRankManifest.csv.sha256 = sha256Text(wrongRankCsv);
  assert.throws(
    () =>
      validateFeedbackAblationIntakeArtifacts({
        csv: wrongRankCsv,
        manifest: wrongRankManifest,
        batchManifestText: comparison.batchManifestText,
        frozenLabelsCsv: fullyCoveredFrozen.csv,
        frozenManifestText: fullyCoveredFrozen.manifestText,
      }),
    /ranks 1-10/,
  );

  const leakedHeaderCsv = ready.csv.replace(
    '"investorId"\n',
    '"investorId","totalScore"\n',
  );
  assert.throws(
    () => parseFeedbackAblationIntakeCsv(leakedHeaderCsv),
    /headers do not match|Invalid Record Length/,
  );

  const wrongPool = structuredClone(ready.manifest);
  wrongPool.queries[0].candidatePoolSha256 = hash("different-pool");
  assert.throws(
    () =>
      validateFeedbackAblationIntakeArtifacts({
        csv: ready.csv,
        manifest: wrongPool,
        batchManifestText: comparison.batchManifestText,
        frozenLabelsCsv: fullyCoveredFrozen.csv,
        frozenManifestText: fullyCoveredFrozen.manifestText,
      }),
    /candidate pools do not match/,
  );

  assert.throws(
    () =>
      validateFeedbackAblationIntakeArtifacts({
        csv: ready.csv,
        manifest: ready.manifest,
        batchManifestText: comparison.batchManifestText,
        frozenLabelsCsv: `${fullyCoveredFrozen.csv} `,
        frozenManifestText: fullyCoveredFrozen.manifestText,
      }),
    /frozen-label CSV hash mismatch/,
  );

  const temporaryRoot = await mkdtemp(
    path.join(os.tmpdir(), "feedback-intake-"),
  );
  try {
    const written = await writeFeedbackAblationIntakeArtifacts({
      artifacts: ready,
      csvPath: "exports/feedback-ablation-intake-v1.local.csv",
      manifestPath: "exports/feedback-ablation-intake-v1.local.manifest.json",
      workingDirectory: temporaryRoot,
    });
    assert.equal(await readFile(written.csvPath, "utf8"), ready.csv);
    assert.deepEqual(
      JSON.parse(await readFile(written.manifestPath, "utf8")),
      ready.manifest,
    );
    await assert.rejects(
      () =>
        writeFeedbackAblationIntakeArtifacts({
          artifacts: ready,
          csvPath: "exports/feedback-ablation-intake-v1.local.csv",
          manifestPath:
            "exports/feedback-ablation-intake-v1.local.manifest.json",
          workingDirectory: temporaryRoot,
        }),
      /already exists/,
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }

  console.log("Feedback ablation intake check passed.");
  console.log(
    "Checked two named methods, three candidate-pool hashes, ranks 1-10, frozen-label hashes, and the stop-before-metrics gate.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
