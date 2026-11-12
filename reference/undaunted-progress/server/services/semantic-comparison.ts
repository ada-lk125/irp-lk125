import { createHash } from "node:crypto";
import {
  semanticExperimentContract,
  type SemanticExperimentMethod,
} from "./semantic-experiment";

export const SEMANTIC_COMPARISON_SCHEMA_VERSION = "semantic-comparison-v2";

export interface SemanticComparisonIdentity {
  schemaVersion: typeof SEMANTIC_COMPARISON_SCHEMA_VERSION;
  queryId: string;
  startupId: string;
  fundingRoundId: string;
  candidateCount: number;
  candidatePoolHash: string;
  methods: SemanticExperimentMethod[];
  feedbackMode: "none";
  topK: number;
  useSameCandidatePool: true;
  candidateTieBreak: "investor-id";
}

function requireIdentifier(value: string, fieldName: string): string {
  const identifier = value.trim();
  if (identifier.length === 0) {
    throw new Error(`${fieldName} must be a non-empty identifier.`);
  }
  return identifier;
}

function buildCandidatePoolHash(investorIds: readonly string[]): {
  candidateCount: number;
  candidatePoolHash: string;
} {
  if (investorIds.length === 0) {
    throw new Error("investorIds must contain at least one candidate.");
  }

  const normalisedIds = investorIds.map((investorId, index) =>
    requireIdentifier(investorId, `investorIds[${index}]`),
  );
  if (new Set(normalisedIds).size !== normalisedIds.length) {
    throw new Error("investorIds must not contain duplicate candidates.");
  }

  const stableIds = [...normalisedIds].sort((left, right) =>
    left < right ? -1 : left > right ? 1 : 0,
  );
  const candidatePoolHash = createHash("sha256")
    .update(JSON.stringify(stableIds), "utf8")
    .digest("hex");

  return {
    candidateCount: stableIds.length,
    candidatePoolHash,
  };
}

export function buildSemanticComparisonIdentity(args: {
  queryId: string;
  startupId: string;
  fundingRoundId: string;
  investorIds: readonly string[];
}): SemanticComparisonIdentity {
  const candidatePool = buildCandidatePoolHash(args.investorIds);

  return {
    schemaVersion: SEMANTIC_COMPARISON_SCHEMA_VERSION,
    queryId: requireIdentifier(args.queryId, "queryId"),
    startupId: requireIdentifier(args.startupId, "startupId"),
    fundingRoundId: requireIdentifier(args.fundingRoundId, "fundingRoundId"),
    ...candidatePool,
    methods: semanticExperimentContract.methods.map(({ method }) => method),
    feedbackMode: "none",
    topK: semanticExperimentContract.topK,
    useSameCandidatePool: true,
    candidateTieBreak: semanticExperimentContract.candidateTieBreak,
  };
}
