import { createHash } from "node:crypto";
import { parse } from "csv-parse/sync";

export const EXPERT_REVIEW_SCHEMA_VERSION = "expert-review-v1";
export const EXPERT_REVIEW_MANIFEST_SCHEMA_VERSION =
  "expert-review-pack-manifest-v1";
export const EXPERT_REVIEW_EVALUATION_SCHEMA_VERSION =
  "expert-review-evaluation-v1";

export const EXPERT_REVIEW_COLUMNS = [
  "review_item_id",
  "reviewer_id",
  "case_id",
  "startup_name",
  "startup_description",
  "climate_problem",
  "solution_description",
  "business_model",
  "target_market",
  "traction_summary",
  "unfair_advantage",
  "tweet_pitch",
  "funding_stage",
  "amount_raising",
  "minimum_ticket_size",
  "investment_types",
  "funding_geography",
  "funding_sectors",
  "preferred_investor_types",
  "investor_organisation",
  "investor_type",
  "investor_description",
  "investor_stages",
  "investor_ticket_range",
  "investor_instruments",
  "investor_geography",
  "investor_thesis",
  "thumbs_up",
  "review_comment",
] as const;

const EVIDENCE_COLUMNS = EXPERT_REVIEW_COLUMNS.filter(
  column =>
    column !== "reviewer_id"
    && column !== "thumbs_up"
    && column !== "review_comment",
);
const PROFILES = ["legacy", "normalisation-v1"] as const;
const TOP_K = 10;

export type ExpertReviewColumn = (typeof EXPERT_REVIEW_COLUMNS)[number];
export type ExpertReviewRow = Record<ExpertReviewColumn, string>;
export type ExpertReviewProfile = (typeof PROFILES)[number];

export type ExpertReviewManifestItem = {
  reviewItemId: string;
  queryId: string;
  startupId: string;
  fundingRoundId: string;
  investorId: string;
  systemRank: number;
  evidenceSha256: string;
};

export type ExpertReviewPackManifest = {
  schemaVersion: typeof EXPERT_REVIEW_MANIFEST_SCHEMA_VERSION;
  reviewSchemaVersion: typeof EXPERT_REVIEW_SCHEMA_VERSION;
  packId: string;
  createdAt: string;
  fileName: string;
  csvSha256: string;
  comparison: {
    experimentId: string;
    sha256: string;
    candidatePoolSha256: string;
  };
  profile: ExpertReviewProfile;
  topK: number;
  queryCount: number;
  rowCount: number;
  items: ExpertReviewManifestItem[];
};

type JsonObject = Record<string, unknown>;

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

