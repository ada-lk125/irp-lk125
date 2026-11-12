import { createHash, randomUUID } from "node:crypto";
import { access, link, mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import {
  buildFeedbackEvaluationDecision,
  FEEDBACK_EVALUATION_DECISION_SCHEMA_VERSION,
  type FeedbackEvaluationDecision,
} from "./feedback-evaluation-decision";
import {
  FEEDBACK_EVALUATION_RECEIPT_SCHEMA_VERSION,
  type FeedbackEvaluationReceipt,
} from "./feedback-evaluation-receipt";
import {
  FEEDBACK_EVALUATION_VISUALISATION_SCHEMA_VERSION,
  type FeedbackEvaluationVisualisationManifest,
} from "./feedback-evaluation-visualisation";

export const FINAL_MATCHER_HANDOFF_SCHEMA_VERSION =
  "final-matcher-handoff-v1";

export type FinalMatcherMethod =
  | "no_feedback_gpt"
  | "curated_feedback";

export type FinalMatcherReviewOutcome =
  | "approve-curated"
  | "keep-control";

type SourceName =
  | "receipt"
  | "decision"
  | "visualisation"
  | "errorReview";

export interface FinalMatcherHandoffSource {
  fileName: string;
  sha256: string;
}

export interface FinalMatcherHandoff {
  schemaVersion: typeof FINAL_MATCHER_HANDOFF_SCHEMA_VERSION;
  createdAt: string;
  batchId: string;
  selectedMethod: FinalMatcherMethod;
  semanticMethod: "gpt-semantic";
  aiModel: string;
  matchingConfigHash: string;
  feedbackSetHash: string;
  implementationCommitSha: string;
  evaluation: {
    evidencePattern: FeedbackEvaluationDecision["evidencePattern"];
    recommendation: FeedbackEvaluationDecision["recommendation"];
    reviewOutcome: FinalMatcherReviewOutcome;
  };
  sources: Record<SourceName, FinalMatcherHandoffSource>;
  resultContract: {
    investor: true;
    scoreBreakdown: [
      "stageMatch",
      "ticketSizeMatch",
      "sectorOverlap",
      "geographyMatch",
      "instrumentMatch",
      "semanticScore",
      "totalScore",
    ];
    matchReasons: true;
    aiInsight: true;
  };
  status: "ready-for-runtime-integration";
}

const SOURCE_SUFFIXES: Record<SourceName, string> = {
  receipt: ".local.receipt.json",
  decision: ".local.decision.json",
  visualisation: ".local.visualisation.json",
  errorReview: ".local.error-review.json",
};

function requireSha(
  value: string,
  label: string,
  length: 40 | 64 = 64,
): string {
  const normalised = value.trim().toLowerCase();
  if (!new RegExp(`^[a-f0-9]{${length}}$`).test(normalised)) {
    throw new Error(`${label} must be a ${length}-character hexadecimal hash.`);
  }
  return normalised;
}

function requireSource(
  source: FinalMatcherHandoffSource,
  name: SourceName,
): FinalMatcherHandoffSource {
  const fileName = source.fileName.trim();
  if (
    fileName !== path.basename(fileName)
    || !fileName.endsWith(SOURCE_SUFFIXES[name])
  ) {
    throw new Error(
      `${name} source must be a private ${SOURCE_SUFFIXES[name]} file name.`,
    );
  }
  return {
    fileName,
    sha256: requireSha(source.sha256, `${name} source hash`),
  };
}

function normaliseTimestamp(value?: string): string {
  const timestamp = value ? new Date(value) : new Date();
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error("createdAt must be a valid date or ISO timestamp.");
  }
  return timestamp.toISOString();
}

function requireMatchingInputs(args: {
  receipt: FeedbackEvaluationReceipt;
  decision: FeedbackEvaluationDecision;
  visualisation: FeedbackEvaluationVisualisationManifest;
}) {
  if (
    args.receipt.schemaVersion !==
      FEEDBACK_EVALUATION_RECEIPT_SCHEMA_VERSION
  ) {
    throw new Error("The final handoff requires a supported evaluation receipt.");
  }
  if (
    args.decision.schemaVersion !==
      FEEDBACK_EVALUATION_DECISION_SCHEMA_VERSION
  ) {
    throw new Error("The final handoff requires a supported evaluation decision.");
  }
  if (
    args.visualisation.schemaVersion !==
      FEEDBACK_EVALUATION_VISUALISATION_SCHEMA_VERSION
  ) {
    throw new Error(
      "The final handoff requires a supported visualisation manifest.",
    );
  }
  if (
    args.receipt.queryIds.length !== 3
    || new Set(args.receipt.queryIds).size !== 3
  ) {
    throw new Error("The final handoff requires three unique evaluated queries.");
  }

  const expectedDecision = buildFeedbackEvaluationDecision(args.receipt);
  if (!isDeepStrictEqual(expectedDecision, args.decision)) {
    throw new Error("The evaluation decision does not match its receipt.");
  }
  if (
    args.receipt.batch.batchId !== args.visualisation.batchId
    || args.receipt.batch.matchingConfigHash !==
      args.visualisation.matchingConfigHash
  ) {
    throw new Error(
      "The visualisation manifest does not match the evaluation receipt.",
    );
  }
  if (
    args.visualisation.decision.evidencePattern !==
      args.decision.evidencePattern
    || args.visualisation.decision.recommendation !==
      args.decision.recommendation
    || args.visualisation.decision.reviewStatus !== args.decision.reviewStatus
  ) {
    throw new Error(
      "The visualisation manifest does not match the evaluation decision.",
    );
  }

  const [none, curated] = args.receipt.runs;
  if (
    args.visualisation.metricFiles.none.fileName !== none.metricsFileName
    || args.visualisation.metricFiles.none.sha256 !== none.metricsSha256
    || args.visualisation.metricFiles.curated.fileName !==
      curated.metricsFileName
    || args.visualisation.metricFiles.curated.sha256 !==
      curated.metricsSha256
  ) {
    throw new Error(
      "The visualisation manifest is not bound to the receipt metric files.",
    );
  }
}

