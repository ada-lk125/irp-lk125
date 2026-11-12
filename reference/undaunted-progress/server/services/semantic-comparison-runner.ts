import type {
  AirtableFundingRound,
  AirtableStartup,
  Investor,
} from "./airtable";
import {
  runMatching,
  type MatchProgress,
  type MatchResult,
  type MatchingConfig,
} from "./matching";
import {
  semanticExperimentContract,
  type SemanticExperimentMethod,
  validateSemanticExperimentBoundary,
} from "./semantic-experiment";
import {
  buildSemanticComparisonIdentity,
  type SemanticComparisonIdentity,
} from "./semantic-comparison";
import type { SemanticScorer } from "./semantic-scorer";
import {
  buildSemanticSignalAudit,
  type SemanticSignalAudit,
} from "./semantic-signal-audit";

type ScoredSemanticMethod = Exclude<SemanticExperimentMethod, "rule-only">;

export interface SemanticComparisonMethodRun {
  method: SemanticExperimentMethod;
  matches: MatchResult[];
}

export interface SemanticComparisonRun {
  identity: SemanticComparisonIdentity;
  signalAudit: SemanticSignalAudit;
  methodRuns: SemanticComparisonMethodRun[];
}

export interface SemanticComparisonRunnerDependencies {
  semanticScorers?: Partial<Record<ScoredSemanticMethod, SemanticScorer>>;
}

export async function runSemanticComparison(
  args: {
    queryId: string;
    fundingRound: AirtableFundingRound;
    startup: AirtableStartup;
    investors: Investor[];
    config: MatchingConfig;
    onProgress?: (method: SemanticExperimentMethod, progress: MatchProgress) => void;
  },
  dependencies: SemanticComparisonRunnerDependencies = {},
): Promise<SemanticComparisonRun> {
  const boundaryErrors = validateSemanticExperimentBoundary(args.config);
  if (boundaryErrors.length > 0) {
    throw new Error(`Semantic comparison boundary failed:\n${boundaryErrors.join("\n")}`);
  }

  const candidatePool = [...args.investors];
  const identity = buildSemanticComparisonIdentity({
    queryId: args.queryId,
    startupId: args.startup.id,
    fundingRoundId: args.fundingRound.id,
    investorIds: candidatePool.map(({ id }) => id),
  });
  const signalAudit = buildSemanticSignalAudit({
    startup: args.startup,
    fundingRound: args.fundingRound,
    investors: candidatePool,
    config: args.config,
  });
  const methodRuns: SemanticComparisonMethodRun[] = [];

  for (const { method } of semanticExperimentContract.methods) {
    const semanticScorer = method === "rule-only"
      ? undefined
      : dependencies.semanticScorers?.[method];
    const matches = await runMatching(
      args.fundingRound,
      args.startup,
      candidatePool,
      undefined,
      undefined,
      args.config,
      progress => args.onProgress?.(method, progress),
      {
        semanticMode: method,
        candidateTieBreak: semanticExperimentContract.candidateTieBreak,
        ...(semanticScorer ? { semanticScorer } : {}),
      },
    );

    methodRuns.push({
      method,
      matches: matches.slice(0, semanticExperimentContract.topK),
    });
  }

  return { identity, signalAudit, methodRuns };
}