function optionalString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function integer(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`${label} must be an integer.`);
  }
  return value;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function requireSha256(value: unknown, label: string): string {
  const parsed = string(value, label);
  if (!/^[a-f0-9]{64}$/.test(parsed)) {
    throw new Error(`${label} must be a lowercase SHA-256 value.`);
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

function list(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map(item => item.trim())
    .filter(Boolean);
}

function joined(value: unknown): string {
  return list(value).join(" | ");
}

function displayedNumber(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value)
    ? String(value)
    : "";
}

function ticketRange(investor: JsonObject): string {
  const minimum = displayedNumber(investor.minTicketSize);
  const maximum = displayedNumber(investor.maxTicketSize);
  if (minimum && maximum) return `${minimum} - ${maximum}`;
  return minimum || maximum;
}

function quoteCsvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function evidenceHash(row: ExpertReviewRow): string {
  return sha256(
    JSON.stringify(EVIDENCE_COLUMNS.map(column => [column, row[column]])),
  );
}

export function serialiseExpertReviewCsv(
  rows: readonly ExpertReviewRow[],
): string {
  if (rows.length === 0) {
    throw new Error("Expert review CSV needs at least one row.");
  }
  const lines = [EXPERT_REVIEW_COLUMNS.map(quoteCsvCell).join(",")];
  for (const [index, row] of rows.entries()) {
    if (
      Object.keys(row).join(",") !== EXPERT_REVIEW_COLUMNS.join(",")
    ) {
      throw new Error(`Expert review row ${index + 1} has invalid columns.`);
    }
    lines.push(
      EXPERT_REVIEW_COLUMNS.map(column => quoteCsvCell(row[column])).join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

export function parseExpertReviewCsv(
  csv: string,
  label = "Expert review CSV",
): ExpertReviewRow[] {
  const records = parse(csv, {
    bom: true,
    columns: false,
    skip_empty_lines: true,
  }) as string[][];
  const headers = records[0] ?? [];
  if (headers.join(",") !== EXPERT_REVIEW_COLUMNS.join(",")) {
    throw new Error(`${label} headers do not match the fixed column order.`);
  }
  return records.slice(1).map((values, index) => {
    if (values.length !== EXPERT_REVIEW_COLUMNS.length) {
      throw new Error(
        `${label} row ${index + 1} has ${values.length} columns; expected ${EXPERT_REVIEW_COLUMNS.length}.`,
      );
    }
    return Object.fromEntries(
      EXPERT_REVIEW_COLUMNS.map((column, columnIndex) => [
        column,
        values[columnIndex] ?? "",
      ]),
    ) as ExpertReviewRow;
  });
}

function profile(value: unknown, label: string): ExpertReviewProfile {
  const parsed = string(value, label);
  if (!(PROFILES as readonly string[]).includes(parsed)) {
    throw new Error(`${label} must be legacy or normalisation-v1.`);
  }
  return parsed as ExpertReviewProfile;
}

function buildReviewRow(args: {
  reviewItemId: string;
  queryId: string;
  context: JsonObject;
  investor: JsonObject;
}): ExpertReviewRow {
  const row = {
    review_item_id: args.reviewItemId,
    reviewer_id: "",
    case_id: args.queryId,
    startup_name: string(args.context.startupName, "startupName"),
    startup_description: string(
      args.context.description,
      "startup description",
    ),
    climate_problem: optionalString(args.context.climateProblem),
    solution_description: optionalString(args.context.solutionDescription),
    business_model: optionalString(args.context.businessModel),
    target_market: optionalString(args.context.targetMarket),
    traction_summary: optionalString(args.context.tractionSummary),
    unfair_advantage: optionalString(args.context.unfairAdvantage),
    tweet_pitch: optionalString(args.context.tweetPitch),
    funding_stage: string(args.context.roundStage, "funding stage"),
    amount_raising: displayedNumber(args.context.amountRaising),
    minimum_ticket_size: displayedNumber(args.context.minTicketSize),
    investment_types: joined(args.context.investmentTypes),
    funding_geography: optionalString(args.context.roundGeography),
    funding_sectors: joined(args.context.roundSectors),
    preferred_investor_types: joined(args.context.preferredInvestorTypes),
    investor_organisation: string(
      args.investor.organisation,
      "investor organisation",
    ),
    investor_type: joined(args.investor.investorType),
    investor_description: optionalString(args.investor.description),
    investor_stages: joined(args.investor.investmentStage),
    investor_ticket_range: ticketRange(args.investor),
    investor_instruments: joined(args.investor.investmentInstruments),
    investor_geography: [
      joined(args.investor.regionalFocus),
      optionalString(args.investor.hqLocation),
    ].filter(Boolean).join(" | "),
    investor_thesis: optionalString(args.investor.investmentThesis),
    thumbs_up: "",
    review_comment: "",
  } satisfies ExpertReviewRow;
  return row;
}

export function buildExpertReviewPack(args: {
  comparison: unknown;
  comparisonSha256: string;
  packId: string;
  profile: ExpertReviewProfile;
  createdAt: string;
  fileName: string;
}): {
  rows: ExpertReviewRow[];
  csv: string;
  manifest: ExpertReviewPackManifest;
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
  requireSha256(args.comparisonSha256, "comparisonSha256");
  const candidatePool = object(run.candidatePool, "comparison.run.candidatePool");
  const candidatePoolSha256 = requireSha256(
    candidatePool.candidatePoolSha256,
    "comparison.run.candidatePool.candidatePoolSha256",
  );
  const packId = string(args.packId, "packId");
  const createdAt = isoTimestamp(args.createdAt, "createdAt");
  const fileName = string(args.fileName, "fileName");
  if (!(PROFILES as readonly string[]).includes(args.profile)) {
    throw new Error("profile must be legacy or normalisation-v1.");
  }
  if (!Array.isArray(comparison.queries) || comparison.queries.length !== queryCount) {
    throw new Error("comparison query count does not match comparison.run.");
  }

  const rows: ExpertReviewRow[] = [];
  const items: ExpertReviewManifestItem[] = [];
  const seenQueries = new Set<string>();
  for (const [queryIndex, rawQuery] of comparison.queries.entries()) {
    const query = object(rawQuery, `comparison.queries[${queryIndex}]`);
    const queryId = string(query.queryId, `queries[${queryIndex}].queryId`);
    if (seenQueries.has(queryId)) throw new Error(`Duplicate query ${queryId}.`);
    seenQueries.add(queryId);
    const startupId = string(query.startupId, `${queryId}.startupId`);
    const fundingRoundId = string(
      query.fundingRoundId,
      `${queryId}.fundingRoundId`,
    );
    const context = object(query.reviewContext, `${queryId}.reviewContext`);
    if (!Array.isArray(query.profiles)) {
      throw new Error(`${queryId}.profiles must be an array.`);
    }
    const selected = query.profiles
      .map((value, profileIndex) =>
        object(value, `${queryId}.profiles[${profileIndex}]`),
      )
      .find(value => value.normalisationProfile === args.profile);
    if (!selected) throw new Error(`${queryId} has no ${args.profile} profile.`);
    if (!Array.isArray(selected.matches) || selected.matches.length !== topK) {
      throw new Error(`${queryId} ${args.profile} must contain ${topK} matches.`);
    }
    const seenInvestors = new Set<string>();
    selected.matches.forEach((rawMatch, matchIndex) => {
      const match = object(rawMatch, `${queryId}.matches[${matchIndex}]`);
      const systemRank = integer(match.rank, `${queryId}.matches[${matchIndex}].rank`);
      if (systemRank !== matchIndex + 1) {
        throw new Error(`${queryId} ${args.profile} ranks must be 1-${topK}.`);
      }
      const investor = object(
        match.investor,
        `${queryId}.matches[${matchIndex}].investor`,
      );
      const investorId = string(
        investor.id,
        `${queryId}.matches[${matchIndex}].investor.id`,
      );
      if (seenInvestors.has(investorId)) {
        throw new Error(`${queryId} ${args.profile} repeats investor ${investorId}.`);
      }
      seenInvestors.add(investorId);
      const reviewItemId = `item-${sha256(
        `${packId}\u0000${args.profile}\u0000${queryId}\u0000${investorId}`,
      ).slice(0, 20)}`;
      const row = buildReviewRow({ reviewItemId, queryId, context, investor });
      rows.push(row);
      items.push({
        reviewItemId,
        queryId,
        startupId,
        fundingRoundId,
        investorId,
        systemRank,
        evidenceSha256: evidenceHash(row),
      });
    });
  }

  const stableOrder = new Map(
    items.map(item => [
      item.reviewItemId,
      sha256(`${packId}\u0000${item.reviewItemId}`),
    ]),
  );
  rows.sort((left, right) =>
    stableOrder.get(left.review_item_id)!.localeCompare(
      stableOrder.get(right.review_item_id)!,
    ),
  );
  items.sort((left, right) =>
    stableOrder.get(left.reviewItemId)!.localeCompare(
      stableOrder.get(right.reviewItemId)!,
    ),
  );
  const csv = serialiseExpertReviewCsv(rows);
  return {
    rows,
    csv,
    manifest: {
      schemaVersion: EXPERT_REVIEW_MANIFEST_SCHEMA_VERSION,
      reviewSchemaVersion: EXPERT_REVIEW_SCHEMA_VERSION,
      packId,
      createdAt,
      fileName,
      csvSha256: sha256(csv),
      comparison: {
        experimentId,
        sha256: args.comparisonSha256,
        candidatePoolSha256,
      },
      profile: args.profile,
      topK,
      queryCount,
      rowCount: rows.length,
      items,
    },
  };
}

export function parseExpertReviewManifest(
  raw: unknown,
): ExpertReviewPackManifest {
  const manifest = object(raw, "expert review manifest");
  if (manifest.schemaVersion !== EXPERT_REVIEW_MANIFEST_SCHEMA_VERSION) {
    throw new Error("Expert review manifest schemaVersion is not recognised.");
  }
  if (manifest.reviewSchemaVersion !== EXPERT_REVIEW_SCHEMA_VERSION) {
    throw new Error("Expert review schemaVersion is not recognised.");
  }
  const parsedProfile = profile(manifest.profile, "manifest.profile");
  const topK = integer(manifest.topK, "manifest.topK");
  if (topK !== TOP_K) throw new Error(`manifest.topK must be ${TOP_K}.`);
  const queryCount = integer(manifest.queryCount, "manifest.queryCount");
  if (queryCount < 2 || queryCount > 4) {
    throw new Error("manifest.queryCount must be two to four.");
  }
  const rowCount = integer(manifest.rowCount, "manifest.rowCount");
  if (rowCount !== queryCount * topK) {
    throw new Error("manifest.rowCount must equal queryCount × topK.");
  }
  if (!Array.isArray(manifest.items) || manifest.items.length !== rowCount) {
    throw new Error("manifest.items does not match rowCount.");
  }
  const seenItems = new Set<string>();
  const items = manifest.items.map((rawItem, index) => {
    const item = object(rawItem, `manifest.items[${index}]`);
    const reviewItemId = string(item.reviewItemId, `items[${index}].reviewItemId`);
    if (seenItems.has(reviewItemId)) {
      throw new Error(`manifest repeats review item ${reviewItemId}.`);
    }
    seenItems.add(reviewItemId);
    const systemRank = integer(item.systemRank, `items[${index}].systemRank`);
    if (systemRank < 1 || systemRank > TOP_K) {
      throw new Error(`items[${index}].systemRank must be 1-${TOP_K}.`);
    }
    return {
      reviewItemId,
      queryId: string(item.queryId, `items[${index}].queryId`),
      startupId: string(item.startupId, `items[${index}].startupId`),
      fundingRoundId: string(
        item.fundingRoundId,
        `items[${index}].fundingRoundId`,
      ),
      investorId: string(item.investorId, `items[${index}].investorId`),
      systemRank,
      evidenceSha256: requireSha256(
        item.evidenceSha256,
        `items[${index}].evidenceSha256`,
      ),
    };
  });
  const queryIds = new Set(items.map(item => item.queryId));
  if (queryIds.size !== queryCount) {
    throw new Error("manifest item query count does not match queryCount.");
  }
  for (const queryId of queryIds) {
    const queryItems = items.filter(item => item.queryId === queryId);
    if (
      queryItems.length !== TOP_K
      || new Set(queryItems.map(item => item.systemRank)).size !== TOP_K
    ) {
      throw new Error(`${queryId} must contain ranks 1-${TOP_K}.`);
    }
  }
  const comparison = object(manifest.comparison, "manifest.comparison");
  return {
    schemaVersion: EXPERT_REVIEW_MANIFEST_SCHEMA_VERSION,
    reviewSchemaVersion: EXPERT_REVIEW_SCHEMA_VERSION,
    packId: string(manifest.packId, "manifest.packId"),
    createdAt: isoTimestamp(manifest.createdAt, "manifest.createdAt"),
    fileName: string(manifest.fileName, "manifest.fileName"),
    csvSha256: requireSha256(manifest.csvSha256, "manifest.csvSha256"),
    comparison: {
      experimentId: string(
        comparison.experimentId,
        "manifest.comparison.experimentId",
      ),
      sha256: requireSha256(
        comparison.sha256,
        "manifest.comparison.sha256",
      ),
      candidatePoolSha256: requireSha256(
        comparison.candidatePoolSha256,
        "manifest.comparison.candidatePoolSha256",
      ),
    },
    profile: parsedProfile,
    topK,
    queryCount,
    rowCount,
    items,
  };
}

type CompletedReview = {
  reviewerId: string;
  profile: ExpertReviewProfile;
  comparison: ExpertReviewPackManifest["comparison"];
  labels: Array<ExpertReviewManifestItem & { thumbsUp: boolean }>;
};

export function validateCompletedExpertReview(args: {
  csv: string;
  manifest: ExpertReviewPackManifest;
  label?: string;
}): CompletedReview {
  const label = args.label ?? "Completed expert review";
  const manifest = parseExpertReviewManifest(args.manifest);
  const rows = parseExpertReviewCsv(args.csv, label);
  if (rows.length !== manifest.rowCount) {
    throw new Error(`${label} row count does not match its manifest.`);
  }
  const rowById = new Map<string, ExpertReviewRow>();
  for (const row of rows) {
    if (rowById.has(row.review_item_id)) {
      throw new Error(`${label} repeats ${row.review_item_id}.`);
    }
    rowById.set(row.review_item_id, row);
  }
  const reviewerIds = new Set<string>();
  const labels = manifest.items.map(item => {
    const row = rowById.get(item.reviewItemId);
    if (!row) throw new Error(`${label} is missing ${item.reviewItemId}.`);
    if (evidenceHash(row) !== item.evidenceSha256) {
      throw new Error(`${label} changed evidence for ${item.reviewItemId}.`);
    }
    const reviewerId = row.reviewer_id.trim();
    if (!reviewerId) {
      throw new Error(`${label} has a blank reviewer_id.`);
    }
    reviewerIds.add(reviewerId);
    const judgement = row.thumbs_up.trim().toLowerCase();
    if (judgement !== "up" && judgement !== "down") {
      throw new Error(`${label} thumbs_up values must be up or down.`);
    }
    if (!row.review_comment.trim()) {
      throw new Error(`${label} requires a review_comment for every row.`);
    }
    return { ...item, thumbsUp: judgement === "up" };
  });
  if (rowById.size !== manifest.items.length) {
    throw new Error(`${label} contains review items not present in its manifest.`);
  }
  if (reviewerIds.size !== 1) {
    throw new Error(`${label} must contain exactly one reviewer_id.`);
  }
  return {
    reviewerId: [...reviewerIds][0],
    profile: manifest.profile,
    comparison: manifest.comparison,
    labels,
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

function positiveRate(
  labels: readonly (ExpertReviewManifestItem & { thumbsUp: boolean })[],
): PositiveRate {
  if (labels.length !== TOP_K) {
    throw new Error(`Each query must contain ${TOP_K} reviewed matches.`);
  }
  const ranked = [...labels].sort((left, right) => left.systemRank - right.systemRank);
  const positiveCountAt10 = ranked.filter(item => item.thumbsUp).length;
  return {
    thumbsUpAt5: rounded(ranked.slice(0, 5).filter(item => item.thumbsUp).length / 5),
    thumbsUpAt10: rounded(positiveCountAt10 / TOP_K),
    positiveCountAt10,
  };
}

function delta(optimised: PositiveRate, baseline: PositiveRate): PositiveRate {
  return {
    thumbsUpAt5: rounded(optimised.thumbsUpAt5 - baseline.thumbsUpAt5),
    thumbsUpAt10: rounded(optimised.thumbsUpAt10 - baseline.thumbsUpAt10),
    positiveCountAt10: optimised.positiveCountAt10 - baseline.positiveCountAt10,
  };
}

function macro(values: readonly PositiveRate[]): PositiveRate {
  return {
    thumbsUpAt5: mean(values.map(value => value.thumbsUpAt5)),
    thumbsUpAt10: mean(values.map(value => value.thumbsUpAt10)),
    positiveCountAt10: mean(values.map(value => value.positiveCountAt10)),
  };
}

export function buildExpertReviewEvaluation(args: {
  reviews: readonly {
    fileName: string;
    csv: string;
    manifest: ExpertReviewPackManifest;
  }[];
}) {
  if (args.reviews.length < 2) {
    throw new Error("At least one completed baseline and optimised review is required.");
  }
  const completed = args.reviews.map(review => ({
    fileName: review.fileName,
    ...validateCompletedExpertReview(review),
  }));
  const experimentIds = new Set(
    completed.map(review => review.comparison.experimentId),
  );
  const comparisonHashes = new Set(
    completed.map(review => review.comparison.sha256),
  );
  const candidatePoolHashes = new Set(
    completed.map(review => review.comparison.candidatePoolSha256),
  );
  if (
    experimentIds.size !== 1
    || comparisonHashes.size !== 1
    || candidatePoolHashes.size !== 1
  ) {
    throw new Error("All expert reviews must refer to the same paired comparison.");
  }
  const reviewerIds = [...new Set(completed.map(review => review.reviewerId))].sort();
  const reviewers = reviewerIds.map(reviewerId => {
    const reviewerRuns = completed.filter(review => review.reviewerId === reviewerId);
    const byProfile = new Map(
      reviewerRuns.map(review => [review.profile, review]),
    );
    if (byProfile.size !== PROFILES.length || reviewerRuns.length !== PROFILES.length) {
      throw new Error(
        `Reviewer ${reviewerId} must complete one legacy and one normalisation-v1 pack.`,
      );
    }
    const queryIds = [...new Set(
      reviewerRuns.flatMap(review => review.labels.map(label => label.queryId)),
    )].sort();
    const profiles = Object.fromEntries(PROFILES.map(profileName => {
      const review = byProfile.get(profileName)!;
      const queryMetrics = queryIds.map(queryId => ({
        queryId,
        ...positiveRate(review.labels.filter(label => label.queryId === queryId)),
      }));
      return [profileName, {
        queries: queryMetrics,
        macro: macro(queryMetrics),
      }];
    })) as Record<ExpertReviewProfile, {
      queries: Array<PositiveRate & { queryId: string }>;
      macro: PositiveRate;
    }>;
    return {
      reviewerId,
      profiles,
      delta: delta(profiles["normalisation-v1"].macro, profiles.legacy.macro),
    };
  });

  const aggregateProfiles = Object.fromEntries(PROFILES.map(profileName => [
    profileName,
    macro(reviewers.map(reviewer => reviewer.profiles[profileName].macro)),
  ])) as Record<ExpertReviewProfile, PositiveRate>;

  const labelsByPair = new Map<string, boolean[]>();
  for (const review of completed) {
    for (const label of review.labels) {
      const key = `${review.profile}\u0000${label.queryId}\u0000${label.investorId}`;
      const values = labelsByPair.get(key) ?? [];
      values.push(label.thumbsUp);
      labelsByPair.set(key, values);
    }
  }
  let agreementComparisons = 0;
  let agreements = 0;
  for (const values of labelsByPair.values()) {
    for (let left = 0; left < values.length; left += 1) {
      for (let right = left + 1; right < values.length; right += 1) {
        agreementComparisons += 1;
        if (values[left] === values[right]) agreements += 1;
      }
    }
  }

  return {
    schemaVersion: EXPERT_REVIEW_EVALUATION_SCHEMA_VERSION,
    comparison: {
      experimentId: [...experimentIds][0],
      sha256: [...comparisonHashes][0],
      candidatePoolSha256: [...candidatePoolHashes][0],
    },
    reviewerCount: reviewers.length,
    reviewers,
    aggregate: {
      profiles: aggregateProfiles,
      delta: delta(
        aggregateProfiles["normalisation-v1"],
        aggregateProfiles.legacy,
      ),
      agreement: agreementComparisons === 0
        ? null
        : {
            rate: rounded(agreements / agreementComparisons),
            agreements,
            comparisons: agreementComparisons,
          },
    },
    interpretationBoundary: [
      "This is a small expert case study, not a statistically powered population estimate.",
      "The reviewers know the startups and investors but are not the actual investment decision-makers.",
      "The results provide an initial indication only and must not be presented as proof of general improvement.",
    ],
  };
}
