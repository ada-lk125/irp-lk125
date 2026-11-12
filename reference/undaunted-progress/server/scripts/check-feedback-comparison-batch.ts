import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type {
  AirtableFundingRound,
  AirtableStartup,
  Investor,
} from "../services/airtable";
import {
  FEEDBACK_COMPARISON_BATCH_SCHEMA_VERSION,
  prepareFeedbackComparisonBatchInputs,
  runFeedbackComparisonBatch,
  type FeedbackComparisonBatchQueryInput,
} from "../services/feedback-comparison-batch";
import { buildFeedbackMatchingConfigHash } from "../services/feedback-comparison-runner";
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

function queryInput(queryNumber: number): FeedbackComparisonBatchQueryInput {
  const queryId = `query-${queryNumber}`;
  const startup: AirtableStartup = {
    id: `startup-${queryNumber}`,
    name: `Offline startup ${queryNumber}`,
  };
  const fundingRound: AirtableFundingRound = {
    id: `round-${queryNumber}`,
    roundStage: "Seed",
  };
  const investors: Investor[] = Array.from({ length: 12 }, (_, index) => ({
    id: `${queryId}-investor-${String(index + 1).padStart(2, "0")}`,
    organisation: `Offline investor ${queryNumber}-${index + 1}`,
    description: "Invests in early-stage energy software.",
    investmentStage: ["Seed"],
    sectorFocus: ["Energy"],
    regionalFocus: ["United Kingdom"],
    investmentInstruments: ["Equity"],
  }));
  return { queryId, startup, fundingRound, investors };
}

function buildDefinition(
  inputs: readonly FeedbackComparisonBatchQueryInput[],
  options: {
    matchingConfigHash?: string;
    feedbackSetVersion?: string;
    feedbackSetHash?: string;
  } = {},
) {
  return buildFeedbackExperimentDefinition({
    matchingConfigHash: options.matchingConfigHash ?? hash("fixed-feedback-config"),
    feedbackSetVersion:
      options.feedbackSetVersion ?? "curated-feedback-2026-07-23",
    feedbackSetHash: options.feedbackSetHash ?? hash("curated-feedback-set"),
    queries: inputs.map(input => {
      const identity = buildSemanticComparisonIdentity({
        queryId: input.queryId,
        startupId: input.startup.id,
        fundingRoundId: input.fundingRound.id,
        investorIds: input.investors.map(({ id }) => id),
      });
      return {
        queryId: identity.queryId,
        startupId: identity.startupId,
        fundingRoundId: identity.fundingRoundId,
        candidatePoolHash: identity.candidatePoolHash,
      };
    }),
  });
}

const feedbackEntries: FeedbackSelectionInput[] = [
  {
    feedbackId: "feedback-useful-up",
    investorId: "historical-investor-up",
    investorName: "Historical positive investor",
    fundingRoundId: "historical-round-up",
    startupName: "Historical positive startup",
    rating: "up",
    reason: "The investor has relevant energy software experience.",
    evidenceGroup: "useful",
    createdAt: "2026-07-01T09:00:00.000Z",
  },
  {
    feedbackId: "feedback-useful-down",
    investorId: "historical-investor-down",
    investorName: "Historical negative investor",
    fundingRoundId: "historical-round-down",
    startupName: "Historical negative startup",
    rating: "down",
    reason: "The investor's ticket range did not fit the round.",
    evidenceGroup: "useful",
    createdAt: "2026-07-02T09:00:00.000Z",
  },
];

