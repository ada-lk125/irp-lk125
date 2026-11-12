import { createHash } from "node:crypto";
import type {
  AirtableFundingRound,
  AirtableStartup,
  Investor,
} from "./airtable";
import {
  buildCuratedFeedbackContext,
  type CuratedFeedbackContext,
} from "./feedback-context";
import type { CuratedFeedbackSelection } from "./feedback-selection";
import {
  FEEDBACK_EXPERIMENT_SCHEMA_VERSION,
  type FeedbackExperimentDefinition,
  type FeedbackExperimentMode,
} from "./feedback-experiment";
import {
  runMatching,
  type MatchProgress,
  type MatchResult,
  type MatchingConfig,
} from "./matching";
import { buildSemanticComparisonIdentity } from "./semantic-comparison";
import {
  scoreSemanticMatch,
  type SemanticScorer,
} from "./semantic-scorer";

export interface FeedbackComparisonMethodRun {
  feedbackMode: FeedbackExperimentMode;
  matches: MatchResult[];
}

export interface FeedbackComparisonRun {
  query: {
    queryId: string;
    startupId: string;
    fundingRoundId: string;
    candidateCount: number;
    candidatePoolHash: string;
  };
  feedbackContext: Omit<CuratedFeedbackContext, "text">;
  runs: [FeedbackComparisonMethodRun, FeedbackComparisonMethodRun];
}

function canonicalise(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalise);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalise(entry)]),
    );
  }
  return value;
}

export function buildFeedbackMatchingConfigHash(config: MatchingConfig): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalise(config)), "utf8")
    .digest("hex");
}

function validateRunBoundary(args: {
  queryId: string;
  fundingRound: AirtableFundingRound;
  startup: AirtableStartup;
  investors: readonly Investor[];
  config: MatchingConfig;
  selection: CuratedFeedbackSelection;
  definition: FeedbackExperimentDefinition;
}) {
  if (args.definition.schemaVersion !== FEEDBACK_EXPERIMENT_SCHEMA_VERSION) {
    throw new Error("Unsupported feedback experiment schema.");
  }
  if (buildFeedbackMatchingConfigHash(args.config) !== args.definition.matchingConfigHash) {
    throw new Error("The matching configuration does not match the experiment definition.");
  }

  const curatedRun = args.definition.runs.find(run => run.feedbackMode === "curated");
  if (!curatedRun || curatedRun.feedbackMode !== "curated") {
    throw new Error("The experiment definition is missing its curated run.");
  }
  if (
    curatedRun.feedbackSetVersion !== args.selection.feedbackSetVersion
    || curatedRun.feedbackSetHash !== args.selection.feedbackSetHash
  ) {
    throw new Error("The selected feedback does not match the experiment definition.");
  }

  const queryDefinition = args.definition.queries.find(
    query => query.queryId === args.queryId,
  );
  if (!queryDefinition) {
    throw new Error(`Query ${args.queryId} is not part of the feedback experiment.`);
  }
  if (
    queryDefinition.startupId !== args.startup.id
    || queryDefinition.fundingRoundId !== args.fundingRound.id
  ) {
    throw new Error("The startup or funding round does not match the experiment query.");
  }

  const candidateIdentity = buildSemanticComparisonIdentity({
    queryId: args.queryId,
    startupId: args.startup.id,
    fundingRoundId: args.fundingRound.id,
    investorIds: args.investors.map(({ id }) => id),
  });
  if (candidateIdentity.candidatePoolHash !== queryDefinition.candidatePoolHash) {
    throw new Error("The investor candidate pool does not match the experiment query.");
  }

  return { queryDefinition, candidateIdentity };
}

export async function runFeedbackComparison(
  args: {
    queryId: string;
    fundingRound: AirtableFundingRound;
    startup: AirtableStartup;
    investors: Investor[];
    config: MatchingConfig;
    selection: CuratedFeedbackSelection;
    definition: FeedbackExperimentDefinition;
    maxFeedbackContextCharacters: number;
    onProgress?: (mode: FeedbackExperimentMode, progress: MatchProgress) => void;
  },
  dependencies: { semanticScorer?: SemanticScorer } = {},
): Promise<FeedbackComparisonRun> {
  const { queryDefinition, candidateIdentity } = validateRunBoundary(args);
  const context = buildCuratedFeedbackContext({
    selection: args.selection,
    maxCharacters: args.maxFeedbackContextCharacters,
  });
  const candidatePool = [...args.investors];
  const semanticScorer = dependencies.semanticScorer ?? scoreSemanticMatch;

  const runMode = async (feedbackMode: FeedbackExperimentMode) => {
    const controlledScorer: SemanticScorer = (
      startupContext,
      investorContext,
      incomingFeedbackContext,
      config,
    ) => {
      if (incomingFeedbackContext !== "") {
        throw new Error("The controlled runner received unexpected baseline feedback.");
      }
      return semanticScorer(
        startupContext,
        investorContext,
        feedbackMode === "curated" ? context.text : "",
        config,
      );
    };

    const matches = await runMatching(
      args.fundingRound,
      args.startup,
      candidatePool,
      undefined,
      args.definition.topK,
      args.config,
      progress => args.onProgress?.(feedbackMode, progress),
      { semanticMode: "gpt-semantic", semanticScorer: controlledScorer },
    );

    return {
      feedbackMode,
      matches: matches.slice(0, args.definition.topK),
    };
  };

  const control = await runMode("none");
  const curated = await runMode("curated");
  const { text: _privateText, ...feedbackContext } = context;

  return {
    query: {
      queryId: queryDefinition.queryId,
      startupId: queryDefinition.startupId,
      fundingRoundId: queryDefinition.fundingRoundId,
      candidateCount: candidateIdentity.candidateCount,
      candidatePoolHash: candidateIdentity.candidatePoolHash,
    },
    feedbackContext,
    runs: [control, curated],
  };
}
