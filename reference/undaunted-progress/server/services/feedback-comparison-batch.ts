import type {
  AirtableFundingRound,
  AirtableStartup,
  Investor,
} from "./airtable";
import {
  runFeedbackComparison,
  type FeedbackComparisonRun,
} from "./feedback-comparison-runner";
import type { FeedbackExperimentDefinition } from "./feedback-experiment";
import type { CuratedFeedbackSelection } from "./feedback-selection";
import type { MatchProgress, MatchingConfig } from "./matching";
import { buildSemanticComparisonIdentity } from "./semantic-comparison";
import type { SemanticScorer } from "./semantic-scorer";

export const FEEDBACK_COMPARISON_BATCH_SCHEMA_VERSION =
  "feedback-comparison-batch-v1";

export interface FeedbackComparisonBatchQueryInput {
  queryId: string;
  startup: AirtableStartup;
  fundingRound: AirtableFundingRound;
  investors: Investor[];
}

export interface FeedbackComparisonBatchInputSummary {
  queryIds: string[];
  candidateCounts: Record<string, number>;
  totalCandidateCount: number;
}

export interface PreparedFeedbackComparisonBatch {
  inputs: FeedbackComparisonBatchQueryInput[];
  summary: FeedbackComparisonBatchInputSummary;
}

export interface FeedbackComparisonBatchRun {
  schemaVersion: typeof FEEDBACK_COMPARISON_BATCH_SCHEMA_VERSION;
  summary: FeedbackComparisonBatchInputSummary;
  comparisons: FeedbackComparisonRun[];
}

function requireIdentifier(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty identifier.`);
  }
  return value.trim();
}

export function prepareFeedbackComparisonBatchInputs(args: {
  inputs: readonly FeedbackComparisonBatchQueryInput[];
  definition: FeedbackExperimentDefinition;
}): PreparedFeedbackComparisonBatch {
  if (args.definition.queries.length !== 3) {
    throw new Error("The feedback comparison definition must contain three queries.");
  }
  if (args.inputs.length !== 3) {
    throw new Error("The feedback comparison batch requires exactly three query inputs.");
  }

  const inputByQueryId = new Map<string, FeedbackComparisonBatchQueryInput>();
  args.inputs.forEach((input, inputIndex) => {
    const queryId = requireIdentifier(input.queryId, `inputs[${inputIndex}].queryId`);
    if (inputByQueryId.has(queryId)) {
      throw new Error(`The feedback comparison batch repeats query ${queryId}.`);
    }

    requireIdentifier(input.startup.id, `inputs[${inputIndex}].startup.id`);
    requireIdentifier(
      input.fundingRound.id,
      `inputs[${inputIndex}].fundingRound.id`,
    );
    if (input.investors.length < args.definition.topK) {
      throw new Error(
        `Query ${queryId} requires at least ${args.definition.topK} investor candidates.`,
      );
    }

    const investorIds = input.investors.map((investor, investorIndex) =>
      requireIdentifier(
        investor.id,
        `inputs[${inputIndex}].investors[${investorIndex}].id`,
      ),
    );
    if (new Set(investorIds).size !== investorIds.length) {
      throw new Error(`Query ${queryId} contains duplicate investor candidates.`);
    }

    inputByQueryId.set(queryId, {
      ...input,
      queryId,
      investors: [...input.investors],
    });
  });

  const candidateCounts: Record<string, number> = {};
  const inputs = args.definition.queries.map(query => {
    const input = inputByQueryId.get(query.queryId);
    if (!input) {
      throw new Error(`The feedback comparison batch is missing query ${query.queryId}.`);
    }
    if (
      input.startup.id !== query.startupId
      || input.fundingRound.id !== query.fundingRoundId
    ) {
      throw new Error(
        `Query ${query.queryId} does not match its startup and funding round.`,
      );
    }

    const identity = buildSemanticComparisonIdentity({
      queryId: input.queryId,
      startupId: input.startup.id,
      fundingRoundId: input.fundingRound.id,
      investorIds: input.investors.map(({ id }) => id),
    });
    if (identity.candidatePoolHash !== query.candidatePoolHash) {
      throw new Error(`Query ${query.queryId} does not match its fixed candidate pool.`);
    }
    candidateCounts[query.queryId] = identity.candidateCount;
    return input;
  });

  return {
    inputs,
    summary: {
      queryIds: inputs.map(({ queryId }) => queryId),
      candidateCounts,
      totalCandidateCount: Object.values(candidateCounts).reduce(
        (total, candidateCount) => total + candidateCount,
        0,
      ),
    },
  };
}

export async function runFeedbackComparisonBatch(
  args: {
    inputs: readonly FeedbackComparisonBatchQueryInput[];
    config: MatchingConfig;
    selection: CuratedFeedbackSelection;
    definition: FeedbackExperimentDefinition;
    maxFeedbackContextCharacters: number;
    onProgress?: (
      queryId: string,
      feedbackMode: "none" | "curated",
      progress: MatchProgress,
    ) => void;
  },
  dependencies: { semanticScorer?: SemanticScorer } = {},
): Promise<FeedbackComparisonBatchRun> {
  const prepared = prepareFeedbackComparisonBatchInputs({
    inputs: args.inputs,
    definition: args.definition,
  });
  const comparisons: FeedbackComparisonRun[] = [];

  for (const input of prepared.inputs) {
    const comparison = await runFeedbackComparison(
      {
        queryId: input.queryId,
        fundingRound: input.fundingRound,
        startup: input.startup,
        investors: [...input.investors],
        config: args.config,
        selection: args.selection,
        definition: args.definition,
        maxFeedbackContextCharacters: args.maxFeedbackContextCharacters,
        onProgress: (feedbackMode, progress) =>
          args.onProgress?.(input.queryId, feedbackMode, progress),
      },
      dependencies,
    );
    comparisons.push(comparison);
  }

  return {
    schemaVersion: FEEDBACK_COMPARISON_BATCH_SCHEMA_VERSION,
    summary: prepared.summary,
    comparisons,
  };
}
