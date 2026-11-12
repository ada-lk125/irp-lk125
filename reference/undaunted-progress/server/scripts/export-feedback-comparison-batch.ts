import { createHash } from "node:crypto";
import { access, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import {
  buildBaselineMatcherInput,
  validateBaselineExportInput,
} from "../services/baseline-export";
import { parseSharedInvestorCsv } from "../services/airtable-shared-view";
import {
  runFeedbackComparisonBatch,
  type FeedbackComparisonBatchQueryInput,
} from "../services/feedback-comparison-batch";
import {
  buildFeedbackComparisonBatchManifest,
  writeFeedbackComparisonBatchManifest,
} from "../services/feedback-comparison-batch-manifest";
import {
  assertFeedbackComparisonOutputAvailable,
  buildFeedbackComparisonExport,
  writeFeedbackComparisonExport,
} from "../services/feedback-comparison-export";
import { buildFeedbackMatchingConfigHash } from "../services/feedback-comparison-runner";
import { buildFeedbackExperimentDefinition } from "../services/feedback-experiment";
import { selectCuratedFeedback } from "../services/feedback-selection";
import { validateFeedbackSelectionSource } from "../services/feedback-selection-source";
import { getDefaultMatchingConfig } from "../services/matching-config";
import { buildSemanticComparisonIdentity } from "../services/semantic-comparison";

interface ParsedArgs {
  inputs: string[];
  investorsCsv: string;
  feedbackSource: string;
  feedbackSetVersion: string;
  maxPerRating: number;
  maxFeedbackContextCharacters: number;
  outputPrefix: string;
  manifest: string;
  batchId: string;
  source: string;
  createdAt: string;
}

const DEFAULT_INPUTS = [
  "exports/formal-query-input-v3-01.local.json",
  "exports/formal-query-input-v3-02.local.json",
  "exports/formal-query-input-v3-03.local.json",
];
const EXPECTED_CANDIDATE_COUNT = 354;
const EXPECTED_CANDIDATE_POOL_HASH =
  "2f676cd5efc1ae4f09270bb072c4e896b7a07d6a49df77c802aee7b31c5bd2f0";
const EXPECTED_QUERY_IDENTITY_HASH =
  "4952625f0c48ec3546577aa6fd65d5fdf0539b3e221916098a854bbc4e43b505";

function requirePositiveInteger(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return parsed;
}

function parseArgs(args: string[]): ParsedArgs {
  const inputs: string[] = [];
  const options = new Map<string, string>();
  const allowed = new Set([
    "--input",
    "--investors-csv",
    "--feedback-source",
    "--feedback-set-version",
    "--max-per-rating",
    "--max-feedback-context-characters",
    "--output-prefix",
    "--manifest",
    "--batch-id",
    "--source",
    "--created-at",
  ]);

  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (!allowed.has(name) || !value || value.startsWith("--")) {
      throw new Error(
        "Usage: export-feedback-comparison-batch.ts [--input <query.local.json> x3] --feedback-source <source.local.json> [options]",
      );
    }
    if (name === "--input") {
      inputs.push(value);
    } else {
      if (options.has(name)) {
        throw new Error(`${name} was provided more than once.`);
      }
      options.set(name, value);
    }
  }

  const createdAt = options.get("--created-at") ?? new Date().toISOString();
  if (Number.isNaN(new Date(createdAt).getTime())) {
    throw new Error("--created-at must be a valid date or ISO timestamp.");
  }
  const selectedInputs = inputs.length > 0 ? inputs : DEFAULT_INPUTS;
  if (selectedInputs.length !== 3) {
    throw new Error("Exactly three --input values are required.");
  }

  return {
    inputs: selectedInputs,
    investorsCsv:
      options.get("--investors-csv") ??
      "exports/investors-formal-v3-readonly.local.csv",
    feedbackSource:
      options.get("--feedback-source") ??
      "exports/feedback-selection-source.local.json",
    feedbackSetVersion:
      options.get("--feedback-set-version") ??
      "curated-match-feedback-2026-07-23-v1",
    maxPerRating: requirePositiveInteger(
      options.get("--max-per-rating") ?? "2",
      "--max-per-rating",
    ),
    maxFeedbackContextCharacters: requirePositiveInteger(
      options.get("--max-feedback-context-characters") ?? "2500",
      "--max-feedback-context-characters",
    ),
    outputPrefix:
      options.get("--output-prefix") ?? "exports/feedback-formal-v3-query",
    manifest:
      options.get("--manifest") ?? "exports/feedback-batch.local.manifest.json",
    batchId: options.get("--batch-id") ?? "feedback-ablation-formal-v3-v1",
    source: options.get("--source") ?? "feedback-ablation-formal-v3-live",
    createdAt: new Date(createdAt).toISOString(),
  };
}

