import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type {
  AirtableFundingRound,
  AirtableStartup,
  Investor,
} from "../services/airtable";
import {
  buildFeedbackMatchingConfigHash,
  runFeedbackComparison,
} from "../services/feedback-comparison-runner";
import { buildFeedbackExperimentDefinition } from "../services/feedback-experiment";
import {
  selectCuratedFeedback,
  type FeedbackSelectionInput,
} from "../services/feedback-selection";
import { getDefaultMatchingConfig } from "../services/matching-config";
import { buildSemanticComparisonIdentity } from "../services/semantic-comparison";
import type { SemanticScorer } from "../services/semantic-scorer";

function hash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

const startup: AirtableStartup = {
  id: "startup-feedback-check",
  name: "Feedback check startup",
  description: "Develops industrial energy efficiency software.",
};

const fundingRound: AirtableFundingRound = {
  id: "round-feedback-check",
  roundStage: "Seed",
  roundSectors: ["Energy"],
  roundGeography: "United Kingdom",
  investmentTypes: ["Equity"],
};

const investors: Investor[] = Array.from({ length: 12 }, (_, index) => ({
  id: `investor-${String(index + 1).padStart(2, "0")}`,
  organisation: `Feedback investor ${index + 1}`,
  description: "Invests in early-stage industrial energy efficiency companies.",
  investmentStage: ["Seed"],
  sectorFocus: ["Energy"],
  regionalFocus: ["United Kingdom"],
  investmentInstruments: ["Equity"],
}));

const feedbackEntries: FeedbackSelectionInput[] = [
  {
    feedbackId: "feedback-positive",
    investorId: "private-investor-positive",
    investorName: "Private Positive Investor",
    fundingRoundId: "historical-round-positive",
    startupName: "Private Positive Startup",
    rating: "up",
    reason: "The investor has useful industrial climate experience.",
    evidenceGroup: "useful",
    createdAt: "2026-07-01T09:00:00.000Z",
  },
  {
    feedbackId: "feedback-negative",
    investorId: "private-investor-negative",
    investorName: "Private Negative Investor",
    fundingRoundId: "historical-round-negative",
    startupName: "Private Negative Startup",
    rating: "down",
    reason: "The ticket range is too small for the round.",
    evidenceGroup: "useful",
    createdAt: "2026-07-02T09:00:00.000Z",
  },
];

async function main() {
  const config = getDefaultMatchingConfig();
  const selection = selectCuratedFeedback({
    feedbackSetVersion: "curated-feedback-2026-07-21",
    entries: feedbackEntries,
    evaluationFundingRoundIds: [fundingRound.id, "round-2", "round-3"],
    maxPerRating: 2,
  });
  const candidateIdentity = buildSemanticComparisonIdentity({
    queryId: "query-feedback-check",
    startupId: startup.id,
    fundingRoundId: fundingRound.id,
    investorIds: investors.map(({ id }) => id),
  });
  const definition = buildFeedbackExperimentDefinition({
    matchingConfigHash: buildFeedbackMatchingConfigHash(config),
    feedbackSetVersion: selection.feedbackSetVersion,
    feedbackSetHash: selection.feedbackSetHash,
    queries: [
      {
        queryId: candidateIdentity.queryId,
        startupId: candidateIdentity.startupId,
        fundingRoundId: candidateIdentity.fundingRoundId,
        candidatePoolHash: candidateIdentity.candidatePoolHash,
      },
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
  const scorerContexts: string[] = [];
  const scorer: SemanticScorer = async (
    _startupContext,
    _investorContext,
    feedbackContext,
  ) => {
    scorerContexts.push(feedbackContext);
    return {
      score: feedbackContext ? 80 : 40,
      exclusion_found: false,
      insight: feedbackContext ? "Curated feedback run" : "No feedback control",
    };
  };
  const originalInvestorIds = investors.map(({ id }) => id);
  const comparison = await runFeedbackComparison(
    {
      queryId: candidateIdentity.queryId,
      fundingRound,
      startup,
      investors,
      config,
      selection,
      definition,
      maxFeedbackContextCharacters: 2000,
    },
    { semanticScorer: scorer },
  );

  assert.deepEqual(investors.map(({ id }) => id), originalInvestorIds);
  assert.equal(comparison.query.candidatePoolHash, candidateIdentity.candidatePoolHash);
  assert.equal(comparison.feedbackContext.feedbackSetHash, selection.feedbackSetHash);
  assert.deepEqual(
    comparison.runs.map(({ feedbackMode }) => feedbackMode),
    ["none", "curated"],
  );
  assert.ok(comparison.runs.every(({ matches }) => matches.length === 10));
  assert.ok(
    comparison.runs[0].matches.every(
      match => match.scoreBreakdown.semanticScore === 40,
    ),
  );
  assert.ok(
    comparison.runs[1].matches.every(
      match => match.scoreBreakdown.semanticScore === 80,
    ),
  );
  const controlContexts = scorerContexts.slice(0, investors.length);
  const curatedContexts = scorerContexts.slice(investors.length);
  assert.ok(controlContexts.every(context => context === ""));
  assert.ok(curatedContexts.every(context => context.startsWith("\n\nCURATED")));
  assert.match(curatedContexts[0], /ticket range is too small/);
  assert.match(curatedContexts[0], /useful industrial climate experience/);
  assert.doesNotMatch(
    JSON.stringify(comparison),
    /Private Positive|Private Negative|ticket range|industrial climate experience/,
  );

  await assert.rejects(
    () => runFeedbackComparison({
      queryId: candidateIdentity.queryId,
      fundingRound,
      startup,
      investors: investors.slice(1),
      config,
      selection,
      definition,
      maxFeedbackContextCharacters: 2000,
    }),
    /candidate pool does not match/,
  );
  await assert.rejects(
    () => runFeedbackComparison({
      queryId: candidateIdentity.queryId,
      fundingRound,
      startup,
      investors,
      config: {
        ...config,
        weights: { ...config.weights, semantic: 0.2 },
      },
      selection,
      definition,
      maxFeedbackContextCharacters: 2000,
    }),
    /configuration does not match/,
  );

  console.log("Feedback comparison runner check passed.");
  console.log("Checked shared inputs, controlled context injection, private output, and top-ten runs.");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
