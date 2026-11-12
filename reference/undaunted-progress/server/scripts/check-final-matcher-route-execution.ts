import assert from "node:assert/strict";
import type {
  AirtableFundingRound,
  AirtableStartup,
  Investor,
} from "../services/airtable";
import { buildFeedbackMatchingConfigHash } from "../services/feedback-comparison-runner";
import {
  selectCuratedFeedback,
  type FeedbackSelectionInput,
} from "../services/feedback-selection";
import type {
  FinalMatcherHandoff,
  FinalMatcherMethod,
} from "../services/final-matcher-handoff";
import { executeFinalMatcherRoute } from "../services/final-matcher-route-execution";
import { getDefaultMatchingConfig } from "../services/matching-config";
import type {
  MatchProgress,
  MatchingConfig,
} from "../services/matching";
import type { SemanticScorer } from "../services/semantic-scorer";

const implementationCommitSha = "1".repeat(40);
const startup: AirtableStartup = {
  id: "startup-route-execution",
  name: "Route execution startup",
  description: "Develops software for industrial energy efficiency.",
};
const fundingRound: AirtableFundingRound = {
  id: "round-route-execution",
  roundStage: "Seed",
  roundSectors: ["Energy"],
  roundGeography: "United Kingdom",
  investmentTypes: ["Equity"],
};
const investors: Investor[] = Array.from({ length: 6 }, (_, index) => ({
  id: `route-execution-investor-${index + 1}`,
  organisation: `Route execution investor ${index + 1}`,
  description: "Invests in early-stage industrial energy companies.",
  investmentStage: ["Seed"],
  sectorFocus: ["Energy"],
  regionalFocus: ["United Kingdom"],
  investmentInstruments: ["Equity"],
}));
const feedbackEntries: FeedbackSelectionInput[] = [
  {
    feedbackId: "historical-positive",
    investorId: "historical-investor-one",
    investorName: "Historical Investor One",
    fundingRoundId: "historical-round-one",
    startupName: "Historical Startup One",
    rating: "up",
    reason: "Industrial climate experience was useful.",
    evidenceGroup: "useful",
    createdAt: "2026-07-01T09:00:00.000Z",
  },
  {
    feedbackId: "historical-negative",
    investorId: "historical-investor-two",
    investorName: "Historical Investor Two",
    fundingRoundId: "historical-round-two",
    startupName: "Historical Startup Two",
    rating: "down",
    reason: "The ticket range did not fit the round.",
    evidenceGroup: "useful",
    createdAt: "2026-07-02T09:00:00.000Z",
  },
];

