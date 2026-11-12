import { createHash, randomUUID } from "node:crypto";
import { access, link, mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  MAX_CURATED_FEEDBACK_REASON_LENGTH,
  type FeedbackSelectionInput,
} from "./feedback-selection";

export const FEEDBACK_SELECTION_SOURCE_SCHEMA_VERSION =
  "feedback-selection-source-v1";

export interface MatchFeedbackSourceRow {
  id: number | string;
  investorId: string;
  investorName?: string | null;
  fundingRoundId: string;
  startupName?: string | null;
  rating: string;
  reason?: string | null;
  createdAt: Date | string | null;
}

export interface FeedbackSelectionSource {
  schemaVersion: typeof FEEDBACK_SELECTION_SOURCE_SCHEMA_VERSION;
  createdAt: string;
  source: {
    table: "match_feedback";
    accessMode: "read-only-select";
    policy: "non-blank-human-reason-v1";
    maxReasonCharacters: typeof MAX_CURATED_FEEDBACK_REASON_LENGTH;
  };
  summary: {
    sourceCount: number;
    eligibleCount: number;
    eligibleUpCount: number;
    eligibleDownCount: number;
    missingReasonCount: number;
    overlongReasonCount: number;
    unsupportedRatingCount: number;
    invalidIdentityOrTimestampCount: number;
  };
  entries: FeedbackSelectionInput[];
}

function requireTimestamp(value?: string): string {
  const timestamp = value ? new Date(value) : new Date();
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error("createdAt must be a valid date or ISO timestamp.");
  }
  return timestamp.toISOString();
}

function normaliseText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim().replace(/\s+/g, " ");
  return text.length > 0 ? text : undefined;
}

function normaliseRowTimestamp(
  value: Date | string | null,
): string | undefined {
  if (value === null) return undefined;
  const timestamp = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(timestamp.getTime())) return undefined;
  return timestamp.toISOString();
}

export function buildFeedbackSelectionSource(args: {
  rows: readonly MatchFeedbackSourceRow[];
  createdAt?: string;
}): FeedbackSelectionSource {
  const entries: FeedbackSelectionInput[] = [];
  let missingReasonCount = 0;
  let overlongReasonCount = 0;
  let unsupportedRatingCount = 0;
  let invalidIdentityOrTimestampCount = 0;

  for (const row of args.rows) {
    const feedbackIdValue =
      typeof row.id === "number" && Number.isInteger(row.id)
        ? String(row.id)
        : normaliseText(row.id);
    const investorId = normaliseText(row.investorId);
    const fundingRoundId = normaliseText(row.fundingRoundId);
    const createdAt = normaliseRowTimestamp(row.createdAt);
    if (!feedbackIdValue || !investorId || !fundingRoundId || !createdAt) {
      invalidIdentityOrTimestampCount += 1;
      continue;
    }

    if (row.rating !== "up" && row.rating !== "down") {
      unsupportedRatingCount += 1;
      continue;
    }

    const reason = normaliseText(row.reason);
    if (!reason) {
      missingReasonCount += 1;
      continue;
    }
    if (reason.length > MAX_CURATED_FEEDBACK_REASON_LENGTH) {
      overlongReasonCount += 1;
      continue;
    }

    entries.push({
      feedbackId: `match-feedback-${feedbackIdValue}`,
      investorId,
      investorName: normaliseText(row.investorName) ?? `Investor ${investorId}`,
      fundingRoundId,
      startupName:
        normaliseText(row.startupName) ?? `Funding round ${fundingRoundId}`,
      rating: row.rating,
      reason,
      evidenceGroup: "useful",
      createdAt,
    });
  }

  return {
    schemaVersion: FEEDBACK_SELECTION_SOURCE_SCHEMA_VERSION,
    createdAt: requireTimestamp(args.createdAt),
    source: {
      table: "match_feedback",
      accessMode: "read-only-select",
      policy: "non-blank-human-reason-v1",
      maxReasonCharacters: MAX_CURATED_FEEDBACK_REASON_LENGTH,
    },
    summary: {
      sourceCount: args.rows.length,
      eligibleCount: entries.length,
      eligibleUpCount: entries.filter(({ rating }) => rating === "up").length,
      eligibleDownCount: entries.filter(({ rating }) => rating === "down")
        .length,
      missingReasonCount,
      overlongReasonCount,
      unsupportedRatingCount,
      invalidIdentityOrTimestampCount,
    },
    entries,
  };
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requireNonNegativeInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
  return Number(value);
}

