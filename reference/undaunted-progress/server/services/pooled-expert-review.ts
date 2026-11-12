import { createHash } from "node:crypto";
import {
  EXPERT_REVIEW_COLUMNS,
  buildExpertReviewPack,
  parseExpertReviewCsv,
  serialiseExpertReviewCsv,
  type ExpertReviewProfile,
  type ExpertReviewRow,
} from "./expert-review";

export const POOLED_EXPERT_REVIEW_MANIFEST_SCHEMA_VERSION =
  "pooled-expert-review-pack-manifest-v1";
export const POOLED_EXPERT_REVIEW_EVALUATION_SCHEMA_VERSION =
  "pooled-expert-review-evaluation-v1";

const PROFILES = ["legacy", "normalisation-v1"] as const;
const TOP_K = 10;
const EVIDENCE_COLUMNS = EXPERT_REVIEW_COLUMNS.filter(
  column => column !== "reviewer_id" && column !== "thumbs_up" && column !== "review_comment",
);
const CONTENT_COLUMNS = EVIDENCE_COLUMNS.filter(
  column => column !== "review_item_id",
);

type JsonObject = Record<string, unknown>;

export type PooledExpertReviewSource = {
  profile: ExpertReviewProfile;
  systemRank: number;
  systemScore: number;
  configSha256: string;
};

export type PooledExpertReviewManifestItem = {
  reviewItemId: string;
  queryId: string;
  startupId: string;
  fundingRoundId: string;
  investorId: string;
  evidenceSha256: string;
  sources: PooledExpertReviewSource[];
};

export type PooledExpertReviewManifest = {
  schemaVersion: typeof POOLED_EXPERT_REVIEW_MANIFEST_SCHEMA_VERSION;
  reviewSchemaVersion: "expert-review-v1";
  packId: string;
  createdAt: string;
  fileName: string;
  csvSha256: string;
  shuffleSeedSha256: string;
  comparison: {
    experimentId: string;
    sha256: string;
    candidatePoolSha256: string;
  };
  topK: number;
  queryCount: number;
  rowCount: number;
  items: PooledExpertReviewManifestItem[];
};

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

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

function finiteNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
  return value;
}

function requireSha256(value: unknown, label: string): string {
  const parsed = string(value, label);
  if (!/^[a-f0-9]{64}$/.test(parsed)) {
    throw new Error(`${label} must be a lowercase SHA-256 hash.`);
  }
  return parsed;
}

