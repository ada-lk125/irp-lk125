import { createHash } from "node:crypto";
import {
  RELEVANCE_VALUES,
  type BlindLabellingRow,
} from "./blind-labelling";
import { validateFrozenLabellingRows } from "./frozen-labelling";

export const NORMALISATION_EVALUATION_SCHEMA_VERSION =
  "normalisation-evaluation-v1";
export const NORMALISATION_COMPARISON_SCHEMA_VERSION =
  "normalisation-paired-comparison-v1";

const PROFILE_NAMES = ["legacy", "normalisation-v1"] as const;
const SEMANTIC_MODES = [
  "rule-only",
  "text-similarity",
  "gpt-semantic",
] as const;
const TOP_K = 10;

type EvaluationPurpose = "pilot" | "formal";
type ProfileName = (typeof PROFILE_NAMES)[number];
type JsonObject = Record<string, unknown>;

export type RankingMetrics = {
  precisionAt5: number;
  precisionAt10: number;
  mrr: number;
  ndcgAt10: number;
};

export type NormalisationEvaluationInput = {
  purpose: EvaluationPurpose;
  comparisons: readonly {
    fileName: string;
    sha256: string;
    value: unknown;
  }[];
  labelSets: readonly {
    fileName: string;
    sha256: string;
    rows: readonly BlindLabellingRow[];
  }[];
};

function object(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as JsonObject;
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value.trim();
}

function integer(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`${label} must be an integer.`);
  }
  return value;
}

function sha256(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) {
    throw new Error(`${label} must be a lowercase SHA-256 hash.`);
  }
  return value;
}

function round(value: number): number {
  return Number(value.toFixed(12));
}

