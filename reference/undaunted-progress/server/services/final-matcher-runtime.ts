import type {
  AirtableFundingRound,
  AirtableStartup,
  Investor,
} from "./airtable";
import { buildCuratedFeedbackContext } from "./feedback-context";
import {
  buildFeedbackMatchingConfigHash,
} from "./feedback-comparison-runner";
import type { CuratedFeedbackSelection } from "./feedback-selection";
import {
  FINAL_MATCHER_HANDOFF_SCHEMA_VERSION,
  type FinalMatcherHandoff,
  type FinalMatcherMethod,
} from "./final-matcher-handoff";
import {
  runMatching,
  type MatchProgress,
  type MatchResult,
  type MatchingConfig,
} from "./matching";
import {
  scoreSemanticMatch,
  type SemanticScorer,
} from "./semantic-scorer";

export interface FinalMatcherRuntimeResult {
  selectedMethod: FinalMatcherMethod;
  aiModel: string;
  matchingConfigHash: string;
  feedbackSetHash: string | null;
  matches: MatchResult[];
}

const SCORE_FIELDS = [
  "stageMatch",
  "ticketSizeMatch",
  "sectorOverlap",
  "geographyMatch",
  "instrumentMatch",
  "semanticScore",
] as const;

const RESULT_CONTRACT_SCORE_FIELDS = [
  ...SCORE_FIELDS,
  "totalScore",
] as const;

function requireCommit(value: string): string {
  const commit = value.trim().toLowerCase();
  if (!/^[a-f0-9]{40}$/.test(commit)) {
    throw new Error(
      "The runtime implementation commit must be a 40-character hexadecimal SHA.",
    );
  }
  return commit;
}

function requireRuntimeBoundary(args: {
  handoff: FinalMatcherHandoff;
  config: MatchingConfig;
  implementationCommitSha: string;
  selection?: CuratedFeedbackSelection;
}) {
  if (
    args.handoff.schemaVersion !== FINAL_MATCHER_HANDOFF_SCHEMA_VERSION
    || args.handoff.status !== "ready-for-runtime-integration"
  ) {
    throw new Error("The final matcher handoff is not ready for runtime use.");
  }
  if (
    buildFeedbackMatchingConfigHash(args.config) !==
      args.handoff.matchingConfigHash
  ) {
    throw new Error(
      "The runtime matching configuration does not match the final handoff.",
    );
  }
  if (args.config.aiModel !== args.handoff.aiModel) {
    throw new Error("The runtime AI model does not match the final handoff.");
  }
  if (
    requireCommit(args.implementationCommitSha) !==
      args.handoff.implementationCommitSha
  ) {
    throw new Error(
      "The runtime implementation commit does not match the final handoff.",
    );
  }
  if (args.handoff.semanticMethod !== "gpt-semantic") {
    throw new Error("The final matcher runtime requires gpt-semantic.");
  }
  const resultContract = args.handoff.resultContract;
  const scoreBreakdown = resultContract?.scoreBreakdown;
  if (
    resultContract?.investor !== true
    || resultContract?.matchReasons !== true
    || resultContract?.aiInsight !== true
    || !Array.isArray(scoreBreakdown)
    || scoreBreakdown.length !== RESULT_CONTRACT_SCORE_FIELDS.length
    || RESULT_CONTRACT_SCORE_FIELDS.some(
      (field, index) => scoreBreakdown[index] !== field,
    )
  ) {
    throw new Error(
      "The final handoff does not match the frontend result contract.",
    );
  }

  if (args.handoff.selectedMethod === "curated_feedback") {
    if (!args.selection) {
      throw new Error(
        "The curated final method requires its selected feedback set.",
      );
    }
    if (args.selection.feedbackSetHash !== args.handoff.feedbackSetHash) {
      throw new Error(
        "The runtime feedback set does not match the final handoff.",
      );
    }
  } else if (args.handoff.selectedMethod !== "no_feedback_gpt") {
    throw new Error("The final handoff selected an unsupported method.");
  } else if (args.selection) {
    throw new Error(
      "The no-feedback final method must not receive a feedback selection.",
    );
  }
}

