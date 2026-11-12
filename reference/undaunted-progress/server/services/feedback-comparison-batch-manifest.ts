import { createHash, randomUUID } from "node:crypto";
import {
  access,
  link,
  mkdir,
  readFile,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import {
  serialiseFeedbackComparisonExport,
  validateFeedbackComparisonExport,
  type FeedbackComparisonExport,
} from "./feedback-comparison-export";
import type { FeedbackExperimentDefinition } from "./feedback-experiment";

export const FEEDBACK_COMPARISON_BATCH_MANIFEST_SCHEMA_VERSION =
  "feedback-comparison-batch-manifest-v1";

export interface FeedbackComparisonBatchManifestFile {
  queryId: string;
  startupId: string;
  fundingRoundId: string;
  candidateCount: number;
  candidatePoolHash: string;
  fileName: string;
  sha256: string;
  runMatchCounts: { none: 10; curated: 10 };
}

export interface FeedbackComparisonBatchManifest {
  schemaVersion: typeof FEEDBACK_COMPARISON_BATCH_MANIFEST_SCHEMA_VERSION;
  batchId: string;
  createdAt: string;
  experiment: {
    semanticMethod: "gpt-semantic";
    topK: 10;
    queryCount: 3;
    matchingConfigHash: string;
    feedbackSetVersion: string;
    feedbackSetHash: string;
  };
  files: FeedbackComparisonBatchManifestFile[];
  evaluationStatus: "requires-frozen-labels";
}

export interface FeedbackComparisonBatchManifestSummary {
  batchId: string;
  queryIds: string[];
  fileNames: string[];
  matchingConfigHash: string;
  feedbackSetHash: string;
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requireOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  label: string,
) {
  const allowed = new Set(allowedKeys);
  const unexpected = Object.keys(value).filter(key => !allowed.has(key));
  if (unexpected.length > 0) {
    throw new Error(`${label} contains unexpected fields: ${unexpected.join(", ")}.`);
  }
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

function requireInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
  return Number(value);
}

function normaliseTimestamp(value?: string): string {
  const timestamp = value ? new Date(value) : new Date();
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error("createdAt must be a valid date or ISO timestamp.");
  }
  return timestamp.toISOString();
}

function requirePrivateFileName(value: unknown, label: string): string {
  const fileName = requireString(value, label);
  if (
    fileName !== path.basename(fileName)
    || fileName.includes("\\")
    || !fileName.endsWith(".local.json")
  ) {
    throw new Error(`${label} must be a .local.json file name without a directory.`);
  }
  return fileName;
}

function sha256(contents: string): string {
  return createHash("sha256").update(contents, "utf8").digest("hex");
}

