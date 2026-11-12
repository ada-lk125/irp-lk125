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
import type { FinalMatcherHandoff } from "../services/final-matcher-handoff";
import {
  runFinalMatcher,
  validateFinalMatcherResults,
} from "../services/final-matcher-runtime";
import { getDefaultMatchingConfig } from "../services/matching-config";
import type { SemanticScorer } from "../services/semantic-scorer";

const implementationCommitSha = "1".repeat(40);
const startup: AirtableStartup = {
  id: "startup-runtime-check",
  name: "Runtime check startup",
  description: "Develops industrial energy efficiency software.",
};
const fundingRound: AirtableFundingRound = {
  id: "round-runtime-check",
  roundStage: "Seed",
  roundSectors: ["Energy"],
  roundGeography: "United Kingdom",
  investmentTypes: ["Equity"],
};
const investors: Investor[] = Array.from({ length: 12 }, (_, index) => ({
  id: `investor-${String(index + 1).padStart(2, "0")}`,
  organisation: `Runtime investor ${index + 1}`,
  description: "Invests in early-stage industrial energy companies.",
  investmentStage: ["Seed"],
  sectorFocus: ["Energy"],
  regionalFocus: ["United Kingdom"],
  investmentInstruments: ["Equity"],
}));
const feedbackEntries: FeedbackSelectionInput[] = [
  {
    feedbackId: "positive-feedback",
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
    feedbackId: "negative-feedback",
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

async function main() {
  const config = getDefaultMatchingConfig();
  const selection = selectCuratedFeedback({
    feedbackSetVersion: "curated-runtime-check",
    entries: feedbackEntries,
    evaluationFundingRoundIds: [
      fundingRound.id,
      "evaluation-round-two",
      "evaluation-round-three",
    ],
    maxPerRating: 2,
  });
  const baseHandoff: FinalMatcherHandoff = {
    schemaVersion: "final-matcher-handoff-v1",
    createdAt: "2026-07-28T12:00:00.000Z",
    batchId: "fictional-runtime-batch",
    selectedMethod: "curated_feedback",
    semanticMethod: "gpt-semantic",
    aiModel: config.aiModel,
    matchingConfigHash: buildFeedbackMatchingConfigHash(config),
    feedbackSetHash: selection.feedbackSetHash,
    implementationCommitSha,
    evaluation: {
      evidencePattern: "consistent-improvement",
      recommendation: "review-curated-candidate",
      reviewOutcome: "approve-curated",
    },
    sources: {
      receipt: {
        fileName: "feedback.local.receipt.json",
        sha256: "a".repeat(64),
      },
      decision: {
        fileName: "feedback.local.decision.json",
        sha256: "b".repeat(64),
      },
      visualisation: {
        fileName: "feedback.local.visualisation.json",
        sha256: "c".repeat(64),
      },
      errorReview: {
        fileName: "feedback.local.error-review.json",
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
  const contexts: string[] = [];
  const scorer: SemanticScorer = async (
    _startupContext,
    _investorContext,
    feedbackContext,
  ) => {
    contexts.push(feedbackContext);
    return {
      score: feedbackContext ? 80 : 45,
      exclusion_found: false,
      insight: feedbackContext
        ? "Curated runtime path"
        : "No-feedback runtime path",
    };
  };

  const curated = await runFinalMatcher(
    {
      handoff: baseHandoff,
      implementationCommitSha,
      fundingRound,
      startup,
      investors,
      config,
      selection,
      maxFeedbackContextCharacters: 2000,
    },
    { semanticScorer: scorer },
  );
  assert.equal(curated.selectedMethod, "curated_feedback");
  assert.equal(curated.matches.length, investors.length);
  assert.ok(
    curated.matches.every(
      result => result.scoreBreakdown.semanticScore === 80,
    ),
  );
  assert.ok(contexts.every(context => context.startsWith("\n\nCURATED")));
  assert.doesNotMatch(
    JSON.stringify(curated),
    /ticket range did not fit|Industrial climate experience was useful/,
  );

  contexts.length = 0;
  const control = await runFinalMatcher(
    {
      handoff: {
        ...baseHandoff,
        selectedMethod: "no_feedback_gpt",
        evaluation: {
          evidencePattern: "mixed",
          recommendation: "keep-control",
          reviewOutcome: "keep-control",
        },
      },
      implementationCommitSha,
      fundingRound,
      startup,
      investors,
      config,
      maxFeedbackContextCharacters: 2000,
    },
    { semanticScorer: scorer },
  );
  assert.equal(control.selectedMethod, "no_feedback_gpt");
  assert.equal(control.feedbackSetHash, null);
  assert.ok(contexts.every(context => context === ""));

  await assert.rejects(
    runFinalMatcher({
      handoff: baseHandoff,
      implementationCommitSha,
      fundingRound,
      startup,
      investors,
      config: {
        ...config,
        weights: { ...config.weights, semantic: 0.2 },
      },
      selection,
      maxFeedbackContextCharacters: 2000,
    }),
    /configuration does not match/,
  );
  await assert.rejects(
    runFinalMatcher({
      handoff: baseHandoff,
      implementationCommitSha: "2".repeat(40),
      fundingRound,
      startup,
      investors,
      config,
      selection,
      maxFeedbackContextCharacters: 2000,
    }),
    /implementation commit does not match/,
  );
  await assert.rejects(
    runFinalMatcher({
      handoff: baseHandoff,
      implementationCommitSha,
      fundingRound,
      startup,
      investors,
      config,
      selection: {
        ...selection,
        feedbackSetHash: "f".repeat(64),
      },
      maxFeedbackContextCharacters: 2000,
    }),
    /feedback set does not match/,
  );
  await assert.rejects(
    runFinalMatcher({
      handoff: {
        ...baseHandoff,
        selectedMethod: "unsupported" as FinalMatcherHandoff["selectedMethod"],
      },
      implementationCommitSha,
      fundingRound,
      startup,
      investors,
      config,
      maxFeedbackContextCharacters: 2000,
    }),
    /unsupported method/,
  );
  await assert.rejects(
    runFinalMatcher({
      handoff: {
        ...baseHandoff,
        resultContract: {
          ...baseHandoff.resultContract,
          aiInsight: false,
        } as unknown as FinalMatcherHandoff["resultContract"],
      },
      implementationCommitSha,
      fundingRound,
      startup,
      investors,
      config,
      selection,
      maxFeedbackContextCharacters: 2000,
    }),
    /frontend result contract/,
  );

  const unsorted = [...curated.matches];
  unsorted[0] = {
    ...unsorted[0],
    scoreBreakdown: {
      ...unsorted[0].scoreBreakdown,
      totalScore: 0,
    },
  };
  assert.throws(
    () =>
      validateFinalMatcherResults({
        matches: unsorted,
        expectedCount: investors.length,
      }),
    /sorted by totalScore/,
  );

  console.log("Final matcher runtime check passed.");
  console.log(
    "Checked handoff identity, selected feedback, interface fields and result ordering.",
  );
}

main().catch(error => {
  console.error(
    `Final matcher runtime check failed: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exitCode = 1;
});