function isoTimestamp(value: unknown, label: string): string {
  const parsed = new Date(string(value, label));
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} must be an ISO timestamp.`);
  }
  return parsed.toISOString();
}

function profile(value: unknown, label: string): ExpertReviewProfile {
  const parsed = string(value, label);
  if (!(PROFILES as readonly string[]).includes(parsed)) {
    throw new Error(`${label} must be legacy or normalisation-v1.`);
  }
  return parsed as ExpertReviewProfile;
}

function evidenceHash(row: ExpertReviewRow): string {
  return sha256(
    JSON.stringify(EVIDENCE_COLUMNS.map(column => [column, row[column]])),
  );
}

function contentHash(row: ExpertReviewRow): string {
  return sha256(
    JSON.stringify(CONTENT_COLUMNS.map(column => [column, row[column]])),
  );
}

function pairKey(queryId: string, investorId: string): string {
  return `${queryId}\u0000${investorId}`;
}

export function buildPooledExpertReviewPack(args: {
  comparison: unknown;
  comparisonSha256: string;
  packId: string;
  createdAt: string;
  fileName: string;
}): {
  rows: ExpertReviewRow[];
  csv: string;
  manifest: PooledExpertReviewManifest;
} {
  const comparison = object(args.comparison, "comparison");
  const run = object(comparison.run, "comparison.run");
  if (run.schemaVersion !== "normalisation-paired-comparison-v1") {
    throw new Error("comparison has an unsupported schemaVersion.");
  }
  const experimentId = string(run.experimentId, "comparison.run.experimentId");
  const topK = integer(run.topK, "comparison.run.topK");
  if (topK !== TOP_K) throw new Error(`comparison topK must be ${TOP_K}.`);
  const queryCount = integer(run.queryCount, "comparison.run.queryCount");
  if (queryCount < 2 || queryCount > 4) {
    throw new Error("comparison must contain two to four funding-round cases.");
  }
  const candidatePool = object(run.candidatePool, "comparison.run.candidatePool");
  const candidatePoolSha256 = requireSha256(
    candidatePool.candidatePoolSha256,
    "comparison.run.candidatePool.candidatePoolSha256",
  );
  const comparisonSha256 = requireSha256(
    args.comparisonSha256,
    "comparisonSha256",
  );
  const packId = string(args.packId, "packId");
  const createdAt = isoTimestamp(args.createdAt, "createdAt");
  const fileName = string(args.fileName, "fileName");
  if (!Array.isArray(comparison.queries) || comparison.queries.length !== queryCount) {
    throw new Error("comparison query count does not match comparison.run.");
  }

  const projected = Object.fromEntries(
    PROFILES.map(profileName => [
      profileName,
      buildExpertReviewPack({
        comparison,
        comparisonSha256,
        packId: `${packId}-projection-${profileName}`,
        profile: profileName,
        createdAt,
        fileName: `${profileName}.projection.local.csv`,
      }),
    ]),
  ) as Record<ExpertReviewProfile, ReturnType<typeof buildExpertReviewPack>>;

  const profileRows = new Map<string, ExpertReviewRow>();
  for (const profileName of PROFILES) {
    const pack = projected[profileName];
    const rowById = new Map(pack.rows.map(row => [row.review_item_id, row]));
    for (const item of pack.manifest.items) {
      const row = rowById.get(item.reviewItemId);
      if (!row) throw new Error(`Projection is missing ${item.reviewItemId}.`);
      profileRows.set(
        `${profileName}\u0000${pairKey(item.queryId, item.investorId)}`,
        row,
      );
    }
  }

  const pooled = new Map<
    string,
    { row: ExpertReviewRow; item: PooledExpertReviewManifestItem }
  >();
  for (const [queryIndex, rawQuery] of comparison.queries.entries()) {
    const query = object(rawQuery, `comparison.queries[${queryIndex}]`);
    const queryId = string(query.queryId, `queries[${queryIndex}].queryId`);
    const startupId = string(query.startupId, `${queryId}.startupId`);
    const fundingRoundId = string(
      query.fundingRoundId,
      `${queryId}.fundingRoundId`,
    );
    if (!Array.isArray(query.profiles) || query.profiles.length !== PROFILES.length) {
      throw new Error(`${queryId} must contain two normalisation profiles.`);
    }
    for (const [profileIndex, rawProfile] of query.profiles.entries()) {
      const profileValue = object(
        rawProfile,
        `${queryId}.profiles[${profileIndex}]`,
      );
      const profileName = profile(
        profileValue.normalisationProfile,
        `${queryId}.profiles[${profileIndex}].normalisationProfile`,
      );
      const configSha256 = requireSha256(
        profileValue.configSha256,
        `${queryId}.${profileName}.configSha256`,
      );
      if (!Array.isArray(profileValue.matches) || profileValue.matches.length !== TOP_K) {
        throw new Error(`${queryId} ${profileName} must contain ${TOP_K} matches.`);
      }
      for (const [matchIndex, rawMatch] of profileValue.matches.entries()) {
        const match = object(rawMatch, `${queryId}.${profileName}.matches[${matchIndex}]`);
        const systemRank = integer(match.rank, `${queryId}.${profileName}.rank`);
        if (systemRank !== matchIndex + 1) {
          throw new Error(`${queryId} ${profileName} ranks must be 1-${TOP_K}.`);
        }
        const investor = object(match.investor, `${queryId}.${profileName}.investor`);
        const investorId = string(
          investor.id,
          `${queryId}.${profileName}.investor.id`,
        );
        const scores = object(match.scores, `${queryId}.${profileName}.scores`);
        const systemScore = finiteNumber(
          scores.totalScore,
          `${queryId}.${profileName}.scores.totalScore`,
        );
        const key = pairKey(queryId, investorId);
        const projectionRow = profileRows.get(`${profileName}\u0000${key}`);
        if (!projectionRow) {
          throw new Error(`No projected evidence for ${queryId} + ${investorId}.`);
        }
        const existing = pooled.get(key);
        if (existing && contentHash(existing.row) !== contentHash(projectionRow)) {
          throw new Error(`Evidence differs across profiles for ${queryId} + ${investorId}.`);
        }
        const reviewItemId = existing?.item.reviewItemId
          ?? `item-${sha256(`${packId}\u0000${queryId}\u0000${investorId}`).slice(0, 20)}`;
        const row = existing?.row ?? {
          ...projectionRow,
          review_item_id: reviewItemId,
        };
        const sources = existing?.item.sources ?? [];
        if (sources.some(source => source.profile === profileName)) {
          throw new Error(`${queryId} ${profileName} repeats investor ${investorId}.`);
        }
        sources.push({ profile: profileName, systemRank, systemScore, configSha256 });
        pooled.set(key, {
          row,
          item: {
            reviewItemId,
            queryId,
            startupId,
            fundingRoundId,
            investorId,
            evidenceSha256: evidenceHash(row),
            sources,
          },
        });
      }
    }
  }

  const shuffleSeedSha256 = sha256(
    JSON.stringify({
      packId,
      comparisonSha256,
      pairs: [...pooled.keys()].sort(),
    }),
  );
  const entries = [...pooled.values()].sort((left, right) =>
    sha256(`${shuffleSeedSha256}\u0000${left.item.reviewItemId}`).localeCompare(
      sha256(`${shuffleSeedSha256}\u0000${right.item.reviewItemId}`),
    ),
  );
  const rows = entries.map(entry => entry.row);
  const items = entries.map(entry => ({
    ...entry.item,
    sources: [...entry.item.sources].sort(
      (left, right) => PROFILES.indexOf(left.profile) - PROFILES.indexOf(right.profile),
    ),
  }));
  const csv = serialiseExpertReviewCsv(rows);
  return {
    rows,
    csv,
    manifest: {
      schemaVersion: POOLED_EXPERT_REVIEW_MANIFEST_SCHEMA_VERSION,
      reviewSchemaVersion: "expert-review-v1",
      packId,
      createdAt,
      fileName,
      csvSha256: sha256(csv),
      shuffleSeedSha256,
      comparison: {
        experimentId,
        sha256: comparisonSha256,
        candidatePoolSha256,
      },
      topK,
      queryCount,
      rowCount: rows.length,
      items,
    },
  };
}

export function parsePooledExpertReviewManifest(
  raw: unknown,
): PooledExpertReviewManifest {
  const manifest = object(raw, "pooled expert review manifest");
  if (manifest.schemaVersion !== POOLED_EXPERT_REVIEW_MANIFEST_SCHEMA_VERSION) {
    throw new Error("Pooled expert review manifest schemaVersion is not recognised.");
  }
  if (manifest.reviewSchemaVersion !== "expert-review-v1") {
    throw new Error("Pooled expert review schemaVersion is not recognised.");
  }
  const topK = integer(manifest.topK, "manifest.topK");
  if (topK !== TOP_K) throw new Error(`manifest.topK must be ${TOP_K}.`);
  const queryCount = integer(manifest.queryCount, "manifest.queryCount");
  if (queryCount < 2 || queryCount > 4) {
    throw new Error("manifest.queryCount must be two to four.");
  }
  const rowCount = integer(manifest.rowCount, "manifest.rowCount");
  if (!Array.isArray(manifest.items) || manifest.items.length !== rowCount) {
    throw new Error("manifest.items does not match rowCount.");
  }
  const seenItems = new Set<string>();
  const items = manifest.items.map((rawItem, itemIndex) => {
    const item = object(rawItem, `manifest.items[${itemIndex}]`);
    const reviewItemId = string(item.reviewItemId, `items[${itemIndex}].reviewItemId`);
    if (seenItems.has(reviewItemId)) {
      throw new Error(`manifest repeats review item ${reviewItemId}.`);
    }
    seenItems.add(reviewItemId);
    if (!Array.isArray(item.sources) || item.sources.length < 1 || item.sources.length > 2) {
      throw new Error(`items[${itemIndex}].sources must contain one or two profiles.`);
    }
    const seenProfiles = new Set<string>();
    const sources = item.sources.map((rawSource, sourceIndex) => {
      const source = object(rawSource, `items[${itemIndex}].sources[${sourceIndex}]`);
      const sourceProfile = profile(
        source.profile,
        `items[${itemIndex}].sources[${sourceIndex}].profile`,
      );
      if (seenProfiles.has(sourceProfile)) {
        throw new Error(`items[${itemIndex}] repeats source ${sourceProfile}.`);
      }
      seenProfiles.add(sourceProfile);
      const systemRank = integer(
        source.systemRank,
        `items[${itemIndex}].sources[${sourceIndex}].systemRank`,
      );
      if (systemRank < 1 || systemRank > TOP_K) {
        throw new Error(`items[${itemIndex}].systemRank must be 1-${TOP_K}.`);
      }
      return {
        profile: sourceProfile,
        systemRank,
        systemScore: finiteNumber(
          source.systemScore,
          `items[${itemIndex}].sources[${sourceIndex}].systemScore`,
        ),
        configSha256: requireSha256(
          source.configSha256,
          `items[${itemIndex}].sources[${sourceIndex}].configSha256`,
        ),
      };
    });
    return {
      reviewItemId,
      queryId: string(item.queryId, `items[${itemIndex}].queryId`),
      startupId: string(item.startupId, `items[${itemIndex}].startupId`),
      fundingRoundId: string(
        item.fundingRoundId,
        `items[${itemIndex}].fundingRoundId`,
      ),
      investorId: string(item.investorId, `items[${itemIndex}].investorId`),
      evidenceSha256: requireSha256(
        item.evidenceSha256,
        `items[${itemIndex}].evidenceSha256`,
      ),
      sources,
    };
  });
  const queryIds = new Set(items.map(item => item.queryId));
  if (queryIds.size !== queryCount) {
    throw new Error("manifest item query count does not match queryCount.");
  }
  for (const queryId of queryIds) {
    for (const profileName of PROFILES) {
      const profileItems = items
        .filter(item => item.queryId === queryId)
        .flatMap(item =>
          item.sources
            .filter(source => source.profile === profileName)
            .map(source => ({ item, source })),
        );
      if (
        profileItems.length !== TOP_K
        || new Set(profileItems.map(value => value.source.systemRank)).size !== TOP_K
      ) {
        throw new Error(`${queryId} ${profileName} must contain ranks 1-${TOP_K}.`);
      }
    }
  }
  const comparison = object(manifest.comparison, "manifest.comparison");
  return {
    schemaVersion: POOLED_EXPERT_REVIEW_MANIFEST_SCHEMA_VERSION,
    reviewSchemaVersion: "expert-review-v1",
    packId: string(manifest.packId, "manifest.packId"),
    createdAt: isoTimestamp(manifest.createdAt, "manifest.createdAt"),
    fileName: string(manifest.fileName, "manifest.fileName"),
    csvSha256: requireSha256(manifest.csvSha256, "manifest.csvSha256"),
    shuffleSeedSha256: requireSha256(
      manifest.shuffleSeedSha256,
      "manifest.shuffleSeedSha256",
    ),
    comparison: {
      experimentId: string(
        comparison.experimentId,
        "manifest.comparison.experimentId",
      ),
      sha256: requireSha256(comparison.sha256, "manifest.comparison.sha256"),
      candidatePoolSha256: requireSha256(
        comparison.candidatePoolSha256,
        "manifest.comparison.candidatePoolSha256",
      ),
    },
    topK,
    queryCount,
    rowCount,
    items,
  };
}

function rounded(value: number): number {
  return Number(value.toFixed(6));
}

function mean(values: readonly number[]): number {
  if (values.length === 0) throw new Error("Cannot average an empty list.");
  return rounded(values.reduce((sum, value) => sum + value, 0) / values.length);
}

type PositiveRate = {
  thumbsUpAt5: number;
  thumbsUpAt10: number;
  positiveCountAt10: number;
};

function positiveRate(values: readonly { systemRank: number; thumbsUp: boolean }[]): PositiveRate {
  if (values.length !== TOP_K) {
    throw new Error(`Each query must contain ${TOP_K} reviewed matches.`);
  }
  const ranked = [...values].sort((left, right) => left.systemRank - right.systemRank);
  const positiveCountAt10 = ranked.filter(value => value.thumbsUp).length;
  return {
    thumbsUpAt5: rounded(ranked.slice(0, 5).filter(value => value.thumbsUp).length / 5),
    thumbsUpAt10: rounded(positiveCountAt10 / TOP_K),
    positiveCountAt10,
  };
}

function macro(values: readonly PositiveRate[]): PositiveRate {
  return {
    thumbsUpAt5: mean(values.map(value => value.thumbsUpAt5)),
    thumbsUpAt10: mean(values.map(value => value.thumbsUpAt10)),
    positiveCountAt10: mean(values.map(value => value.positiveCountAt10)),
  };
}

function delta(optimised: PositiveRate, baseline: PositiveRate): PositiveRate {
  return {
    thumbsUpAt5: rounded(optimised.thumbsUpAt5 - baseline.thumbsUpAt5),
    thumbsUpAt10: rounded(optimised.thumbsUpAt10 - baseline.thumbsUpAt10),
    positiveCountAt10: optimised.positiveCountAt10 - baseline.positiveCountAt10,
  };
}

export function buildPooledExpertReviewEvaluation(args: {
  reviews: readonly {
    fileName: string;
    csv: string;
    manifest: PooledExpertReviewManifest;
  }[];
}) {
  if (args.reviews.length < 1) {
    throw new Error("At least one completed pooled review is required.");
  }
  const completed = args.reviews.map(review => {
    const manifest = parsePooledExpertReviewManifest(review.manifest);
    const rows = parseExpertReviewCsv(review.csv, review.fileName);
    if (rows.length !== manifest.rowCount) {
      throw new Error(`${review.fileName} row count does not match its manifest.`);
    }
    const rowById = new Map<string, ExpertReviewRow>();
    for (const row of rows) {
      if (rowById.has(row.review_item_id)) {
        throw new Error(`${review.fileName} repeats ${row.review_item_id}.`);
      }
      rowById.set(row.review_item_id, row);
    }
    const reviewerIds = new Set<string>();
    const labels = new Map<string, boolean>();
    for (const item of manifest.items) {
      const row = rowById.get(item.reviewItemId);
      if (!row) throw new Error(`${review.fileName} is missing ${item.reviewItemId}.`);
      if (evidenceHash(row) !== item.evidenceSha256) {
        throw new Error(`${review.fileName} changed evidence for ${item.reviewItemId}.`);
      }
      const reviewerId = row.reviewer_id.trim();
      if (!reviewerId) throw new Error(`${review.fileName} has a blank reviewer_id.`);
      reviewerIds.add(reviewerId);
      const judgement = row.thumbs_up.trim().toLowerCase();
      if (judgement !== "up" && judgement !== "down") {
        throw new Error(`${review.fileName} thumbs_up values must be up or down.`);
      }
      if (!row.review_comment.trim()) {
        throw new Error(`${review.fileName} requires a review_comment for every row.`);
      }
      labels.set(item.reviewItemId, judgement === "up");
    }
    if (rowById.size !== manifest.items.length) {
      throw new Error(`${review.fileName} contains items not present in its manifest.`);
    }
    if (reviewerIds.size !== 1) {
      throw new Error(`${review.fileName} must contain exactly one reviewer_id.`);
    }
    return {
      fileName: review.fileName,
      reviewerId: [...reviewerIds][0],
      manifest,
      labels,
    };
  });
  const manifestIdentities = new Set(
    completed.map(review =>
      JSON.stringify({
        packId: review.manifest.packId,
        comparison: review.manifest.comparison,
        items: review.manifest.items,
      }),
    ),
  );
  if (manifestIdentities.size !== 1) {
    throw new Error("All pooled reviews must use the same private manifest.");
  }
  const reviewerIds = new Set<string>();
  const reviewers = completed.map(review => {
    if (reviewerIds.has(review.reviewerId)) {
      throw new Error(`Reviewer ${review.reviewerId} supplied more than one pooled review.`);
    }
    reviewerIds.add(review.reviewerId);
    const queryIds = [...new Set(review.manifest.items.map(item => item.queryId))].sort();
    const profiles = Object.fromEntries(PROFILES.map(profileName => {
      const queries = queryIds.map(queryId => {
        const ranked = review.manifest.items
          .filter(item => item.queryId === queryId)
          .flatMap(item =>
            item.sources
              .filter(source => source.profile === profileName)
              .map(source => ({
                systemRank: source.systemRank,
                thumbsUp: review.labels.get(item.reviewItemId)!,
              })),
          );
        return { queryId, ...positiveRate(ranked) };
      });
      return [profileName, { queries, macro: macro(queries) }];
    })) as Record<ExpertReviewProfile, {
      queries: Array<PositiveRate & { queryId: string }>;
      macro: PositiveRate;
    }>;
    return {
      reviewerId: review.reviewerId,
      profiles,
      delta: delta(profiles["normalisation-v1"].macro, profiles.legacy.macro),
    };
  });

  const aggregateProfiles = Object.fromEntries(PROFILES.map(profileName => [
    profileName,
    macro(reviewers.map(reviewer => reviewer.profiles[profileName].macro)),
  ])) as Record<ExpertReviewProfile, PositiveRate>;
  let agreements = 0;
  let comparisons = 0;
  const itemIds = completed[0].manifest.items.map(item => item.reviewItemId);
  for (const itemId of itemIds) {
    const values = completed.map(review => review.labels.get(itemId)!);
    for (let left = 0; left < values.length; left += 1) {
      for (let right = left + 1; right < values.length; right += 1) {
        comparisons += 1;
        if (values[left] === values[right]) agreements += 1;
      }
    }
  }
  return {
    schemaVersion: POOLED_EXPERT_REVIEW_EVALUATION_SCHEMA_VERSION,
    comparison: completed[0].manifest.comparison,
    packId: completed[0].manifest.packId,
    reviewerCount: reviewers.length,
    reviewers,
    aggregate: {
      profiles: aggregateProfiles,
      delta: delta(
        aggregateProfiles["normalisation-v1"],
        aggregateProfiles.legacy,
      ),
      agreement: comparisons === 0
        ? null
        : { rate: rounded(agreements / comparisons), agreements, comparisons },
    },
    interpretationBoundary: [
      "This is a small four-case expert-proxy study, not a statistically powered population estimate.",
      "A model-assisted judgement must not be described as a human expert review.",
      "The result is an initial indication and does not establish general improvement.",
    ],
  };
}