export function validateFeedbackComparisonBatchManifest(
  rawManifest: unknown,
): FeedbackComparisonBatchManifestSummary {
  const manifest = requireObject(rawManifest, "feedback comparison batch manifest");
  requireOnlyKeys(
    manifest,
    ["schemaVersion", "batchId", "createdAt", "experiment", "files", "evaluationStatus"],
    "feedback comparison batch manifest",
  );
  if (manifest.schemaVersion !== FEEDBACK_COMPARISON_BATCH_MANIFEST_SCHEMA_VERSION) {
    throw new Error(
      `feedback comparison batch manifest.schemaVersion must be ${FEEDBACK_COMPARISON_BATCH_MANIFEST_SCHEMA_VERSION}.`,
    );
  }
  const batchId = requireString(manifest.batchId, "feedback comparison batch manifest.batchId");
  const createdAt = requireString(
    manifest.createdAt,
    "feedback comparison batch manifest.createdAt",
  );
  if (Number.isNaN(new Date(createdAt).getTime())) {
    throw new Error("feedback comparison batch manifest.createdAt must be a valid timestamp.");
  }

  const experiment = requireObject(
    manifest.experiment,
    "feedback comparison batch manifest.experiment",
  );
  requireOnlyKeys(
    experiment,
    [
      "semanticMethod",
      "topK",
      "queryCount",
      "matchingConfigHash",
      "feedbackSetVersion",
      "feedbackSetHash",
    ],
    "feedback comparison batch manifest.experiment",
  );
  if (experiment.semanticMethod !== "gpt-semantic") {
    throw new Error("feedback comparison batch manifest must use gpt-semantic.");
  }
  if (experiment.topK !== 10 || experiment.queryCount !== 3) {
    throw new Error("feedback comparison batch manifest must describe three top-ten queries.");
  }
  const matchingConfigHash = requireSha256(
    experiment.matchingConfigHash,
    "feedback comparison batch manifest.experiment.matchingConfigHash",
  );
  requireString(
    experiment.feedbackSetVersion,
    "feedback comparison batch manifest.experiment.feedbackSetVersion",
  );
  const feedbackSetHash = requireSha256(
    experiment.feedbackSetHash,
    "feedback comparison batch manifest.experiment.feedbackSetHash",
  );

  if (!Array.isArray(manifest.files) || manifest.files.length !== 3) {
    throw new Error("feedback comparison batch manifest.files must contain three files.");
  }
  const queryIds: string[] = [];
  const startupRoundPairs: string[] = [];
  const fileNames: string[] = [];
  manifest.files.forEach((rawFile, fileIndex) => {
    const file = requireObject(
      rawFile,
      `feedback comparison batch manifest.files[${fileIndex}]`,
    );
    requireOnlyKeys(
      file,
      [
        "queryId",
        "startupId",
        "fundingRoundId",
        "candidateCount",
        "candidatePoolHash",
        "fileName",
        "sha256",
        "runMatchCounts",
      ],
      `feedback comparison batch manifest.files[${fileIndex}]`,
    );
    const queryId = requireString(file.queryId, `manifest.files[${fileIndex}].queryId`);
    const startupId = requireString(
      file.startupId,
      `manifest.files[${fileIndex}].startupId`,
    );
    const fundingRoundId = requireString(
      file.fundingRoundId,
      `manifest.files[${fileIndex}].fundingRoundId`,
    );
    if (requireInteger(file.candidateCount, `manifest.files[${fileIndex}].candidateCount`) < 10) {
      throw new Error(`manifest.files[${fileIndex}].candidateCount must be at least 10.`);
    }
    requireSha256(
      file.candidatePoolHash,
      `manifest.files[${fileIndex}].candidatePoolHash`,
    );
    const fileName = requirePrivateFileName(
      file.fileName,
      `manifest.files[${fileIndex}].fileName`,
    );
    requireSha256(file.sha256, `manifest.files[${fileIndex}].sha256`);
    const counts = requireObject(
      file.runMatchCounts,
      `manifest.files[${fileIndex}].runMatchCounts`,
    );
    requireOnlyKeys(
      counts,
      ["none", "curated"],
      `manifest.files[${fileIndex}].runMatchCounts`,
    );
    if (counts.none !== 10 || counts.curated !== 10) {
      throw new Error(`manifest.files[${fileIndex}] must contain two top-ten runs.`);
    }

    queryIds.push(queryId);
    startupRoundPairs.push(`${startupId}\u0000${fundingRoundId}`);
    fileNames.push(fileName);
  });
  if (new Set(queryIds).size !== 3) {
    throw new Error("feedback comparison batch manifest query IDs must be unique.");
  }
  if (new Set(startupRoundPairs).size !== 3) {
    throw new Error("feedback comparison batch manifest startup and round pairs must be unique.");
  }
  if (new Set(fileNames).size !== 3) {
    throw new Error("feedback comparison batch manifest file names must be unique.");
  }
  if (manifest.evaluationStatus !== "requires-frozen-labels") {
    throw new Error("feedback comparison batch manifest requires frozen labels.");
  }

  return { batchId, queryIds, fileNames, matchingConfigHash, feedbackSetHash };
}