async function main() {
  const inputs = [queryInput(1), queryInput(2), queryInput(3)];
  const definition = buildDefinition(inputs);
  const originalOrder = inputs.map(({ queryId }) => queryId);
  const prepared = prepareFeedbackComparisonBatchInputs({
    inputs: [inputs[2], inputs[0], inputs[1]],
    definition,
  });

  assert.deepEqual(prepared.summary.queryIds, originalOrder);
  assert.deepEqual(prepared.summary.candidateCounts, {
    "query-1": 12,
    "query-2": 12,
    "query-3": 12,
  });
  assert.equal(prepared.summary.totalCandidateCount, 36);
  assert.deepEqual(inputs.map(({ queryId }) => queryId), originalOrder);

  assert.throws(
    () => prepareFeedbackComparisonBatchInputs({
      inputs: [inputs[0], inputs[0], inputs[2]],
      definition,
    }),
    /repeats query query-1/,
  );
  assert.throws(
    () => prepareFeedbackComparisonBatchInputs({
      inputs: inputs.slice(0, 2),
      definition,
    }),
    /requires exactly three query inputs/,
  );

  const wrongRound = structuredClone(inputs);
  wrongRound[1].fundingRound.id = "different-round";
  assert.throws(
    () => prepareFeedbackComparisonBatchInputs({ inputs: wrongRound, definition }),
    /does not match its startup and funding round/,
  );

  const changedPool = structuredClone(inputs);
  changedPool[2].investors[0].id = "replacement-investor";
  assert.throws(
    () => prepareFeedbackComparisonBatchInputs({ inputs: changedPool, definition }),
    /does not match its fixed candidate pool/,
  );

  const repeatedInvestor = structuredClone(inputs);
  repeatedInvestor[0].investors[1].id = repeatedInvestor[0].investors[0].id;
  assert.throws(
    () => prepareFeedbackComparisonBatchInputs({
      inputs: repeatedInvestor,
      definition,
    }),
    /contains duplicate investor candidates/,
  );

  const shortPool = structuredClone(inputs);
  shortPool[0].investors = shortPool[0].investors.slice(0, 9);
  assert.throws(
    () => prepareFeedbackComparisonBatchInputs({ inputs: shortPool, definition }),
    /requires at least 10 investor candidates/,
  );

  const config = getDefaultMatchingConfig();
  const selection = selectCuratedFeedback({
    feedbackSetVersion: "curated-feedback-2026-07-23",
    entries: feedbackEntries,
    evaluationFundingRoundIds: inputs.map(({ fundingRound }) => fundingRound.id),
    maxPerRating: 2,
  });
  const runnableDefinition = buildDefinition(inputs, {
    matchingConfigHash: buildFeedbackMatchingConfigHash(config),
    feedbackSetVersion: selection.feedbackSetVersion,
    feedbackSetHash: selection.feedbackSetHash,
  });
  const scorerContexts: string[] = [];
  const scorer: SemanticScorer = async (
    _startupContext,
    _investorContext,
    feedbackContext,
  ) => {
    scorerContexts.push(feedbackContext);
    return {
      score: feedbackContext ? 75 : 45,
      exclusion_found: false,
      insight: feedbackContext ? "Curated batch run" : "Control batch run",
    };
  };
  const progressModes = new Set<string>();
  const batch = await runFeedbackComparisonBatch(
    {
      inputs: [inputs[1], inputs[2], inputs[0]],
      config,
      selection,
      definition: runnableDefinition,
      maxFeedbackContextCharacters: 2000,
      onProgress: (queryId, feedbackMode) =>
        progressModes.add(`${queryId}:${feedbackMode}`),
    },
    { semanticScorer: scorer },
  );

  assert.equal(batch.schemaVersion, FEEDBACK_COMPARISON_BATCH_SCHEMA_VERSION);
  assert.deepEqual(batch.summary.queryIds, originalOrder);
  assert.equal(batch.comparisons.length, 3);
  assert.deepEqual(
    batch.comparisons.map(({ query }) => query.queryId),
    originalOrder,
  );
  assert.ok(
    batch.comparisons.every(comparison =>
      comparison.feedbackContext.feedbackSetHash === selection.feedbackSetHash
      && comparison.runs[0].feedbackMode === "none"
      && comparison.runs[1].feedbackMode === "curated"
      && comparison.runs.every(({ matches }) => matches.length === 10),
    ),
  );
  assert.equal(progressModes.size, 6);
  assert.ok(scorerContexts.some(context => context === ""));
  assert.ok(scorerContexts.some(context => context.startsWith("\n\nCURATED")));

  const scorerCallCount = scorerContexts.length;
  await assert.rejects(
    () => runFeedbackComparisonBatch(
      {
        inputs,
        config: {
          ...config,
          weights: { ...config.weights, semantic: 0.2 },
        },
        selection,
        definition: runnableDefinition,
        maxFeedbackContextCharacters: 2000,
      },
      { semanticScorer: scorer },
    ),
    /configuration does not match/,
  );
  assert.equal(scorerContexts.length, scorerCallCount);

  console.log("Feedback comparison batch input check passed.");
  console.log("Checked three fixed query inputs and their controlled serial runs.");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
