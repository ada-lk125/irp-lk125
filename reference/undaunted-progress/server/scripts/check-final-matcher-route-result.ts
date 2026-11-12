import assert from "node:assert/strict";
import type {
  AirtableFundingRound,
  AirtableStartup,
  Investor,
} from "../services/airtable";
import { buildFeedbackMatchingConfigHash } from "../services/feedback-comparison-runner";
import type { FinalMatcherHandoff } from "../services/final-matcher-handoff";
import {
  buildFinalMatcherRouteResult,
  validateFinalMatcherRouteResult,
} from "../services/final-matcher-route-result";
import { runFinalMatcher } from "../services/final-matcher-runtime";
import { getDefaultMatchingConfig } from "../services/matching-config";
import type { SemanticScorer } from "../services/semantic-scorer";

const startup: AirtableStartup = {
  id: "startup-route-check",
  name: "Route check startup",
  description: "Builds software for industrial energy efficiency.",
};

const fundingRound: AirtableFundingRound = {
  id: "round-route-check",
  roundStage: "Seed",
  roundSectors: ["Energy"],
  roundGeography: "United Kingdom",
  investmentTypes: ["Equity"],
};

const investors: Investor[] = Array.from({ length: 4 }, (_, index) => ({
  id: `route-investor-${index + 1}`,
  organisation: `Route Investor ${index + 1}`,
  description: "Invests in early-stage industrial energy companies.",
  investmentStage: ["Seed"],
  sectorFocus: ["Energy"],
  regionalFocus: ["United Kingdom"],
  investmentInstruments: ["Equity"],
}));

async function main() {
  const config = getDefaultMatchingConfig();
  const implementationCommitSha = "1".repeat(40);
  const handoff: FinalMatcherHandoff = {
    schemaVersion: "final-matcher-handoff-v1",
    createdAt: "2026-07-29T09:00:00.000Z",
    batchId: "fictional-route-check",
    selectedMethod: "no_feedback_gpt",
    semanticMethod: "gpt-semantic",
    aiModel: config.aiModel,
    matchingConfigHash: buildFeedbackMatchingConfigHash(config),
    feedbackSetHash: "a".repeat(64),
    implementationCommitSha,
    evaluation: {
      evidencePattern: "mixed",
      recommendation: "keep-control",
      reviewOutcome: "keep-control",
    },
    sources: {
      receipt: {
        fileName: "feedback.local.receipt.json",
        sha256: "b".repeat(64),
      },
      decision: {
        fileName: "feedback.local.decision.json",
        sha256: "c".repeat(64),
      },
      visualisation: {
        fileName: "feedback.local.visualisation.json",
        sha256: "d".repeat(64),
      },
      errorReview: {
        fileName: "feedback.local.error-review.json",
        sha256: "e".repeat(64),
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
  const progressPhases: string[] = [];
  const scorer: SemanticScorer = async () => ({
    score: 70,
    exclusion_found: false,
    insight: "Route compatibility check",
  });
  const runtime = await runFinalMatcher(
    {
      handoff,
      implementationCommitSha,
      fundingRound,
      startup,
      investors,
      config,
      maxFeedbackContextCharacters: 2000,
      onProgress: progress => progressPhases.push(progress.phase),
    },
    { semanticScorer: scorer },
  );
  const routeResult = buildFinalMatcherRouteResult({
    runtime,
    startupAirtableId: startup.id,
    fundingRoundAirtableId: fundingRound.id,
  });
  const parsed = validateFinalMatcherRouteResult(
    JSON.parse(JSON.stringify(routeResult)),
  );

  assert.deepEqual(Object.keys(parsed).sort(), [
    "fundingRoundAirtableId",
    "matches",
    "startupAirtableId",
  ]);
  assert.equal(parsed.matches.length, investors.length);
  assert.equal(progressPhases.at(-1), "finalizing");
  assert.ok(
    parsed.matches.every(
      (match, index) =>
        index === 0
        || match.scoreBreakdown.totalScore
          <= parsed.matches[index - 1].scoreBreakdown.totalScore,
    ),
  );

  const frontendMatchMap = new Map(
    parsed.matches.map(match => [match.investor.id, match]),
  );
  assert.equal(frontendMatchMap.size, investors.length);
  assert.ok(
    parsed.matches.every(
      match =>
        Number.isFinite(match.scoreBreakdown.totalScore)
        && Array.isArray(match.matchReasons)
        && typeof match.aiInsight === "string",
    ),
  );
  assert.doesNotMatch(
    JSON.stringify(parsed),
    /selectedMethod|matchingConfigHash|feedbackSetHash/,
  );

  assert.throws(
    () =>
      buildFinalMatcherRouteResult({
        runtime: {
          ...runtime,
          feedbackSetHash: "f".repeat(64),
        },
        startupAirtableId: startup.id,
        fundingRoundAirtableId: fundingRound.id,
      }),
    /must not include a feedback-set hash/,
  );

  const extraField = {
    ...parsed,
    selectedMethod: "no_feedback_gpt",
  };
  assert.throws(
    () => validateFinalMatcherRouteResult(extraField),
    /route contract/,
  );

  const duplicate = JSON.parse(JSON.stringify(parsed));
  duplicate.matches[1].investor.id = duplicate.matches[0].investor.id;
  assert.throws(
    () => validateFinalMatcherRouteResult(duplicate),
    /duplicate investor ID/,
  );

  console.log("Final matcher route result check passed.");
  console.log(
    "Checked API fields, frontend lookup keys, JSON round-trip and saved-result ordering.",
  );
}

main().catch(error => {
  console.error(
    `Final matcher route result check failed: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exitCode = 1;
});