export function buildFeedbackComparisonBatchManifest(args: {
  batchId: string;
  definition: FeedbackExperimentDefinition;
  outputs: Array<{ fileName: string; output: FeedbackComparisonExport }>;
  createdAt?: string;
}): FeedbackComparisonBatchManifest {
  if (args.outputs.length !== 3) {
    throw new Error("A feedback comparison batch manifest requires three outputs.");
  }
  const outputByQueryId = new Map(
    args.outputs.map(entry => [validateFeedbackComparisonExport(entry.output).queryId, entry]),
  );
  if (outputByQueryId.size !== 3) {
    throw new Error("A feedback comparison batch manifest requires unique query outputs.");
  }
  const curatedRun = args.definition.runs[1];
  const files = args.definition.queries.map(query => {
    const entry = outputByQueryId.get(query.queryId);
    if (!entry) {
      throw new Error(`Missing feedback comparison output for query ${query.queryId}.`);
    }
    const summary = validateFeedbackComparisonExport(entry.output);
    if (
      summary.startupId !== query.startupId
      || summary.fundingRoundId !== query.fundingRoundId
      || summary.candidatePoolHash !== query.candidatePoolHash
      || summary.feedbackSetVersion !== curatedRun.feedbackSetVersion
      || summary.feedbackSetHash !== curatedRun.feedbackSetHash
      || entry.output.run.matchingConfigHash !== args.definition.matchingConfigHash
    ) {
      throw new Error(`Feedback comparison output ${query.queryId} does not match the experiment.`);
    }
    return {
      queryId: summary.queryId,
      startupId: summary.startupId,
      fundingRoundId: summary.fundingRoundId,
      candidateCount: summary.candidateCount,
      candidatePoolHash: summary.candidatePoolHash,
      fileName: requirePrivateFileName(entry.fileName, `${query.queryId}.fileName`),
      sha256: sha256(serialiseFeedbackComparisonExport(entry.output)),
      runMatchCounts: { none: 10, curated: 10 } as const,
    };
  });
  const manifest: FeedbackComparisonBatchManifest = {
    schemaVersion: FEEDBACK_COMPARISON_BATCH_MANIFEST_SCHEMA_VERSION,
    batchId: requireString(args.batchId, "batchId"),
    createdAt: normaliseTimestamp(args.createdAt),
    experiment: {
      semanticMethod: args.definition.semanticMethod,
      topK: args.definition.topK,
      queryCount: 3,
      matchingConfigHash: args.definition.matchingConfigHash,
      feedbackSetVersion: curatedRun.feedbackSetVersion,
      feedbackSetHash: curatedRun.feedbackSetHash,
    },
    files,
    evaluationStatus: args.definition.evaluationStatus,
  };
  validateFeedbackComparisonBatchManifest(manifest);
  return manifest;
}

export async function verifyFeedbackComparisonBatchFiles(args: {
  manifest: FeedbackComparisonBatchManifest;
  workingDirectory?: string;
}): Promise<FeedbackComparisonBatchManifestSummary> {
  const summary = validateFeedbackComparisonBatchManifest(args.manifest);
  const exportsRoot = path.resolve(args.workingDirectory ?? process.cwd(), "exports");
  for (const file of args.manifest.files) {
    const contents = await readFile(path.join(exportsRoot, file.fileName), "utf8");
    if (sha256(contents) !== file.sha256) {
      throw new Error(`Feedback comparison file hash mismatch: ${file.fileName}.`);
    }
    const output = JSON.parse(contents) as FeedbackComparisonExport;
    const outputSummary = validateFeedbackComparisonExport(output);
    if (
      outputSummary.queryId !== file.queryId
      || outputSummary.startupId !== file.startupId
      || outputSummary.fundingRoundId !== file.fundingRoundId
      || outputSummary.candidateCount !== file.candidateCount
      || outputSummary.candidatePoolHash !== file.candidatePoolHash
      || outputSummary.feedbackSetHash !== args.manifest.experiment.feedbackSetHash
      || output.run.matchingConfigHash !== args.manifest.experiment.matchingConfigHash
      || outputSummary.runMatchCounts.none !== 10
      || outputSummary.runMatchCounts.curated !== 10
    ) {
      throw new Error(`Feedback comparison file does not match its manifest: ${file.fileName}.`);
    }
  }
  return summary;
}

export async function writeFeedbackComparisonBatchManifest(args: {
  manifest: FeedbackComparisonBatchManifest;
  filePath: string;
  workingDirectory?: string;
}): Promise<string> {
  const workingDirectory = args.workingDirectory ?? process.cwd();
  await verifyFeedbackComparisonBatchFiles({
    manifest: args.manifest,
    workingDirectory,
  });
  const exportsRoot = path.resolve(workingDirectory, "exports");
  const resolved = path.resolve(workingDirectory, args.filePath);
  const relative = path.relative(exportsRoot, resolved);
  if (
    relative.length === 0
    || relative.startsWith("..")
    || path.isAbsolute(relative)
    || !path.basename(resolved).endsWith(".local.manifest.json")
  ) {
    throw new Error(
      "Feedback comparison manifest must stay inside exports/ and end with .local.manifest.json.",
    );
  }
  try {
    await access(resolved);
    throw new Error(`Feedback comparison manifest already exists: ${args.filePath}.`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  await mkdir(path.dirname(resolved), { recursive: true });
  const temporaryPath = path.join(
    path.dirname(resolved),
    `.${path.basename(resolved)}.${process.pid}.${randomUUID()}.tmp`,
  );
  const contents = `${JSON.stringify(args.manifest, null, 2)}\n`;
  try {
    await writeFile(temporaryPath, contents, { encoding: "utf8", flag: "wx" });
    await link(temporaryPath, resolved);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error(`Feedback comparison manifest already exists: ${args.filePath}.`);
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