function mean(values: readonly number[]): number {
  if (values.length === 0) throw new Error("Cannot average an empty list.");
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function dcg(values: readonly number[], limit: number): number {
  return values
    .slice(0, limit)
    .reduce(
      (sum, relevance, index) =>
        sum + (2 ** relevance - 1) / Math.log2(index + 2),
      0,
    );
}

export function calculateRankingMetrics(
  rankedRelevance: readonly number[],
  judgedPoolRelevance: readonly number[],
): RankingMetrics {
  if (rankedRelevance.length !== TOP_K) {
    throw new Error(`A ranking must contain exactly ${TOP_K} relevance values.`);
  }
  if (
    [...rankedRelevance, ...judgedPoolRelevance].some(
      relevance =>
        !Number.isInteger(relevance)
        || relevance < 0
        || relevance > RELEVANCE_VALUES.strong_fit,
    )
  ) {
    throw new Error("Relevance values must be integers from 0 to 2.");
  }
  const firstRelevantIndex = rankedRelevance.findIndex(value => value > 0);
  const ideal = [...judgedPoolRelevance].sort((left, right) => right - left);
  const idealDcg = dcg(ideal, TOP_K);
  return {
    precisionAt5: round(
      rankedRelevance.slice(0, 5).filter(value => value > 0).length / 5,
    ),
    precisionAt10: round(
      rankedRelevance.filter(value => value > 0).length / TOP_K,
    ),
    mrr: firstRelevantIndex < 0 ? 0 : round(1 / (firstRelevantIndex + 1)),
    ndcgAt10: idealDcg === 0
      ? 0
      : round(dcg(rankedRelevance, TOP_K) / idealDcg),
  };
}

function metricDelta(
  variant: RankingMetrics,
  legacy: RankingMetrics,
): RankingMetrics {
  return {
    precisionAt5: round(variant.precisionAt5 - legacy.precisionAt5),
    precisionAt10: round(variant.precisionAt10 - legacy.precisionAt10),
    mrr: round(variant.mrr - legacy.mrr),
    ndcgAt10: round(variant.ndcgAt10 - legacy.ndcgAt10),
  };
}

function macroMetrics(values: readonly RankingMetrics[]): RankingMetrics {
  return {
    precisionAt5: mean(values.map(value => value.precisionAt5)),
    precisionAt10: mean(values.map(value => value.precisionAt10)),
    mrr: mean(values.map(value => value.mrr)),
    ndcgAt10: mean(values.map(value => value.ndcgAt10)),
  };
}

function rankingHash(investorIds: readonly string[]): string {
  return createHash("sha256")
    .update(JSON.stringify(investorIds), "utf8")
    .digest("hex");
}

export function buildNormalisationEvaluation(
  input: NormalisationEvaluationInput,
) {
  if (input.comparisons.length === 0) {
    throw new Error("At least one paired comparison is required.");
  }
  if (input.labelSets.length === 0) {
    throw new Error("At least one frozen label set is required.");
  }

  const labelIndex = new Map<string, number>();
  const relevanceByQuery = new Map<string, number[]>();
  for (const labelSet of input.labelSets) {
    sha256(labelSet.sha256, `${labelSet.fileName} SHA-256`);
    const validation = validateFrozenLabellingRows(labelSet.rows);
    if (validation.errors.length > 0) {
      throw new Error(
        `${labelSet.fileName} is not a valid frozen label set:\n${validation.errors.join("\n")}`,
      );
    }
    if (
      validation.summary.rowCount === 0
      || validation.summary.judgedRowCount !== validation.summary.rowCount
      || validation.summary.holdRowCount !== 0
      || validation.summary.incompleteQueryCount !== 0
    ) {
      throw new Error(
        `${labelSet.fileName} must be fully judged and contain no holds.`,
      );
    }
    for (const row of labelSet.rows) {
      const pair = `${row.queryId}\u0000${row.investorId}`;
      if (labelIndex.has(pair)) {
        throw new Error(
          `Frozen label sets repeat pair ${row.queryId} + ${row.investorId}.`,
        );
      }
      const relevance =
        RELEVANCE_VALUES[row.relevance_label as keyof typeof RELEVANCE_VALUES];
      labelIndex.set(pair, relevance);
      const queryRelevance = relevanceByQuery.get(row.queryId) || [];
      queryRelevance.push(relevance);
      relevanceByQuery.set(row.queryId, queryRelevance);
    }
  }
  if (relevanceByQuery.size !== 3) {
    throw new Error(
      `Frozen labels must cover exactly three queries; found ${relevanceByQuery.size}.`,
    );
  }

  let candidatePoolSha256: string | undefined;
  let matchingSha256: string | undefined;
  let expectedQueryIds: string[] | undefined;
  const semanticModes = new Set<string>();
  const methods = input.comparisons.map(source => {
    sha256(source.sha256, `${source.fileName} SHA-256`);
    const comparison = object(source.value, source.fileName);
    const run = object(comparison.run, `${source.fileName}.run`);
    if (run.schemaVersion !== NORMALISATION_COMPARISON_SCHEMA_VERSION) {
      throw new Error(`${source.fileName} has an unrecognised schemaVersion.`);
    }
    if (run.feedbackMode !== "none") {
      throw new Error(`${source.fileName} must use feedbackMode none.`);
    }
    if (run.candidateTieBreak !== "investor-id") {
      throw new Error(`${source.fileName} must use investor-id tie-breaking.`);
    }
    if (integer(run.topK, `${source.fileName}.run.topK`) !== TOP_K) {
      throw new Error(`${source.fileName} must use topK ${TOP_K}.`);
    }
    if (integer(run.queryCount, `${source.fileName}.run.queryCount`) !== 3) {
      throw new Error(`${source.fileName} must contain three queries.`);
    }
    const comparisonPurpose = string(
      run.purpose,
      `${source.fileName}.run.purpose`,
    );
    if (comparisonPurpose !== "pilot" && comparisonPurpose !== "formal") {
      throw new Error(`${source.fileName} has an invalid purpose.`);
    }
    const implementation = object(
      run.implementation,
      `${source.fileName}.run.implementation`,
    );
    if (
      input.purpose === "formal"
      && (
        comparisonPurpose !== "formal"
        || implementation.workingTreeDirty !== false
      )
    ) {
      throw new Error(
        `Formal evaluation requires a clean formal comparison: ${source.fileName}.`,
      );
    }
    const semanticMode = string(
      run.semanticMode,
      `${source.fileName}.run.semanticMode`,
    );
    if (!(SEMANTIC_MODES as readonly string[]).includes(semanticMode)) {
      throw new Error(`${source.fileName} has an invalid semanticMode.`);
    }
    if (semanticModes.has(semanticMode)) {
      throw new Error(`Semantic mode ${semanticMode} is repeated.`);
    }
    semanticModes.add(semanticMode);

    const poolHash = sha256(
      object(
        run.candidatePool,
        `${source.fileName}.run.candidatePool`,
      ).candidatePoolSha256,
      `${source.fileName}.run.candidatePool.candidatePoolSha256`,
    );
    candidatePoolSha256 ??= poolHash;
    if (candidatePoolSha256 !== poolHash) {
      throw new Error("Comparisons do not use the same candidate pool.");
    }
    const sourceMatchingSha256 = sha256(
      implementation.matchingSha256,
      `${source.fileName}.run.implementation.matchingSha256`,
    );
    matchingSha256 ??= sourceMatchingSha256;
    if (matchingSha256 !== sourceMatchingSha256) {
      throw new Error("Comparisons do not use the same matching implementation.");
    }

    if (!Array.isArray(comparison.queries) || comparison.queries.length !== 3) {
      throw new Error(`${source.fileName} must contain three query results.`);
    }
    const seenQueryIds = new Set<string>();
    const queries = comparison.queries.map((rawQuery, queryIndex) => {
      const query = object(
        rawQuery,
        `${source.fileName}.queries[${queryIndex}]`,
      );
      const queryId = string(
        query.queryId,
        `${source.fileName}.queries[${queryIndex}].queryId`,
      );
      if (seenQueryIds.has(queryId)) {
        throw new Error(`${source.fileName} repeats query ${queryId}.`);
      }
      seenQueryIds.add(queryId);
      const judgedPool = relevanceByQuery.get(queryId);
      if (!judgedPool) {
        throw new Error(`Frozen labels do not contain query ${queryId}.`);
      }
      if (!Array.isArray(query.profiles) || query.profiles.length !== 2) {
        throw new Error(`${source.fileName} ${queryId} must have two profiles.`);
      }

      const profileMetrics = {} as Record<
        ProfileName,
        RankingMetrics & { rankingSha256: string }
      >;
      const seenProfiles = new Set<string>();
      for (const rawProfile of query.profiles) {
        const profile = object(rawProfile, `${source.fileName} ${queryId} profile`);
        const profileName = string(
          profile.normalisationProfile,
          `${source.fileName} ${queryId} profile name`,
        );
        if (!(PROFILE_NAMES as readonly string[]).includes(profileName)) {
          throw new Error(`${source.fileName} has unknown profile ${profileName}.`);
        }
        if (seenProfiles.has(profileName)) {
          throw new Error(
            `${source.fileName} ${queryId} repeats profile ${profileName}.`,
          );
        }
        seenProfiles.add(profileName);
        if (!Array.isArray(profile.matches) || profile.matches.length !== TOP_K) {
          throw new Error(
            `${source.fileName} ${queryId} ${profileName} must have ten matches.`,
          );
        }
        const investorIds = profile.matches.map((rawMatch, matchIndex) => {
          const match = object(
            rawMatch,
            `${source.fileName} ${queryId} ${profileName} match`,
          );
          if (
            integer(match.rank, `${source.fileName} ${queryId} rank`)
            !== matchIndex + 1
          ) {
            throw new Error(
              `${source.fileName} ${queryId} ${profileName} ranks must be 1-10.`,
            );
          }
          return string(
            object(
              match.investor,
              `${source.fileName} ${queryId} match.investor`,
            ).id,
            `${source.fileName} ${queryId} match.investor.id`,
          );
        });
        if (new Set(investorIds).size !== investorIds.length) {
          throw new Error(
            `${source.fileName} ${queryId} ${profileName} repeats an investor.`,
          );
        }
        const rankedRelevance = investorIds.map(investorId => {
          const relevance = labelIndex.get(`${queryId}\u0000${investorId}`);
          if (relevance === undefined) {
            throw new Error(
              `Missing frozen label for ${queryId} + ${investorId}.`,
            );
          }
          return relevance;
        });
        profileMetrics[profileName as ProfileName] = {
          rankingSha256: rankingHash(investorIds),
          ...calculateRankingMetrics(rankedRelevance, judgedPool),
        };
      }
      const legacy = profileMetrics.legacy;
      const variant = profileMetrics["normalisation-v1"];
      return {
        queryId,
        judgedPoolSize: judgedPool.length,
        profiles: {
          legacy,
          "normalisation-v1": variant,
        },
        delta: metricDelta(variant, legacy),
      };
    });

    const queryIds = [...seenQueryIds].sort();
    expectedQueryIds ??= queryIds;
    if (JSON.stringify(expectedQueryIds) !== JSON.stringify(queryIds)) {
      throw new Error("Comparisons do not contain the same query set.");
    }
    const legacyMacro = macroMetrics(
      queries.map(query => query.profiles.legacy),
    );
    const variantMacro = macroMetrics(
      queries.map(query => query.profiles["normalisation-v1"]),
    );
    return {
      semanticMode,
      source: {
        fileName: source.fileName,
        sha256: source.sha256,
        experimentId: string(
          run.experimentId,
          `${source.fileName}.run.experimentId`,
        ),
        purpose: comparisonPurpose,
      },
      queries,
      macro: {
        profiles: {
          legacy: legacyMacro,
          "normalisation-v1": variantMacro,
        },
        delta: metricDelta(variantMacro, legacyMacro),
      },
    };
  });

  return {
    schemaVersion: NORMALISATION_EVALUATION_SCHEMA_VERSION,
    metricDefinition: {
      relevance: "strong_fit=2, possible_fit=1, weak_fit=0",
      relevantThreshold: "relevanceValue > 0",
      precisionDenominator: "fixed k",
      mrrCutoff: TOP_K,
      ndcgCutoff: TOP_K,
      ndcgGain: "2^relevanceValue - 1",
      idcgPool: "all frozen judged pairs for the query",
    },
    candidatePoolSha256,
    matchingSha256,
    queryIds: expectedQueryIds,
    labelPool: {
      rowCount: labelIndex.size,
      queryCount: relevanceByQuery.size,
      sources: input.labelSets.map(labelSet => ({
        fileName: labelSet.fileName,
        sha256: labelSet.sha256,
        rowCount: labelSet.rows.length,
      })),
    },
    methods,
  };
}
