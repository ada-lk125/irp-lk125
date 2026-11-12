import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { FinalMatcherHandoff } from "../services/final-matcher-handoff";
import type { FinalMatcherRouteResult } from "../services/final-matcher-route-result";
import {
  buildFinalRankingMovement,
  writeFinalRankingMovement,
} from "../services/final-ranking-movement";

const candidateIds = [
  "private-a",
  "private-b",
  "private-c",
  "private-d",
  "private-e",
  "private-f",
];

function routeResult(order: string[]): FinalMatcherRouteResult {
  return {
    startupAirtableId: "startup-private",
    fundingRoundAirtableId: "round-private",
    matches: order.map((investorId, index) => {
      const componentScore = 80 - index * 2;
      return {
        investor: {
          id: investorId,
          organisation: `Private organisation ${investorId}`,
        },
        scoreBreakdown: {
          stageMatch: componentScore,
          ticketSizeMatch: componentScore,
          sectorOverlap: componentScore,
          geographyMatch: componentScore,
          instrumentMatch: componentScore,
          semanticScore: componentScore,
          totalScore: componentScore,
        },
        matchReasons: [`Private reason ${investorId}`],
        aiInsight: `Private insight ${investorId}`,
      };
    }),
  };
}

const handoff: FinalMatcherHandoff = {
  schemaVersion: "final-matcher-handoff-v1",
  createdAt: "2026-07-29T11:00:00.000Z",
  batchId: "fictional-ranking-movement",
  selectedMethod: "curated_feedback",
  semanticMethod: "gpt-semantic",
  aiModel: "gpt-4o-mini",
  matchingConfigHash: "b".repeat(64),
  feedbackSetHash: "c".repeat(64),
  implementationCommitSha: "1".repeat(40),
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

const baseline = routeResult(candidateIds);
const selected = routeResult([
  "private-c",
  "private-a",
  "private-f",
  "private-b",
  "private-e",
  "private-d",
]);

const buildArgs = {
  baseline,
  selected,
  handoff,
  sources: {
    baseline: {
      fileName: "baseline-fictional.local.json",
      sha256: "d".repeat(64),
    },
    selected: {
      fileName: "selected-fictional.local.json",
      sha256: "e".repeat(64),
    },
    handoff: {
      fileName: "final-fictional.local.final-matcher.json",
      sha256: "f".repeat(64),
    },
  },
  queryAlias: "Q1",
  topN: 5,
  createdAt: "2026-07-29T12:00:00.000Z",
  svgFileName: "final-ranking-fictional.local.svg",
} as const;

async function main() {
  const visualisation = buildFinalRankingMovement(buildArgs);
  assert.deepEqual(visualisation.manifest.summary, {
    up: 1,
    down: 2,
    same: 1,
    entered: 1,
    left: 1,
  });
  assert.equal(visualisation.manifest.rows.length, 6);
  assert.equal(visualisation.manifest.candidatePoolHash.length, 64);
  assert.equal(visualisation.manifest.matchingConfigHash, "b".repeat(64));
  assert.equal(visualisation.manifest.implementationCommitSha, "1".repeat(40));
  assert.match(visualisation.svg, /Final ranking movement: Q1/);
  assert.match(visualisation.svg, />Baseline</);
  assert.match(visualisation.svg, />Curated feedback</);
  assert.match(
    visualisation.svg,
    /Frozen metrics determine whether quality improved/,
  );
  assert.match(visualisation.svg, /I001/);

  const publicText = `${visualisation.svg}\n${JSON.stringify(
    visualisation.manifest,
  )}`;
  [
    ...candidateIds,
    "startup-private",
    "round-private",
    "Private organisation",
    "Private reason",
    "Private insight",
  ].forEach(value => assert.doesNotMatch(publicText, new RegExp(value)));

  const temporaryDirectory = await mkdtemp(
    path.join(tmpdir(), "final-ranking-movement-"),
  );
  try {
    const outputs = await writeFinalRankingMovement({
      visualisation,
      svgPath: "exports/final-ranking-fictional.local.svg",
      manifestPath:
        "exports/final-ranking-fictional.local.ranking-movement.json",
      workingDirectory: temporaryDirectory,
    });
    assert.equal(
      await readFile(outputs.svgPath, "utf8"),
      visualisation.svg,
    );
    assert.deepEqual(
      JSON.parse(await readFile(outputs.manifestPath, "utf8")),
      visualisation.manifest,
    );
    await assert.rejects(
      writeFinalRankingMovement({
        visualisation,
        svgPath: "exports/final-ranking-fictional.local.svg",
        manifestPath:
          "exports/final-ranking-fictional.local.ranking-movement.json",
        workingDirectory: temporaryDirectory,
      }),
      /already exists/,
    );
    await assert.rejects(
      writeFinalRankingMovement({
        visualisation,
        svgPath: "../escaped.local.svg",
        manifestPath:
          "exports/escaped.local.ranking-movement.json",
        workingDirectory: temporaryDirectory,
      }),
      /must stay inside exports/,
    );
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }

  assert.throws(
    () =>
      buildFinalRankingMovement({
        ...buildArgs,
        selected: routeResult([
          "private-c",
          "private-a",
          "private-f",
          "private-b",
          "private-e",
          "private-new",
        ]),
      }),
    /same candidate pool/,
  );
  assert.throws(
    () =>
      buildFinalRankingMovement({
        ...buildArgs,
        selected: {
          ...selected,
          fundingRoundAirtableId: "different-round",
        },
      }),
    /different queries/,
  );
  assert.throws(
    () => buildFinalRankingMovement({ ...buildArgs, topN: 11 }),
    /topN must be between/,
  );

  console.log("Final ranking movement check passed.");
  console.log(
    "Checked anonymous rank changes, candidate identity, hashes and private output guards.",
  );
}

main().catch(error => {
  console.error(
    `Final ranking movement check failed: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exitCode = 1;
});
