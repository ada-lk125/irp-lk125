import { createHash } from "node:crypto";

export const CURATED_FEEDBACK_SELECTION_SCHEMA_VERSION =
  "curated-feedback-selection-v1";
export const MAX_CURATED_FEEDBACK_REASON_LENGTH = 500;

export type FeedbackRating = "up" | "down";
export type FeedbackEvidenceGroup = "useful" | "weak";

export interface FeedbackSelectionInput {
  feedbackId: string;
  investorId: string;
  investorName: string;
  fundingRoundId: string;
  startupName: string;
  rating: FeedbackRating;
  reason: string;
  evidenceGroup: FeedbackEvidenceGroup;
  createdAt: string;
}

export interface CuratedFeedbackSelectionSummary {
  sourceCount: number;
  usefulCount: number;
  weakCount: number;
  excludedCurrentRoundCount: number;
  selectedUpCount: number;
  selectedDownCount: number;
}

export interface CuratedFeedbackSelection {
  schemaVersion: typeof CURATED_FEEDBACK_SELECTION_SCHEMA_VERSION;
  feedbackSetVersion: string;
  feedbackSetHash: string;
  summary: CuratedFeedbackSelectionSummary;
  entries: FeedbackSelectionInput[];
}

function requireText(value: string, label: string): string {
  const text = value.trim();
  if (text.length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return text;
}

function normaliseReason(value: string, label: string): string {
  const reason = requireText(value, label).replace(/\s+/g, " ");
  if (reason.length > MAX_CURATED_FEEDBACK_REASON_LENGTH) {
    throw new Error(
      `${label} must not exceed ${MAX_CURATED_FEEDBACK_REASON_LENGTH} characters.`,
    );
  }
  return reason;
}

function normaliseTimestamp(value: string, label: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`${label} must be a valid timestamp.`);
  }
  return timestamp.toISOString();
}

function normaliseEntry(entry: FeedbackSelectionInput, index: number): FeedbackSelectionInput {
  const label = `entries[${index}]`;
  if (entry.rating !== "up" && entry.rating !== "down") {
    throw new Error(`${label}.rating must be up or down.`);
  }
  if (entry.evidenceGroup !== "useful" && entry.evidenceGroup !== "weak") {
    throw new Error(`${label}.evidenceGroup must be useful or weak.`);
  }

  return {
    feedbackId: requireText(entry.feedbackId, `${label}.feedbackId`),
    investorId: requireText(entry.investorId, `${label}.investorId`),
    investorName: requireText(entry.investorName, `${label}.investorName`),
    fundingRoundId: requireText(entry.fundingRoundId, `${label}.fundingRoundId`),
    startupName: requireText(entry.startupName, `${label}.startupName`),
    rating: entry.rating,
    reason: normaliseReason(entry.reason, `${label}.reason`),
    evidenceGroup: entry.evidenceGroup,
    createdAt: normaliseTimestamp(entry.createdAt, `${label}.createdAt`),
  };
}

function hashEntries(entries: readonly FeedbackSelectionInput[]): string {
  return createHash("sha256")
    .update(JSON.stringify(entries), "utf8")
    .digest("hex");
}

export function selectCuratedFeedback(args: {
  feedbackSetVersion: string;
  entries: readonly FeedbackSelectionInput[];
  evaluationFundingRoundIds: readonly string[];
  maxPerRating: number;
}): CuratedFeedbackSelection {
  const feedbackSetVersion = requireText(args.feedbackSetVersion, "feedbackSetVersion");
  if (!Number.isInteger(args.maxPerRating) || args.maxPerRating <= 0) {
    throw new Error("maxPerRating must be a positive integer.");
  }
  if (args.evaluationFundingRoundIds.length !== 3) {
    throw new Error("evaluationFundingRoundIds must contain exactly three rounds.");
  }

  const evaluationFundingRoundIds = args.evaluationFundingRoundIds.map((id, index) =>
    requireText(id, `evaluationFundingRoundIds[${index}]`),
  );
  if (new Set(evaluationFundingRoundIds).size !== evaluationFundingRoundIds.length) {
    throw new Error("evaluationFundingRoundIds must be unique.");
  }

  const entries = args.entries.map(normaliseEntry);
  const feedbackIds = entries.map(({ feedbackId }) => feedbackId);
  if (new Set(feedbackIds).size !== feedbackIds.length) {
    throw new Error("Feedback entries must not contain duplicate feedbackId values.");
  }
  const feedbackPairs = entries.map(
    ({ investorId, fundingRoundId }) => `${fundingRoundId}\u0000${investorId}`,
  );
  if (new Set(feedbackPairs).size !== feedbackPairs.length) {
    throw new Error("Feedback entries must not repeat an investor and funding round pair.");
  }

  const evaluationRoundSet = new Set(evaluationFundingRoundIds);
  const eligible = entries
    .filter(entry => entry.evidenceGroup === "useful")
    .filter(entry => !evaluationRoundSet.has(entry.fundingRoundId))
    .sort((left, right) => {
      const timeDifference = Date.parse(right.createdAt) - Date.parse(left.createdAt);
      return timeDifference || left.feedbackId.localeCompare(right.feedbackId);
    });
  const selectedDown = eligible
    .filter(({ rating }) => rating === "down")
    .slice(0, args.maxPerRating);
  const selectedUp = eligible
    .filter(({ rating }) => rating === "up")
    .slice(0, args.maxPerRating);
  const selectedEntries = [...selectedDown, ...selectedUp];

  return {
    schemaVersion: CURATED_FEEDBACK_SELECTION_SCHEMA_VERSION,
    feedbackSetVersion,
    feedbackSetHash: hashEntries(selectedEntries),
    summary: {
      sourceCount: entries.length,
      usefulCount: entries.filter(({ evidenceGroup }) => evidenceGroup === "useful").length,
      weakCount: entries.filter(({ evidenceGroup }) => evidenceGroup === "weak").length,
      excludedCurrentRoundCount: entries.filter(
        ({ fundingRoundId }) => evaluationRoundSet.has(fundingRoundId),
      ).length,
      selectedUpCount: selectedUp.length,
      selectedDownCount: selectedDown.length,
    },
    entries: selectedEntries,
  };
}
