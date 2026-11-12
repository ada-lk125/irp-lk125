import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Investor } from "../services/airtable";
import type { MatchResult } from "../services/matching";
import {
  buildSemanticComparisonIdentity,
} from "../services/semantic-comparison";
import {
  buildSemanticComparisonExport,
} from "../services/semantic-comparison-export";
import {
  assertSemanticReviewOutputAvailable,
  buildSemanticComparisonReview,
  buildSemanticComparisonReviewPack,
  SEMANTIC_COMPARISON_REVIEW_SCHEMA_VERSION,
  SEMANTIC_COMPARISON_REVIEW_PACK_SCHEMA_VERSION,
} from "../services/semantic-comparison-review";
import type { SemanticComparisonRun } from "../services/semantic-comparison-runner";
import { buildSemanticSignalAudit } from "../services/semantic-signal-audit";

const investors: Investor[] = Array.from({ length: 15 }, (_, index) => ({
  id: `investor-review-${String(index + 1).padStart(2, "0")}`,
  organisation: `Review Investor ${index + 1}`,
}));

function matches(
  investorNumbers: number[],
  scoreAt: (index: number) => number,
  hardExclusionIndex?: number,
): MatchResult[] {
  return investorNumbers.map((investorNumber, index) => ({
    investor: investors[investorNumber - 1],
    scoreBreakdown: {
      stageMatch: 80,
      ticketSizeMatch: 70,
      sectorOverlap: 90,
      geographyMatch: 100,
      instrumentMatch: 100,
      semanticScore: scoreAt(index),
      totalScore: 85,
    },
    matchReasons: ["Offline comparison review check"],
    ...(scoreAt(index) > 0
      ? {
          aiInsight: index === hardExclusionIndex
            ? "[EXCLUSION] Offline restriction"
            : "Offline semantic result",
        }
      : {}),
  }));
}

function comparisonExport(queryNumber = 1) {
  const comparison: SemanticComparisonRun = {
    identity: buildSemanticComparisonIdentity({
      queryId: `query-review-check-${queryNumber}`,
      startupId: `startup-review-check-${queryNumber}`,
      fundingRoundId: `round-review-check-${queryNumber}`,
      investorIds: investors.map(({ id }) => id),
    }),
    signalAudit: buildSemanticSignalAudit({
      startup: {
        id: `startup-review-check-${queryNumber}`,
        description: "Offline startup",
      },
      fundingRound: {
        id: `round-review-check-${queryNumber}`,
        roundSectors: ["Energy"],
      },
      investors,
      config: { contextCharLimit: 2500 },
    }),
    methodRuns: [
      {
        method: "rule-only",
        matches: matches([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], () => 0),
      },
      {
        method: "gpt-semantic",
        matches: matches([1, 2, 3, 4, 5, 11, 12, 13, 14, 15], index => 50 + index, 0),
      },
      {
        method: "text-similarity",
        matches: matches([10, 9, 8, 7, 6, 5, 4, 3, 2, 1], index => 30 + index),
      },
    ],
  };

  return buildSemanticComparisonExport({
    comparison,
    runId: `semantic-review-check-${queryNumber}`,
    source: "offline-review-fixture.json",
    createdAt: "2026-07-17T00:00:00.000Z",
  });
}

