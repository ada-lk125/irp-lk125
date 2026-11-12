import { randomUUID } from "node:crypto";
import {
  access,
  link,
  mkdir,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { toBaselineExportRow } from "./baseline-export";
import {
  CURATED_FEEDBACK_CONTEXT_SCHEMA_VERSION,
} from "./feedback-context";
import type { FeedbackComparisonRun } from "./feedback-comparison-runner";
import type {
  FeedbackExperimentDefinition,
  FeedbackExperimentMode,
} from "./feedback-experiment";

export const FEEDBACK_COMPARISON_EXPORT_SCHEMA_VERSION =
  "feedback-comparison-export-v1";

type FeedbackComparisonExportMatch = ReturnType<typeof toBaselineExportRow>;

export interface FeedbackComparisonExport {
  run: {
    schemaVersion: typeof FEEDBACK_COMPARISON_EXPORT_SCHEMA_VERSION;
    runId: string;
    createdAt: string;
    source: string;
    semanticMethod: "gpt-semantic";
    topK: 10;
    matchingConfigHash: string;
  };
  query: FeedbackComparisonRun["query"];
  feedback: FeedbackComparisonRun["feedbackContext"];
  runs: Array<{
    feedbackMode: FeedbackExperimentMode;
    matches: FeedbackComparisonExportMatch[];
  }>;
  evaluationStatus: "requires-frozen-labels";
}

export interface FeedbackComparisonExportSummary {
  queryId: string;
  startupId: string;
  fundingRoundId: string;
  candidateCount: number;
  candidatePoolHash: string;
  feedbackSetVersion: string;
  feedbackSetHash: string;
  runMatchCounts: Record<FeedbackExperimentMode, number>;
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value.trim();
}

function requireSha256(value: unknown, label: string): string {
  const hash = requireString(value, label).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(hash)) {
    throw new Error(`${label} must be a SHA-256 hash.`);
  }
  return hash;
}

function requireNonNegativeInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
  return Number(value);
}

function normaliseIsoTimestamp(value?: string): string {
  const timestamp = value ? new Date(value) : new Date();
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error("createdAt must be a valid date or ISO timestamp.");
  }
  return timestamp.toISOString();
}

export function validateFeedbackComparisonExport(
  rawExport: unknown,
): FeedbackComparisonExportSummary {
  const raw = requireObject(rawExport, "feedback comparison export");
  const run = requireObject(raw.run, "feedback comparison export.run");
  if (run.schemaVersion !== FEEDBACK_COMPARISON_EXPORT_SCHEMA_VERSION) {
    throw new Error(
      `feedback comparison export.run.schemaVersion must be ${FEEDBACK_COMPARISON_EXPORT_SCHEMA_VERSION}.`,
    );
  }
  requireString(run.runId, "feedback comparison export.run.runId");
  const createdAt = requireString(
    run.createdAt,
    "feedback comparison export.run.createdAt",
  );
  if (Number.isNaN(new Date(createdAt).getTime())) {
    throw new Error("feedback comparison export.run.createdAt must be a valid timestamp.");
  }
  requireString(run.source, "feedback comparison export.run.source");
  if (run.semanticMethod !== "gpt-semantic") {
    throw new Error("feedback comparison export.run.semanticMethod must be gpt-semantic.");
  }
  if (run.topK !== 10) {
    throw new Error("feedback comparison export.run.topK must be 10.");
  }
  requireSha256(
    run.matchingConfigHash,
    "feedback comparison export.run.matchingConfigHash",
  );

  const query = requireObject(raw.query, "feedback comparison export.query");
  const queryId = requireString(query.queryId, "feedback comparison export.query.queryId");
  const startupId = requireString(
    query.startupId,
    "feedback comparison export.query.startupId",
  );
  const fundingRoundId = requireString(
    query.fundingRoundId,
    "feedback comparison export.query.fundingRoundId",
  );
  const candidateCount = requireNonNegativeInteger(
    query.candidateCount,
    "feedback comparison export.query.candidateCount",
  );
  if (candidateCount < 10) {
    throw new Error("feedback comparison export.query.candidateCount must be at least 10.");
  }
  const candidatePoolHash = requireSha256(
    query.candidatePoolHash,
    "feedback comparison export.query.candidatePoolHash",
  );

  const feedback = requireObject(raw.feedback, "feedback comparison export.feedback");
  if ("text" in feedback) {
    throw new Error("feedback comparison export.feedback must not contain feedback text.");
  }
  if (feedback.schemaVersion !== CURATED_FEEDBACK_CONTEXT_SCHEMA_VERSION) {
    throw new Error(
      `feedback comparison export.feedback.schemaVersion must be ${CURATED_FEEDBACK_CONTEXT_SCHEMA_VERSION}.`,
    );
  }
  const feedbackSetVersion = requireString(
    feedback.feedbackSetVersion,
    "feedback comparison export.feedback.feedbackSetVersion",
  );
  const feedbackSetHash = requireSha256(
    feedback.feedbackSetHash,
    "feedback comparison export.feedback.feedbackSetHash",
  );
  const characterCount = requireNonNegativeInteger(
    feedback.characterCount,
    "feedback comparison export.feedback.characterCount",
  );
  const selectedUpCount = requireNonNegativeInteger(
    feedback.selectedUpCount,
    "feedback comparison export.feedback.selectedUpCount",
  );
  const selectedDownCount = requireNonNegativeInteger(
    feedback.selectedDownCount,
    "feedback comparison export.feedback.selectedDownCount",
  );
  if (characterCount === 0 || selectedUpCount + selectedDownCount === 0) {
    throw new Error("feedback comparison export.feedback must describe a non-empty context.");
  }

  if (!Array.isArray(raw.runs) || raw.runs.length !== 2) {
    throw new Error("feedback comparison export.runs must contain two runs.");
  }
  const runMatchCounts = {} as Record<FeedbackExperimentMode, number>;
  const feedbackModes: string[] = [];
  raw.runs.forEach((rawModeRun, runIndex) => {
    const modeRun = requireObject(
      rawModeRun,
      `feedback comparison export.runs[${runIndex}]`,
    );
    const feedbackMode = requireString(
      modeRun.feedbackMode,
      `feedback comparison export.runs[${runIndex}].feedbackMode`,
    ) as FeedbackExperimentMode;
    feedbackModes.push(feedbackMode);
    if (!Array.isArray(modeRun.matches) || modeRun.matches.length !== 10) {
      throw new Error(`feedback comparison export run ${feedbackMode} must contain 10 matches.`);
    }
    const investorIds = modeRun.matches.map((rawMatch, matchIndex) => {
      const match = requireObject(
        rawMatch,
        `feedback comparison export.runs[${runIndex}].matches[${matchIndex}]`,
      );
      if (match.rank !== matchIndex + 1) {
        throw new Error(
          `feedback comparison export run ${feedbackMode} must use sequential ranks.`,
        );
      }
      const investor = requireObject(
        match.investor,
        `feedback comparison export.runs[${runIndex}].matches[${matchIndex}].investor`,
      );
      return requireString(
        investor.id,
        `feedback comparison export.runs[${runIndex}].matches[${matchIndex}].investor.id`,
      );
    });
    if (new Set(investorIds).size !== investorIds.length) {
      throw new Error(`feedback comparison export run ${feedbackMode} has duplicate investors.`);
    }
    runMatchCounts[feedbackMode] = modeRun.matches.length;
  });
  if (JSON.stringify(feedbackModes) !== JSON.stringify(["none", "curated"])) {
    throw new Error("feedback comparison export runs must be none, curated in that order.");
  }
  if (raw.evaluationStatus !== "requires-frozen-labels") {
    throw new Error(
      "feedback comparison export.evaluationStatus must be requires-frozen-labels.",
    );
  }

  return {
    queryId,
    startupId,
    fundingRoundId,
    candidateCount,
    candidatePoolHash,
    feedbackSetVersion,
    feedbackSetHash,
    runMatchCounts,
  };
}