function handoff(args: {
  method: FinalMatcherMethod;
  config: MatchingConfig;
  feedbackSetHash: string;
}): FinalMatcherHandoff {
  const curated = args.method === "curated_feedback";
  return {
    schemaVersion: "final-matcher-handoff-v1",
    createdAt: "2026-07-30T09:00:00.000Z",
    batchId: "fictional-route-execution",
    selectedMethod: args.method,
    semanticMethod: "gpt-semantic",
    aiModel: args.config.aiModel,
    matchingConfigHash: buildFeedbackMatchingConfigHash(args.config),
    feedbackSetHash: args.feedbackSetHash,
    implementationCommitSha,
    evaluation: curated
      ? {
          evidencePattern: "consistent-improvement",
          recommendation: "review-curated-candidate",
          reviewOutcome: "approve-curated",
        }
      : {
          evidencePattern: "mixed",
          recommendation: "keep-control",
          reviewOutcome: "keep-control",
        },
    sources: {
      receipt: {
        fileName: "route-execution.local.receipt.json",
        sha256: "a".repeat(64),
      },
      decision: {
        fileName: "route-execution.local.decision.json",
        sha256: "b".repeat(64),
      },
      visualisation: {
        fileName: "route-execution.local.visualisation.json",
        sha256: "c".repeat(64),
      },
      errorReview: {
        fileName: "route-execution.local.error-review.json",
        sha256: "d".repeat(64),
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
}

async function main() {
  const config = getDefaultMatchingConfig();
  const selection = selectCuratedFeedback({
    feedbackSetVersion: "route-execution-selection",
    entries: feedbackEntries,
    evaluationFundingRoundIds: [
      fundingRound.id,
      "evaluation-round-two",
      "evaluation-round-three",
    ],
    maxPerRating: 2,
  });
  const contexts: string[] = [];
  const scorer: SemanticScorer = async (
    _startupContext,
    _investorContext,
    feedbackContext,
  ) => {
    contexts.push(feedbackContext);
    return {
      score: feedbackContext ? 80 : 60,
      exclusion_found: false,
      insight: feedbackContext
        ? "Curated route execution"
        : "Control route execution",
    };
  };

  const controlProgress: MatchProgress[] = [];
  const investorsBefore = JSON.stringify(investors);
  const control = await executeFinalMatcherRoute(
    {
      handoff: handoff({
        method: "no_feedback_gpt",
        config,
        feedbackSetHash: selection.feedbackSetHash,
      }),
      implementationCommitSha,
      startup,
      fundingRound,
      investors,
      config,
      maxFeedbackContextCharacters: 2000,
      onProgress: progress => controlProgress.push(progress),
    },
    { semanticScorer: scorer },
  );
  assert.equal(control.startupAirtableId, startup.id);
  assert.equal(control.fundingRoundAirtableId, fundingRound.id);
  assert.equal(control.matches.length, investors.length);
  assert.equal(controlProgress.at(-1)?.phase, "complete");
  assert.equal(
    controlProgress.filter(progress => progress.phase === "complete").length,
    1,
  );
  assert.ok(contexts.every(context => context === ""));
  assert.equal(JSON.stringify(investors), investorsBefore);
  assert.doesNotMatch(
    JSON.stringify(control),
    /selectedMethod|matchingConfigHash|feedbackSetHash|implementationCommitSha/,
  );

  contexts.length = 0;
  const curatedProgress: MatchProgress[] = [];
  const curated = await executeFinalMatcherRoute(
    {
      handoff: handoff({
        method: "curated_feedback",
        config,
        feedbackSetHash: selection.feedbackSetHash,
      }),
      implementationCommitSha,
      startup,
      fundingRound,
      investors,
      config,
      selection,
      maxFeedbackContextCharacters: 2000,
      onProgress: progress => curatedProgress.push(progress),
    },
    { semanticScorer: scorer },
  );
  assert.equal(curated.matches.length, investors.length);
  assert.equal(curatedProgress.at(-1)?.phase, "complete");
  assert.ok(contexts.every(context => context.startsWith("\n\nCURATED")));
  assert.doesNotMatch(
    JSON.stringify(curated),
    /Industrial climate experience was useful|ticket range did not fit/,
  );

  const failedProgress: MatchProgress[] = [];
  await assert.rejects(
    executeFinalMatcherRoute({
      handoff: handoff({
        method: "no_feedback_gpt",
        config,
        feedbackSetHash: selection.feedbackSetHash,
      }),
      implementationCommitSha,
      startup,
      fundingRound,
      investors,
      config: {
        ...config,
        weights: { ...config.weights, semantic: 0.2 },
      },
      maxFeedbackContextCharacters: 2000,
      onProgress: progress => failedProgress.push(progress),
    }),
    /configuration does not match/,
  );
  assert.ok(failedProgress.every(progress => progress.phase !== "complete"));
  await assert.rejects(
    executeFinalMatcherRoute({
      handoff: handoff({
        method: "no_feedback_gpt",
        config,
        feedbackSetHash: selection.feedbackSetHash,
      }),
      implementationCommitSha,
      startup,
      fundingRound,
      investors: [],
      config,
      maxFeedbackContextCharacters: 2000,
    }),
    /at least one investor/,
  );
  await assert.rejects(
    executeFinalMatcherRoute({
      handoff: handoff({
        method: "no_feedback_gpt",
        config,
        feedbackSetHash: selection.feedbackSetHash,
      }),
      implementationCommitSha,
      startup: { ...startup, id: "" },
      fundingRound,
      investors,
      config,
      maxFeedbackContextCharacters: 2000,
    }),
    /startup.id/,
  );

  console.log("Final matcher route execution check passed.");
  console.log(
    "Checked both selected methods, progress completion, current route fields and rejected invalid inputs.",
  );
}

main().catch(error => {
  console.error(
    `Final matcher route execution check failed: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exitCode = 1;
});