export function validateFeedbackSelectionSource(
  raw: unknown,
): FeedbackSelectionSource {
  const source = requireObject(raw, "feedback selection source");
  if (source.schemaVersion !== FEEDBACK_SELECTION_SOURCE_SCHEMA_VERSION) {
    throw new Error(
      `feedback selection source.schemaVersion must be ${FEEDBACK_SELECTION_SOURCE_SCHEMA_VERSION}.`,
    );
  }
  const createdAt = normaliseText(source.createdAt);
  if (!createdAt || Number.isNaN(new Date(createdAt).getTime())) {
    throw new Error("feedback selection source.createdAt must be a timestamp.");
  }

  const sourceMetadata = requireObject(
    source.source,
    "feedback selection source.source",
  );
  if (
    sourceMetadata.table !== "match_feedback" ||
    sourceMetadata.accessMode !== "read-only-select" ||
    sourceMetadata.policy !== "non-blank-human-reason-v1" ||
    sourceMetadata.maxReasonCharacters !== MAX_CURATED_FEEDBACK_REASON_LENGTH
  ) {
    throw new Error(
      "feedback selection source has an unsupported source policy.",
    );
  }

  const summary = requireObject(
    source.summary,
    "feedback selection source.summary",
  );
  const parsedSummary = {
    sourceCount: requireNonNegativeInteger(
      summary.sourceCount,
      "feedback selection source.summary.sourceCount",
    ),
    eligibleCount: requireNonNegativeInteger(
      summary.eligibleCount,
      "feedback selection source.summary.eligibleCount",
    ),
    eligibleUpCount: requireNonNegativeInteger(
      summary.eligibleUpCount,
      "feedback selection source.summary.eligibleUpCount",
    ),
    eligibleDownCount: requireNonNegativeInteger(
      summary.eligibleDownCount,
      "feedback selection source.summary.eligibleDownCount",
    ),
    missingReasonCount: requireNonNegativeInteger(
      summary.missingReasonCount,
      "feedback selection source.summary.missingReasonCount",
    ),
    overlongReasonCount: requireNonNegativeInteger(
      summary.overlongReasonCount,
      "feedback selection source.summary.overlongReasonCount",
    ),
    unsupportedRatingCount: requireNonNegativeInteger(
      summary.unsupportedRatingCount,
      "feedback selection source.summary.unsupportedRatingCount",
    ),
    invalidIdentityOrTimestampCount: requireNonNegativeInteger(
      summary.invalidIdentityOrTimestampCount,
      "feedback selection source.summary.invalidIdentityOrTimestampCount",
    ),
  };
  if (!Array.isArray(source.entries)) {
    throw new Error("feedback selection source.entries must be an array.");
  }
  if (source.entries.length !== parsedSummary.eligibleCount) {
    throw new Error(
      "feedback selection source eligible count does not match entries.",
    );
  }
  if (
    parsedSummary.sourceCount !==
    parsedSummary.eligibleCount +
      parsedSummary.missingReasonCount +
      parsedSummary.overlongReasonCount +
      parsedSummary.unsupportedRatingCount +
      parsedSummary.invalidIdentityOrTimestampCount
  ) {
    throw new Error(
      "feedback selection source summary counts do not reconcile.",
    );
  }

  const entries = source.entries.map((entry, index) => {
    const parsed = requireObject(
      entry,
      `feedback selection source.entries[${index}]`,
    );
    const evidence = buildFeedbackSelectionSource({
      rows: [
        {
          id:
            normaliseText(parsed.feedbackId)?.replace(/^match-feedback-/, "") ??
            "",
          investorId: normaliseText(parsed.investorId) ?? "",
          investorName: normaliseText(parsed.investorName),
          fundingRoundId: normaliseText(parsed.fundingRoundId) ?? "",
          startupName: normaliseText(parsed.startupName),
          rating: normaliseText(parsed.rating) ?? "",
          reason: normaliseText(parsed.reason),
          createdAt: normaliseText(parsed.createdAt) ?? null,
        },
      ],
      createdAt,
    });
    if (evidence.entries.length !== 1) {
      throw new Error(
        `feedback selection source.entries[${index}] is not eligible.`,
      );
    }
    const feedbackId = normaliseText(parsed.feedbackId);
    if (!feedbackId || !/^match-feedback-[A-Za-z0-9_-]+$/.test(feedbackId)) {
      throw new Error(
        `feedback selection source.entries[${index}].feedbackId is invalid.`,
      );
    }
    return {
      ...evidence.entries[0],
      feedbackId,
    };
  });
  if (
    entries.filter(({ rating }) => rating === "up").length !==
      parsedSummary.eligibleUpCount ||
    entries.filter(({ rating }) => rating === "down").length !==
      parsedSummary.eligibleDownCount
  ) {
    throw new Error(
      "feedback selection source rating counts do not match entries.",
    );
  }

  return {
    schemaVersion: FEEDBACK_SELECTION_SOURCE_SCHEMA_VERSION,
    createdAt: new Date(createdAt).toISOString(),
    source: {
      table: "match_feedback",
      accessMode: "read-only-select",
      policy: "non-blank-human-reason-v1",
      maxReasonCharacters: MAX_CURATED_FEEDBACK_REASON_LENGTH,
    },
    summary: parsedSummary,
    entries,
  };
}

export function feedbackSelectionSourceSha256(
  source: FeedbackSelectionSource,
): string {
  return createHash("sha256")
    .update(`${JSON.stringify(source, null, 2)}\n`, "utf8")
    .digest("hex");
}

export async function writeFeedbackSelectionSource(args: {
  source: FeedbackSelectionSource;
  filePath: string;
  workingDirectory?: string;
}): Promise<string> {
  const source = validateFeedbackSelectionSource(args.source);
  const workingDirectory = args.workingDirectory ?? process.cwd();
  const exportsRoot = path.resolve(workingDirectory, "exports");
  const resolved = path.resolve(workingDirectory, args.filePath);
  const relative = path.relative(exportsRoot, resolved);
  if (
    relative.length === 0 ||
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    !path.basename(resolved).endsWith(".local.json")
  ) {
    throw new Error(
      "Feedback selection source must stay inside exports/ and end with .local.json.",
    );
  }
  try {
    await access(resolved);
    throw new Error(
      `Feedback selection source already exists: ${args.filePath}.`,
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  await mkdir(path.dirname(resolved), { recursive: true });
  const temporaryPath = path.join(
    path.dirname(resolved),
    `.${path.basename(resolved)}.${process.pid}.${randomUUID()}.tmp`,
  );
  const contents = `${JSON.stringify(source, null, 2)}\n`;
  try {
    await writeFile(temporaryPath, contents, { encoding: "utf8", flag: "wx" });
    await link(temporaryPath, resolved);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error(
        `Feedback selection source already exists: ${args.filePath}.`,
      );
    }
    throw error;
  } finally {
    try {
      await unlink(temporaryPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return resolved;
}