function resolvePrivateInput(
  filePath: string,
  suffix: ".local.json" | ".local.csv",
): string {
  const exportsRoot = path.resolve(process.cwd(), "exports");
  const resolved = path.resolve(process.cwd(), filePath);
  const relative = path.relative(exportsRoot, resolved);
  if (
    relative.length === 0 ||
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    !path.basename(resolved).endsWith(suffix)
  ) {
    throw new Error(
      `Private input must stay inside exports/ and end with ${suffix}.`,
    );
  }
  return resolved;
}

function outputPaths(prefix: string): string[] {
  return [1, 2, 3].map(
    (index) => `${prefix}-${String(index).padStart(2, "0")}.local.json`,
  );
}

async function requireManifestAvailable(filePath: string) {
  const exportsRoot = path.resolve(process.cwd(), "exports");
  const resolved = path.resolve(process.cwd(), filePath);
  const relative = path.relative(exportsRoot, resolved);
  if (
    relative.length === 0 ||
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    !path.basename(resolved).endsWith(".local.manifest.json")
  ) {
    throw new Error(
      "Feedback comparison manifest must stay inside exports/ and end with .local.manifest.json.",
    );
  }
  try {
    await access(resolved);
    throw new Error(
      `Feedback comparison manifest already exists: ${filePath}.`,
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const requestedOutputs = outputPaths(args.outputPrefix);
  await Promise.all([
    ...requestedOutputs.map((filePath) =>
      assertFeedbackComparisonOutputAvailable(filePath),
    ),
    requireManifestAvailable(args.manifest),
  ]);

  const queryInputPaths = args.inputs.map((filePath) =>
    resolvePrivateInput(filePath, ".local.json"),
  );
  const investorsPath = resolvePrivateInput(args.investorsCsv, ".local.csv");
  const feedbackSourcePath = resolvePrivateInput(
    args.feedbackSource,
    ".local.json",
  );
  const [queryTexts, investorsCsv, feedbackSourceText] = await Promise.all([
    Promise.all(queryInputPaths.map((filePath) => readFile(filePath, "utf8"))),
    readFile(investorsPath, "utf8"),
    readFile(feedbackSourcePath, "utf8"),
  ]);

  const investors = parseSharedInvestorCsv(investorsCsv);
  const feedbackSource = validateFeedbackSelectionSource(
    JSON.parse(feedbackSourceText),
  );
  const queryInputs: FeedbackComparisonBatchQueryInput[] = queryTexts.map(
    (text) => {
      const matcherInput = buildBaselineMatcherInput(
        validateBaselineExportInput(JSON.parse(text)),
      );
      return {
        queryId: matcherInput.queryId,
        startup: matcherInput.startup,
        fundingRound: matcherInput.fundingRound,
        investors: [...investors],
      };
    },
  );
  const queryIdentityHash = createHash("sha256")
    .update(
      JSON.stringify(
        queryInputs.map(({ queryId, startup, fundingRound }) => ({
          queryId,
          startupId: startup.id,
          fundingRoundId: fundingRound.id,
        })),
      ),
      "utf8",
    )
    .digest("hex");
  if (queryIdentityHash !== EXPECTED_QUERY_IDENTITY_HASH) {
    throw new Error(
      "Inputs do not match the frozen formal-v3 query identity hash.",
    );
  }
  const candidateIdentity = buildSemanticComparisonIdentity({
    queryId: queryInputs[0].queryId,
    startupId: queryInputs[0].startup.id,
    fundingRoundId: queryInputs[0].fundingRound.id,
    investorIds: investors.map(({ id }) => id),
  });
  if (
    candidateIdentity.candidateCount !== EXPECTED_CANDIDATE_COUNT ||
    candidateIdentity.candidatePoolHash !== EXPECTED_CANDIDATE_POOL_HASH
  ) {
    throw new Error(
      "Investor CSV does not match the frozen formal-v3 354-candidate pool.",
    );
  }
  const evaluationFundingRoundIds = queryInputs.map(
    ({ fundingRound }) => fundingRound.id,
  );
  const selection = selectCuratedFeedback({
    feedbackSetVersion: args.feedbackSetVersion,
    entries: feedbackSource.entries,
    evaluationFundingRoundIds,
    maxPerRating: args.maxPerRating,
  });
  if (
    selection.summary.selectedUpCount === 0 ||
    selection.summary.selectedDownCount === 0
  ) {
    throw new Error(
      "Real curated_feedback requires at least one eligible positive and one eligible negative human reason. No OpenAI calls were made.",
    );
  }

  const config = getDefaultMatchingConfig();
  const identities = queryInputs.map(({ queryId, startup, fundingRound }) =>
    buildSemanticComparisonIdentity({
      queryId,
      startupId: startup.id,
      fundingRoundId: fundingRound.id,
      investorIds: investors.map(({ id }) => id),
    }),
  );
  const definition = buildFeedbackExperimentDefinition({
    matchingConfigHash: buildFeedbackMatchingConfigHash(config),
    feedbackSetVersion: selection.feedbackSetVersion,
    feedbackSetHash: selection.feedbackSetHash,
    queries: identities.map((identity) => ({
      queryId: identity.queryId,
      startupId: identity.startupId,
      fundingRoundId: identity.fundingRoundId,
      candidatePoolHash: identity.candidatePoolHash,
    })),
  });

  console.log(
    `Starting protected real batch: ${queryInputs.length} queries, ${investors.length} fixed candidates, two GPT methods.`,
  );
  console.log(
    `Curated evidence: ${selection.summary.selectedUpCount} up / ${selection.summary.selectedDownCount} down.`,
  );
  const batch = await runFeedbackComparisonBatch({
    inputs: queryInputs,
    config,
    selection,
    definition,
    maxFeedbackContextCharacters: args.maxFeedbackContextCharacters,
    onProgress: (queryId, feedbackMode, progress) => {
      console.log(
        `${queryId} ${feedbackMode}: ${progress.phase} ${progress.current}/${progress.total}`,
      );
    },
  });

  const outputs = batch.comparisons.map((comparison, index) => ({
    filePath: requestedOutputs[index],
    fileName: path.basename(requestedOutputs[index]),
    output: buildFeedbackComparisonExport({
      comparison,
      definition,
      runId: `${args.batchId}-${comparison.query.queryId}`,
      source: args.source,
      createdAt: args.createdAt,
    }),
  }));
  const written: string[] = [];
  try {
    for (const entry of outputs) {
      written.push(
        await writeFeedbackComparisonExport({
          output: entry.output,
          filePath: entry.filePath,
        }),
      );
    }
    const manifest = buildFeedbackComparisonBatchManifest({
      batchId: args.batchId,
      definition,
      outputs: outputs.map(({ fileName, output }) => ({ fileName, output })),
      createdAt: args.createdAt,
    });
    await writeFeedbackComparisonBatchManifest({
      manifest,
      filePath: args.manifest,
    });
  } catch (error) {
    await Promise.all(
      written.map((filePath) => unlink(filePath).catch(() => {})),
    );
    throw error;
  }

  console.log("Completed real no_feedback_gpt and curated_feedback batch.");
  outputs.forEach(({ filePath }) => console.log(`- ${filePath}`));
  console.log(`- ${args.manifest}`);
}

main().catch((error) => {
  console.error(
    `Feedback comparison batch export failed: ${
      error instanceof Error ? error.message : error
    }`,
  );
  process.exitCode = 1;
});