function requireScore(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`${label} must be between 0 and 100.`);
  }
}

export function validateFinalMatcherResults(args: {
  matches: MatchResult[];
  expectedCount: number;
}): MatchResult[] {
  if (args.matches.length !== args.expectedCount) {
    throw new Error(
      `Final matcher returned ${args.matches.length} results; expected ${args.expectedCount}.`,
    );
  }
  const investorIds = new Set<string>();
  let previousTotal = Number.POSITIVE_INFINITY;

  args.matches.forEach((match, index) => {
    const investorId = String(match.investor?.id ?? "").trim();
    if (!investorId || investorIds.has(investorId)) {
      throw new Error(
        `Final matcher result ${index} has a missing or duplicate investor ID.`,
      );
    }
    investorIds.add(investorId);

    SCORE_FIELDS.forEach(field => {
      requireScore(
        match.scoreBreakdown?.[field],
        `Final matcher result ${index}.${field}`,
      );
    });
    const totalScore = match.scoreBreakdown?.totalScore;
    if (!Number.isFinite(totalScore) || totalScore < 0) {
      throw new Error(
        `Final matcher result ${index}.totalScore must be non-negative.`,
      );
    }
    if (totalScore > previousTotal) {
      throw new Error("Final matcher results must be sorted by totalScore.");
    }
    previousTotal = totalScore;

    if (
      !Array.isArray(match.matchReasons)
      || match.matchReasons.some(reason => typeof reason !== "string")
    ) {
      throw new Error(
        `Final matcher result ${index}.matchReasons must be a string array.`,
      );
    }
    if (
      match.aiInsight !== undefined
      && typeof match.aiInsight !== "string"
    ) {
      throw new Error(
        `Final matcher result ${index}.aiInsight must be a string when present.`,
      );
    }
  });
  return args.matches;
}

export async function runFinalMatcher(
  args: {
    handoff: FinalMatcherHandoff;
    implementationCommitSha: string;
    fundingRound: AirtableFundingRound;
    startup: AirtableStartup;
    investors: Investor[];
    config: MatchingConfig;
    selection?: CuratedFeedbackSelection;
    maxFeedbackContextCharacters: number;
    onProgress?: (progress: MatchProgress) => void;
  },
  dependencies: { semanticScorer?: SemanticScorer } = {},
): Promise<FinalMatcherRuntimeResult> {
  requireRuntimeBoundary(args);
  const semanticScorer = dependencies.semanticScorer ?? scoreSemanticMatch;
  const feedbackContext =
    args.handoff.selectedMethod === "curated_feedback"
      ? buildCuratedFeedbackContext({
          selection: args.selection!,
          maxCharacters: args.maxFeedbackContextCharacters,
        }).text
      : "";

  const controlledScorer: SemanticScorer = (
    startupContext,
    investorContext,
    incomingFeedbackContext,
    config,
  ) => {
    if (incomingFeedbackContext !== "") {
      throw new Error(
        "The final matcher received feedback outside its selected handoff.",
      );
    }
    return semanticScorer(
      startupContext,
      investorContext,
      feedbackContext,
      config,
    );
  };
  const matches = await runMatching(
    args.fundingRound,
    args.startup,
    [...args.investors],
    undefined,
    undefined,
    args.config,
    args.onProgress,
    {
      semanticMode: "gpt-semantic",
      semanticScorer: controlledScorer,
    },
  );

  return {
    selectedMethod: args.handoff.selectedMethod,
    aiModel: args.handoff.aiModel,
    matchingConfigHash: args.handoff.matchingConfigHash,
    feedbackSetHash:
      args.handoff.selectedMethod === "curated_feedback"
        ? args.handoff.feedbackSetHash
        : null,
    matches: validateFinalMatcherResults({
      matches,
      expectedCount: args.investors.length,
    }),
  };
}
