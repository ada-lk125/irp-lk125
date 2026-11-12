import { access } from "node:fs/promises";
import path from "node:path";
import type { SemanticComparisonExport } from "./semantic-comparison-export";
import { validateSemanticComparisonExport } from "./semantic-comparison-export";
import {
  semanticExperimentContract,
  type SemanticExperimentMethod,
} from "./semantic-experiment";
import type { SemanticSignalAudit } from "./semantic-signal-audit";

export const SEMANTIC_COMPARISON_REVIEW_SCHEMA_VERSION =
  "semantic-comparison-review-v2";
export const SEMANTIC_COMPARISON_REVIEW_PACK_SCHEMA_VERSION =
  "semantic-comparison-review-pack-v1";

interface MethodReview {
  method: SemanticExperimentMethod;
  scoredMatchCount: number;
  hardExclusionCount: number;
  semanticScore: {
    minimum: number;
    maximum: number;
    mean: number;
  };
}

interface PairwiseReview {
  leftMethod: SemanticExperimentMethod;
  rightMethod: SemanticExperimentMethod;
  topTenSharedCount: number;
  topFiveSharedCount: number;
  sameRankCount: number;
  meanAbsoluteRankChange: number | null;
}

export interface SemanticComparisonReview {
  schemaVersion: typeof SEMANTIC_COMPARISON_REVIEW_SCHEMA_VERSION;
  queryId: string;
  startupId: string;
  fundingRoundId: string;
  candidateCount: number;
  candidatePoolHash: string;
  signalAudit: SemanticSignalAudit;
  methods: MethodReview[];
  pairwise: PairwiseReview[];
  evaluationStatus: "requires-frozen-labels";
}

export interface SemanticComparisonReviewPack {
  schemaVersion: typeof SEMANTIC_COMPARISON_REVIEW_PACK_SCHEMA_VERSION;
  createdAt: string;
  queryCount: number;
  reviews: SemanticComparisonReview[];
  evaluationStatus: "requires-frozen-labels";
}

type ExportMethod = SemanticComparisonExport["methods"][number];
type ExportMatch = ExportMethod["matches"][number];

function investorId(match: ExportMatch): string {
  return match.investor.id;
}

function roundMean(total: number, count: number): number {
  return Number((total / count).toFixed(2));
}

function semanticScore(match: ExportMatch, label: string): number {
  const score = match.scores.semanticScore;
  if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 100) {
    throw new Error(`${label} semanticScore must be a number from 0 to 100.`);
  }
  return score;
}

function aiStatus(match: ExportMatch, label: string) {
  const ai = match.ai as unknown;
  if (!ai || typeof ai !== "object" || Array.isArray(ai)) {
    throw new Error(`${label} ai status must be an object.`);
  }
  const status = ai as Record<string, unknown>;
  if (typeof status.scored !== "boolean" || typeof status.hardExcluded !== "boolean") {
    throw new Error(`${label} ai.scored and ai.hardExcluded must be boolean values.`);
  }
  return {
    scored: status.scored,
    hardExcluded: status.hardExcluded,
  };
}

function reviewMethod(methodRun: ExportMethod): MethodReview {
  const reviewedMatches = methodRun.matches.map((match, index) => {
    const label = `${methodRun.method}[${index}]`;
    return {
      score: semanticScore(match, label),
      ai: aiStatus(match, label),
    };
  });
  const scores = reviewedMatches.map(({ score }) => score);

  return {
    method: methodRun.method,
    scoredMatchCount: reviewedMatches.filter(match => match.ai.scored).length,
    hardExclusionCount: reviewedMatches.filter(match => match.ai.hardExcluded).length,
    semanticScore: {
      minimum: Math.min(...scores),
      maximum: Math.max(...scores),
      mean: roundMean(scores.reduce((total, score) => total + score, 0), scores.length),
    },
  };
}

