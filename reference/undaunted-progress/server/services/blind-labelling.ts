export const BLIND_LABELLING_SCHEMA_VERSION = "blind-labelling-v1";
export const BLIND_MULTI_VALUE_SEPARATOR = " | ";
export const BLIND_TOP_K = 10;

export const BLIND_IDENTIFIER_COLUMNS = [
  "queryId",
  "startupId",
  "fundingRoundId",
  "investorId",
] as const;

export const BLIND_STARTUP_EVIDENCE_COLUMNS = [
  "startupDescription",
  "climateProblem",
  "solutionDescription",
  "businessModel",
  "targetMarket",
  "roundStage",
  "amountRaisingGbp",
  "minimumTicketSizeGbp",
  "investmentTypes",
  "roundGeography",
  "roundSectors",
  "preferredInvestorTypes",
  "tweetPitch",
  "tractionSummary",
  "unfairAdvantage",
] as const;

export const BLIND_INVESTOR_EVIDENCE_COLUMNS = [
  "investorType",
  "investmentStage",
  "sectorFocus",
  "subSectors",
  "regionalFocus",
  "hqLocation",
  "investorMinimumTicketSizeGbp",
  "investorMaximumTicketSizeGbp",
  "investmentInstruments",
  "investmentThesis",
  "investorDescription",
] as const;

export const BLIND_JUDGEMENT_COLUMNS = [
  "relevance_label",
  "relevance_value",
  "judgement_note",
  "error_category",
  "uncertainty_note",
  "review_status",
] as const;

export const BLIND_LABELLING_COLUMNS = [
  ...BLIND_IDENTIFIER_COLUMNS,
  ...BLIND_STARTUP_EVIDENCE_COLUMNS,
  ...BLIND_INVESTOR_EVIDENCE_COLUMNS,
  ...BLIND_JUDGEMENT_COLUMNS,
] as const;

export type BlindLabellingColumn = (typeof BLIND_LABELLING_COLUMNS)[number];
export type BlindLabellingRow = Record<BlindLabellingColumn, string>;

export const RELEVANCE_VALUES = {
  strong_fit: 2,
  possible_fit: 1,
  weak_fit: 0,
} as const;

export type RelevanceLabel = keyof typeof RELEVANCE_VALUES;

export const FORBIDDEN_BLIND_COLUMNS = [
  "rank",
  "rowId",
  "originalIndex",
  "organisation",
  "startupName",
  "scores",
  "scoreBreakdown",
  "totalScore",
  "semanticScore",
  "matchReasons",
  "ai",
  "aiInsight",
] as const;

export function isForbiddenBlindColumn(column: string): boolean {
  return (FORBIDDEN_BLIND_COLUMNS as readonly string[]).includes(column);
}