function requireSelection(args: {
  selectedMethod: FinalMatcherMethod;
  reviewOutcome: FinalMatcherReviewOutcome;
  decision: FeedbackEvaluationDecision;
}) {
  if (args.selectedMethod === "curated_feedback") {
    if (
      args.reviewOutcome !== "approve-curated"
      || args.decision.evidencePattern !== "consistent-improvement"
      || args.decision.recommendation !== "review-curated-candidate"
    ) {
      throw new Error(
        "Curated feedback cannot be promoted without consistent metric improvement and an approving error review.",
      );
    }
    return;
  }
  if (
    args.selectedMethod !== "no_feedback_gpt"
    || args.reviewOutcome !== "keep-control"
  ) {
    throw new Error(
      "The control method requires a keep-control review outcome.",
    );
  }
}

export function buildFinalMatcherHandoff(args: {
  receipt: FeedbackEvaluationReceipt;
  decision: FeedbackEvaluationDecision;
  visualisation: FeedbackEvaluationVisualisationManifest;
  selectedMethod: FinalMatcherMethod;
  reviewOutcome: FinalMatcherReviewOutcome;
  sources: Record<SourceName, FinalMatcherHandoffSource>;
  createdAt?: string;
}): FinalMatcherHandoff {
  requireMatchingInputs(args);
  requireSelection(args);
  const aiModel = args.visualisation.aiModel.trim();
  if (!aiModel || aiModel.length > 80) {
    throw new Error("The final handoff requires a short AI model name.");
  }

  const sources = Object.fromEntries(
    (Object.keys(SOURCE_SUFFIXES) as SourceName[]).map(name => [
      name,
      requireSource(args.sources[name], name),
    ]),
  ) as Record<SourceName, FinalMatcherHandoffSource>;

  return {
    schemaVersion: FINAL_MATCHER_HANDOFF_SCHEMA_VERSION,
    createdAt: normaliseTimestamp(args.createdAt),
    batchId: args.receipt.batch.batchId,
    selectedMethod: args.selectedMethod,
    semanticMethod: "gpt-semantic",
    aiModel,
    matchingConfigHash: requireSha(
      args.visualisation.matchingConfigHash,
      "matchingConfigHash",
    ),
    feedbackSetHash: requireSha(
      args.receipt.batch.feedbackSetHash,
      "feedbackSetHash",
    ),
    implementationCommitSha: requireSha(
      args.visualisation.implementationCommitSha,
      "implementationCommitSha",
      40,
    ),
    evaluation: {
      evidencePattern: args.decision.evidencePattern,
      recommendation: args.decision.recommendation,
      reviewOutcome: args.reviewOutcome,
    },
    sources,
    resultContract: {
      investor: true,
      scoreBreakdown: [
        "stageMatch",
        "ticketSizeMatch",
        "sectorOverlap",
        "geographyMatch",
        "instrumentMatch",
        "semanticScore",
        "totalScore",
      ],
      matchReasons: true,
      aiInsight: true,
    },
    status: "ready-for-runtime-integration",
  };
}

function resolveOutput(filePath: string, workingDirectory: string): string {
  const exportsRoot = path.resolve(workingDirectory, "exports");
  const resolved = path.resolve(workingDirectory, filePath);
  const relative = path.relative(exportsRoot, resolved);
  if (
    relative.length === 0
    || relative.startsWith("..")
    || path.isAbsolute(relative)
    || !path.basename(resolved).endsWith(".local.final-matcher.json")
  ) {
    throw new Error(
      "Final matcher handoff output must stay inside exports/ and end with .local.final-matcher.json.",
    );
  }
  return resolved;
}

async function assertAvailable(filePath: string) {
  try {
    await access(filePath);
    throw new Error(`Final matcher handoff already exists: ${filePath}.`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export async function writeFinalMatcherHandoff(args: {
  handoff: FinalMatcherHandoff;
  outputPath: string;
  workingDirectory?: string;
}): Promise<string> {
  const workingDirectory = args.workingDirectory ?? process.cwd();
  const outputPath = resolveOutput(args.outputPath, workingDirectory);
  await assertAvailable(outputPath);
  await mkdir(path.dirname(outputPath), { recursive: true });

  const temporaryPath = `${outputPath}.${process.pid}.${randomUUID()}.tmp`;
  let linked = false;
  try {
    await writeFile(
      temporaryPath,
      `${JSON.stringify(args.handoff, null, 2)}\n`,
      { encoding: "utf8", flag: "wx" },
    );
    await link(temporaryPath, outputPath);
    linked = true;
  } catch (error) {
    if (linked) await unlink(outputPath);
    throw error;
  } finally {
    await unlink(temporaryPath).catch(() => {});
  }
  return outputPath;
}

export function hashFinalMatcherSource(text: string): string {
  if (!text.trim()) throw new Error("Final matcher source file is empty.");
  return createHash("sha256").update(text, "utf8").digest("hex");
}
