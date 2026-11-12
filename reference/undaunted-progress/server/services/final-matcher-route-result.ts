import type { FinalMatcherRuntimeResult } from "./final-matcher-runtime";
import { validateFinalMatcherResults } from "./final-matcher-runtime";
import type { MatchResult } from "./matching";

export interface FinalMatcherRouteResult {
  startupAirtableId: string;
  fundingRoundAirtableId: string;
  matches: MatchResult[];
}

const ROUTE_RESULT_FIELDS = [
  "startupAirtableId",
  "fundingRoundAirtableId",
  "matches",
] as const;

const MATCH_FIELDS = [
  "investor",
  "scoreBreakdown",
  "matchReasons",
  "aiInsight",
] as const;

const SCORE_FIELDS = [
  "stageMatch",
  "ticketSizeMatch",
  "sectorOverlap",
  "geographyMatch",
  "instrumentMatch",
  "semanticScore",
  "totalScore",
] as const;

function requireId(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value.trim();
}

function requireSha(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) {
    throw new Error(`${label} must be a SHA-256 value.`);
  }
  return value;
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requireExactFields(args: {
  record: Record<string, unknown>;
  required: readonly string[];
  optional?: readonly string[];
  label: string;
}) {
  const allowed = new Set([...(args.required ?? []), ...(args.optional ?? [])]);
  const unknown = Object.keys(args.record).filter(field => !allowed.has(field));
  const missing = args.required.filter(field => !(field in args.record));
  if (unknown.length || missing.length) {
    throw new Error(
      `${args.label} fields do not match the current route contract.`,
    );
  }
}

function validateRuntimeIdentity(runtime: FinalMatcherRuntimeResult) {
  requireSha(runtime.matchingConfigHash, "matchingConfigHash");
  if (!runtime.aiModel.trim()) {
    throw new Error("aiModel must be a non-empty string.");
  }
  if (runtime.selectedMethod === "curated_feedback") {
    requireSha(runtime.feedbackSetHash, "feedbackSetHash");
  } else if (runtime.selectedMethod === "no_feedback_gpt") {
    if (runtime.feedbackSetHash !== null) {
      throw new Error(
        "The no-feedback runtime result must not include a feedback-set hash.",
      );
    }
  } else {
    throw new Error("The runtime result uses an unsupported method.");
  }
}

export function buildFinalMatcherRouteResult(args: {
  runtime: FinalMatcherRuntimeResult;
  startupAirtableId: string;
  fundingRoundAirtableId: string;
}): FinalMatcherRouteResult {
  validateRuntimeIdentity(args.runtime);
  return {
    startupAirtableId: requireId(
      args.startupAirtableId,
      "startupAirtableId",
    ),
    fundingRoundAirtableId: requireId(
      args.fundingRoundAirtableId,
      "fundingRoundAirtableId",
    ),
    matches: validateFinalMatcherResults({
      matches: args.runtime.matches,
      expectedCount: args.runtime.matches.length,
    }),
  };
}

export function validateFinalMatcherRouteResult(
  value: unknown,
): FinalMatcherRouteResult {
  const result = requireRecord(value, "Final matcher route result");
  requireExactFields({
    record: result,
    required: ROUTE_RESULT_FIELDS,
    label: "Final matcher route result",
  });
  const startupAirtableId = requireId(
    result.startupAirtableId,
    "startupAirtableId",
  );
  const fundingRoundAirtableId = requireId(
    result.fundingRoundAirtableId,
    "fundingRoundAirtableId",
  );
  if (!Array.isArray(result.matches)) {
    throw new Error("Final matcher route result matches must be an array.");
  }

  result.matches.forEach((value, index) => {
    const match = requireRecord(value, `matches[${index}]`);
    requireExactFields({
      record: match,
      required: MATCH_FIELDS.slice(0, 3),
      optional: MATCH_FIELDS.slice(3),
      label: `matches[${index}]`,
    });
    const scoreBreakdown = requireRecord(
      match.scoreBreakdown,
      `matches[${index}].scoreBreakdown`,
    );
    requireExactFields({
      record: scoreBreakdown,
      required: SCORE_FIELDS,
      label: `matches[${index}].scoreBreakdown`,
    });
  });

  const matches = validateFinalMatcherResults({
    matches: result.matches as MatchResult[],
    expectedCount: result.matches.length,
  });
  return {
    startupAirtableId,
    fundingRoundAirtableId,
    matches,
  };
}