async function checkOutputGuard() {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "semantic-review-"));
  try {
    const output = await assertSemanticReviewOutputAvailable(
      "exports/review.local.json",
      temporaryRoot,
    );
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, "{}\n", "utf8");
    await assert.rejects(
      () => assertSemanticReviewOutputAvailable("exports/review.local.json", temporaryRoot),
      /will not be overwritten/,
    );
    await assert.rejects(
      () => assertSemanticReviewOutputAvailable("review.local.json", temporaryRoot),
      /inside exports/,
    );
    await assert.rejects(
      () => assertSemanticReviewOutputAvailable("exports/review.json", temporaryRoot),
      /end with .local.json/,
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

async function main() {
  const output = comparisonExport();
  const review = buildSemanticComparisonReview(output);

  assert.equal(review.schemaVersion, SEMANTIC_COMPARISON_REVIEW_SCHEMA_VERSION);
  assert.equal(review.startupId, "startup-review-check-1");
  assert.equal(review.fundingRoundId, "round-review-check-1");
  assert.equal(review.evaluationStatus, "requires-frozen-labels");
  assert.equal(review.methods[0].scoredMatchCount, 0);
  assert.equal(review.methods[1].scoredMatchCount, 10);
  assert.equal(review.methods[1].hardExclusionCount, 1);
  assert.equal(review.methods[1].semanticScore.mean, 54.5);
  assert.deepEqual(review.pairwise[0], {
    leftMethod: "rule-only",
    rightMethod: "gpt-semantic",
    topTenSharedCount: 5,
    topFiveSharedCount: 5,
    sameRankCount: 5,
    meanAbsoluteRankChange: 0,
  });
  assert.deepEqual(review.pairwise[1], {
    leftMethod: "rule-only",
    rightMethod: "text-similarity",
    topTenSharedCount: 10,
    topFiveSharedCount: 0,
    sameRankCount: 0,
    meanAbsoluteRankChange: 5,
  });

  const reviewJson = JSON.stringify(review);
  assert.equal(reviewJson.includes("investor-review-01"), false);
  assert.equal(reviewJson.includes("Review Investor"), false);

  const invalidScore = structuredClone(output);
  invalidScore.methods[1].matches[0].scores.semanticScore = 101;
  assert.throws(
    () => buildSemanticComparisonReview(invalidScore),
    /semanticScore must be a number from 0 to 100/,
  );

  const invalidAiStatus = structuredClone(output) as unknown as {
    methods: Array<{ matches: Array<{ ai: { scored: unknown } }> }>;
  };
  invalidAiStatus.methods[1].matches[0].ai.scored = "yes";
  assert.throws(
    () => buildSemanticComparisonReview(invalidAiStatus),
    /ai.scored and ai.hardExcluded must be boolean values/,
  );
  const exportWithPrivateAuditField = structuredClone(output) as unknown as {
    signalAudit: { investors: Record<string, unknown> };
  };
  exportWithPrivateAuditField.signalAudit.investors.investorIds = ["private-id"];
  assert.throws(
    () => buildSemanticComparisonReview(exportWithPrivateAuditField),
    /unexpected fields: investorIds/,
  );

  const pack = buildSemanticComparisonReviewPack({
    exports: [comparisonExport(1), comparisonExport(2), comparisonExport(3)],
    createdAt: "2026-07-17T00:00:00.000Z",
  });
  assert.equal(pack.schemaVersion, SEMANTIC_COMPARISON_REVIEW_PACK_SCHEMA_VERSION);
  assert.equal(pack.queryCount, 3);
  assert.equal(pack.evaluationStatus, "requires-frozen-labels");
  assert.throws(
    () =>
      buildSemanticComparisonReviewPack({
        exports: [comparisonExport(1), comparisonExport(1), comparisonExport(3)],
      }),
    /query ids must be unique/,
  );
  const repeatedPair = comparisonExport(2);
  repeatedPair.identity.startupId = "startup-review-check-1";
  repeatedPair.identity.fundingRoundId = "round-review-check-1";
  assert.throws(
    () =>
      buildSemanticComparisonReviewPack({
        exports: [comparisonExport(1), repeatedPair, comparisonExport(3)],
      }),
    /startup and funding round pairs must be unique/,
  );
  assert.throws(
    () => buildSemanticComparisonReviewPack({ exports: [comparisonExport(1)] }),
    /needs 3 query exports/,
  );

  await checkOutputGuard();

  console.log("Semantic comparison review check passed.");
  console.log("Checked method overlap, three-query packing, private output paths, and value omission.");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