function reviewPair(left: ExportMethod, right: ExportMethod): PairwiseReview {
  const leftRanks = new Map(
    left.matches.map((match, index) => [investorId(match), index + 1]),
  );
  const rightRanks = new Map(
    right.matches.map((match, index) => [investorId(match), index + 1]),
  );
  const sharedIds = Array.from(leftRanks.keys()).filter(id => rightRanks.has(id));
  const topFiveLeft = new Set(left.matches.slice(0, 5).map(investorId));
  const topFiveRight = new Set(right.matches.slice(0, 5).map(investorId));
  const rankChanges = sharedIds.map(id =>
    Math.abs((leftRanks.get(id) ?? 0) - (rightRanks.get(id) ?? 0)),
  );

  return {
    leftMethod: left.method,
    rightMethod: right.method,
    topTenSharedCount: sharedIds.length,
    topFiveSharedCount: Array.from(topFiveLeft).filter(id => topFiveRight.has(id)).length,
    sameRankCount: rankChanges.filter(change => change === 0).length,
    meanAbsoluteRankChange: rankChanges.length > 0
      ? roundMean(rankChanges.reduce((total, change) => total + change, 0), rankChanges.length)
      : null,
  };
}

export function buildSemanticComparisonReview(
  rawExport: unknown,
): SemanticComparisonReview {
  const summary = validateSemanticComparisonExport(rawExport);
  const comparison = rawExport as SemanticComparisonExport;
  const pairwise: PairwiseReview[] = [];

  for (let leftIndex = 0; leftIndex < comparison.methods.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < comparison.methods.length;
      rightIndex += 1
    ) {
      pairwise.push(
        reviewPair(comparison.methods[leftIndex], comparison.methods[rightIndex]),
      );
    }
  }

  const methodCount = semanticExperimentContract.methods.length;
  if (pairwise.length !== (methodCount * (methodCount - 1)) / 2) {
    throw new Error("Semantic comparison review must contain all method pairs.");
  }

  return {
    schemaVersion: SEMANTIC_COMPARISON_REVIEW_SCHEMA_VERSION,
    queryId: summary.queryId,
    startupId: summary.startupId,
    fundingRoundId: summary.fundingRoundId,
    candidateCount: summary.candidateCount,
    candidatePoolHash: summary.candidatePoolHash,
    signalAudit: summary.signalAudit,
    methods: comparison.methods.map(reviewMethod),
    pairwise,
    evaluationStatus: "requires-frozen-labels",
  };
}

export function buildSemanticComparisonReviewPack(args: {
  exports: readonly unknown[];
  createdAt?: string;
}): SemanticComparisonReviewPack {
  if (args.exports.length !== semanticExperimentContract.queryCount) {
    throw new Error(
      `Semantic comparison review needs ${semanticExperimentContract.queryCount} query exports.`,
    );
  }
  const reviews = args.exports.map(buildSemanticComparisonReview);
  const queryIds = reviews.map(({ queryId }) => queryId);
  if (new Set(queryIds).size !== queryIds.length) {
    throw new Error("Semantic comparison review query ids must be unique.");
  }
  const queryPairs = reviews.map(
    ({ startupId, fundingRoundId }) => `${startupId}\u0000${fundingRoundId}`,
  );
  if (new Set(queryPairs).size !== queryPairs.length) {
    throw new Error("Semantic comparison review startup and funding round pairs must be unique.");
  }
  const createdAt = args.createdAt ? new Date(args.createdAt) : new Date();
  if (Number.isNaN(createdAt.getTime())) {
    throw new Error("createdAt must be a valid date or ISO timestamp.");
  }

  return {
    schemaVersion: SEMANTIC_COMPARISON_REVIEW_PACK_SCHEMA_VERSION,
    createdAt: createdAt.toISOString(),
    queryCount: reviews.length,
    reviews,
    evaluationStatus: "requires-frozen-labels",
  };
}

export async function assertSemanticReviewOutputAvailable(
  filePath: string,
  workingDirectory = process.cwd(),
): Promise<string> {
  const exportsRoot = path.resolve(workingDirectory, "exports");
  const resolved = path.resolve(workingDirectory, filePath);
  const relative = path.relative(exportsRoot, resolved);
  const insideExports = relative.length > 0
    && !relative.startsWith("..")
    && !path.isAbsolute(relative);
  if (!insideExports || !path.basename(resolved).endsWith(".local.json")) {
    throw new Error("Review output must stay inside exports/ and end with .local.json.");
  }

  try {
    await access(resolved);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return resolved;
    throw error;
  }
  throw new Error(`Review output already exists and will not be overwritten: ${filePath}`);
}
