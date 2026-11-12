import type { MatchProgress, MatchResult, MatchingConfig } from "./matching";

export const BASELINE_EXPORT_SCHEMA_VERSION = "baseline-export-v2";

export type BaselineExportInput = {
  queryId: string;
  startupId: string;
  fundingRoundId: string;
  startupName: string;
  description: string;
  climateProblem?: string;
  solutionDescription?: string;
  businessModel?: string;
  targetMarket?: string;
  competitors?: string;
  roundStage: string;
  amountRaising?: number;
  minTicketSize?: number;
  investmentTypes?: string[];
  roundGeography?: string;
  roundSectors?: string[];
  tweetPitch?: string;
  tractionSummary?: string;
  unfairAdvantage?: string;
  preferredInvestorTypes?: string[];
};

export type BaselineMatcherInput = {
  queryId: string;
  fundingRound: {
    id: string;
    startupId: string;
    startupName: string;
    roundStage: string;
    amountRaising?: number;
    minTicketSize?: number;
    investmentTypes?: string[];
    roundGeography?: string;
    roundSectors?: string[];
    tweetPitch?: string;
    tractionSummary?: string;
    unfairAdvantage?: string;
    preferredInvestorTypes?: string[];
  };
  startup: {
    id: string;
    name: string;
    description: string;
    climateProblem?: string;
    solutionDescription?: string;
    businessModel?: string;
    targetMarket?: string;
    competitors?: string;
  };
};

function asStringArray(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === "string");
}

export function validateBaselineExportInput(raw: unknown): BaselineExportInput {
  if (!raw || typeof raw !== "object") {
    throw new Error("Input must be a JSON object.");
  }

  const input = raw as Record<string, unknown>;
  const requiredStrings = [
    "queryId",
    "startupId",
    "fundingRoundId",
    "startupName",
    "description",
    "roundStage",
  ];
  for (const field of requiredStrings) {
    if (typeof input[field] !== "string" || input[field].trim().length === 0) {
      throw new Error(`Input field "${field}" must be a non-empty string.`);
    }
  }

  return {
    queryId: input.queryId as string,
    startupId: input.startupId as string,
    fundingRoundId: input.fundingRoundId as string,
    startupName: input.startupName as string,
    description: input.description as string,
    climateProblem: typeof input.climateProblem === "string" ? input.climateProblem : undefined,
    solutionDescription: typeof input.solutionDescription === "string" ? input.solutionDescription : undefined,
    businessModel: typeof input.businessModel === "string" ? input.businessModel : undefined,
    targetMarket: typeof input.targetMarket === "string" ? input.targetMarket : undefined,
    competitors: typeof input.competitors === "string" ? input.competitors : undefined,
    roundStage: input.roundStage as string,
    amountRaising: typeof input.amountRaising === "number" ? input.amountRaising : undefined,
    minTicketSize: typeof input.minTicketSize === "number" ? input.minTicketSize : undefined,
    investmentTypes: asStringArray(input.investmentTypes),
    roundGeography: typeof input.roundGeography === "string" ? input.roundGeography : undefined,
    roundSectors: asStringArray(input.roundSectors),
    tweetPitch: typeof input.tweetPitch === "string" ? input.tweetPitch : undefined,
    tractionSummary: typeof input.tractionSummary === "string" ? input.tractionSummary : undefined,
    unfairAdvantage: typeof input.unfairAdvantage === "string" ? input.unfairAdvantage : undefined,
    preferredInvestorTypes: asStringArray(input.preferredInvestorTypes),
  };
}

export function buildBaselineMatcherInput(input: BaselineExportInput): BaselineMatcherInput {
  return {
    queryId: input.queryId,
    fundingRound: {
      id: input.fundingRoundId,
      startupId: input.startupId,
      startupName: input.startupName,
      roundStage: input.roundStage,
      amountRaising: input.amountRaising,
      minTicketSize: input.minTicketSize,
      investmentTypes: input.investmentTypes,
      roundGeography: input.roundGeography,
      roundSectors: input.roundSectors,
      tweetPitch: input.tweetPitch,
      tractionSummary: input.tractionSummary,
      unfairAdvantage: input.unfairAdvantage,
      preferredInvestorTypes: input.preferredInvestorTypes,
    },
    startup: {
      id: input.startupId,
      name: input.startupName,
      description: input.description,
      climateProblem: input.climateProblem,
      solutionDescription: input.solutionDescription,
      businessModel: input.businessModel,
      targetMarket: input.targetMarket,
      competitors: input.competitors,
    },
  };
}

export function toBaselineExportRow(match: MatchResult, index: number) {
  const aiInsight = match.aiInsight;
  const hardExcluded = aiInsight?.startsWith("[EXCLUSION]") || false;

  return {
    rank: index + 1,
    investor: {
      id: match.investor.id,
      organisation: match.investor.organisation,
      description: match.investor.description ?? null,
      investorType: match.investor.investorType,
      investmentStage: match.investor.investmentStage,
      sectorFocus: match.investor.sectorFocus,
      subSectors: match.investor.subSectors,
      regionalFocus: match.investor.regionalFocus,
      hqLocation: match.investor.hqLocation ?? null,
      minTicketSize: match.investor.minTicketSize,
      maxTicketSize: match.investor.maxTicketSize,
      investmentInstruments: match.investor.investmentInstruments,
      investmentThesis: match.investor.investmentThesis ?? null,
    },
    scores: match.scoreBreakdown,
    matchReasons: match.matchReasons,
    ai: {
      scored: Boolean(aiInsight),
      hardExcluded,
      insight: aiInsight,
    },
  };
}

export function buildBaselineExportBody(args: {
  runId: string;
  matcherInput: BaselineMatcherInput;
  config: MatchingConfig;
  source: string;
  createdAt?: string;
  dryRun: boolean;
  progress: MatchProgress[];
  matches: MatchResult[];
}) {
  return {
    run: {
      schemaVersion: BASELINE_EXPORT_SCHEMA_VERSION,
      runId: args.runId,
      createdAt: args.createdAt || new Date().toISOString(),
      source: args.source,
      normalisationProfile: args.config.normalisationProfile,
      aiCandidateCount: args.config.aiCandidateCount,
      aiModel: args.config.aiModel,
      weights: args.config.weights,
      dryRun: args.dryRun,
    },
    input: args.matcherInput,
    progress: args.dryRun ? [] : args.progress,
    matches: args.dryRun ? [] : args.matches.map(toBaselineExportRow),
  };
}
