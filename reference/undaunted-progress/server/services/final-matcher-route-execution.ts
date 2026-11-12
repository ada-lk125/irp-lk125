import type {
  AirtableFundingRound,
  AirtableStartup,
  Investor,
} from "./airtable";
import type { CuratedFeedbackSelection } from "./feedback-selection";
import type { FinalMatcherHandoff } from "./final-matcher-handoff";
import {
  buildFinalMatcherRouteResult,
  type FinalMatcherRouteResult,
} from "./final-matcher-route-result";
import { runFinalMatcher } from "./final-matcher-runtime";
import type {
  MatchProgress,
  MatchingConfig,
} from "./matching";
import type { SemanticScorer } from "./semantic-scorer";

function requireRecordId(value: string, label: string): string {
  const id = String(value ?? "").trim();
  if (!id) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return id;
}

export interface FinalMatcherRouteExecutionInput {
  handoff: FinalMatcherHandoff;
  implementationCommitSha: string;
  startup: AirtableStartup;
  fundingRound: AirtableFundingRound;
  investors: Investor[];
  config: MatchingConfig;
  selection?: CuratedFeedbackSelection;
  maxFeedbackContextCharacters: number;
  onProgress?: (progress: MatchProgress) => void;
  emitCompletion?: boolean;
}

export interface FinalMatcherRouteExecutionDependencies {
  semanticScorer?: SemanticScorer;
}

export async function executeFinalMatcherRoute(
  args: FinalMatcherRouteExecutionInput,
  dependencies: FinalMatcherRouteExecutionDependencies = {},
): Promise<FinalMatcherRouteResult> {
  const startupAirtableId = requireRecordId(args.startup.id, "startup.id");
  const fundingRoundAirtableId = requireRecordId(
    args.fundingRound.id,
    "fundingRound.id",
  );
  if (args.investors.length === 0) {
    throw new Error("The final matcher route requires at least one investor.");
  }

  const runtime = await runFinalMatcher(
    {
      handoff: args.handoff,
      implementationCommitSha: args.implementationCommitSha,
      fundingRound: args.fundingRound,
      startup: args.startup,
      investors: args.investors,
      config: args.config,
      selection: args.selection,
      maxFeedbackContextCharacters: args.maxFeedbackContextCharacters,
      onProgress: args.onProgress,
    },
    dependencies,
  );
  const result = buildFinalMatcherRouteResult({
    runtime,
    startupAirtableId,
    fundingRoundAirtableId,
  });
  if (args.emitCompletion !== false) {
    args.onProgress?.({
      phase: "complete",
      current: 1,
      total: 1,
      message: "Matching complete!",
    });
  }
  return result;
}