export function buildFeedbackComparisonExport(args: {
  comparison: FeedbackComparisonRun;
  definition: FeedbackExperimentDefinition;
  runId: string;
  source: string;
  createdAt?: string;
}): FeedbackComparisonExport {
  const queryDefinition = args.definition.queries.find(
    query => query.queryId === args.comparison.query.queryId,
  );
  if (
    !queryDefinition
    || queryDefinition.startupId !== args.comparison.query.startupId
    || queryDefinition.fundingRoundId !== args.comparison.query.fundingRoundId
    || queryDefinition.candidatePoolHash !== args.comparison.query.candidatePoolHash
  ) {
    throw new Error("The comparison query does not match the experiment definition.");
  }
  const curatedRun = args.definition.runs[1];
  if (
    curatedRun.feedbackSetVersion !== args.comparison.feedbackContext.feedbackSetVersion
    || curatedRun.feedbackSetHash !== args.comparison.feedbackContext.feedbackSetHash
  ) {
    throw new Error("The comparison feedback does not match the experiment definition.");
  }

  const output: FeedbackComparisonExport = {
    run: {
      schemaVersion: FEEDBACK_COMPARISON_EXPORT_SCHEMA_VERSION,
      runId: requireString(args.runId, "runId"),
      createdAt: normaliseIsoTimestamp(args.createdAt),
      source: requireString(args.source, "source"),
      semanticMethod: args.definition.semanticMethod,
      topK: args.definition.topK,
      matchingConfigHash: args.definition.matchingConfigHash,
    },
    query: args.comparison.query,
    feedback: args.comparison.feedbackContext,
    runs: args.comparison.runs.map(({ feedbackMode, matches }) => ({
      feedbackMode,
      matches: matches.map(toBaselineExportRow),
    })),
    evaluationStatus: args.definition.evaluationStatus,
  };

  validateFeedbackComparisonExport(output);
  return output;
}

export async function assertFeedbackComparisonOutputAvailable(
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
    throw new Error(
      "Feedback comparison output must stay inside exports/ and end with .local.json.",
    );
  }

  try {
    await access(resolved);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return resolved;
    throw error;
  }
  throw new Error(
    `Feedback comparison output already exists and will not be overwritten: ${filePath}`,
  );
}

export async function writeFeedbackComparisonExport(args: {
  output: FeedbackComparisonExport;
  filePath: string;
  workingDirectory?: string;
}): Promise<string> {
  validateFeedbackComparisonExport(args.output);
  const workingDirectory = args.workingDirectory ?? process.cwd();
  const resolved = await assertFeedbackComparisonOutputAvailable(
    args.filePath,
    workingDirectory,
  );
  await mkdir(path.dirname(resolved), { recursive: true });

  const temporaryPath = path.join(
    path.dirname(resolved),
    `.${path.basename(resolved)}.${process.pid}.${randomUUID()}.tmp`,
  );
  const contents = serialiseFeedbackComparisonExport(args.output);

  try {
    await writeFile(temporaryPath, contents, { encoding: "utf8", flag: "wx" });
    await link(temporaryPath, resolved);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error(
        `Feedback comparison output already exists and will not be overwritten: ${args.filePath}`,
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

export function serialiseFeedbackComparisonExport(
  output: FeedbackComparisonExport,
): string {
  validateFeedbackComparisonExport(output);
  return `${JSON.stringify(output, null, 2)}\n`;
}
