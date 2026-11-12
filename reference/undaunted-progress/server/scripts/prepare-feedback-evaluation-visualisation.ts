import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  verifyFeedbackComparisonBatchFiles,
  type FeedbackComparisonBatchManifest,
} from "../services/feedback-comparison-batch-manifest";
import { buildFeedbackEvaluationDecision } from "../services/feedback-evaluation-decision";
import {
  buildFeedbackEvaluationReceipt,
  validateFrozenRankingMetricsForFeedback,
} from "../services/feedback-evaluation-receipt";
import {
  buildFeedbackEvaluationVisualisation,
  writeFeedbackEvaluationVisualisation,
} from "../services/feedback-evaluation-visualisation";

type Option =
  | "batchManifest"
  | "noneMetrics"
  | "curatedMetrics"
  | "aiModel"
  | "implementationCommit"
  | "svgOutput"
  | "manifestOutput";

const OPTION_NAMES: Record<string, Option> = {
  "--batch-manifest": "batchManifest",
  "--none-metrics": "noneMetrics",
  "--curated-metrics": "curatedMetrics",
  "--ai-model": "aiModel",
  "--implementation-commit": "implementationCommit",
  "--svg-output": "svgOutput",
  "--manifest-output": "manifestOutput",
};

function usage(): never {
  console.error(
    "Usage: prepare-feedback-evaluation-visualisation.ts --batch-manifest <batch.local.manifest.json> --none-metrics <none.local.json> --curated-metrics <curated.local.json> --ai-model <model> --implementation-commit <40-character SHA> --svg-output <result.local.svg> --manifest-output <result.local.visualisation.json>",
  );
  process.exit(1);
}

function parseArgs(args: string[]): Record<Option, string> {
  const options = {} as Record<Option, string>;
  for (let index = 0; index < args.length; index += 2) {
    const option = OPTION_NAMES[args[index]];
    const value = args[index + 1];
    if (!option || !value || value.startsWith("--")) usage();
    if (options[option]) {
      throw new Error(`${args[index]} was provided more than once.`);
    }
    options[option] = value;
  }
  if (Object.keys(options).length !== Object.keys(OPTION_NAMES).length) usage();
  return options;
}

function assertPrivateInput(filePath: string, expectedSuffix: string): string {
  const exportsRoot = path.resolve(process.cwd(), "exports");
  const resolved = path.resolve(process.cwd(), filePath);
  const relative = path.relative(exportsRoot, resolved);
  if (
    relative.length === 0
    || relative.startsWith("..")
    || path.isAbsolute(relative)
    || !path.basename(resolved).endsWith(expectedSuffix)
  ) {
    throw new Error(
      `Private input must stay inside exports/ and end with ${expectedSuffix}.`,
    );
  }
  return resolved;
}

function parseJson(text: string, label: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`${label} must contain valid JSON.`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const batchManifestPath = assertPrivateInput(
    args.batchManifest,
    ".local.manifest.json",
  );
  const noneMetricsPath = assertPrivateInput(args.noneMetrics, ".local.json");
  const curatedMetricsPath = assertPrivateInput(
    args.curatedMetrics,
    ".local.json",
  );
  const [batchManifestText, noneMetricsText, curatedMetricsText] =
    await Promise.all([
      readFile(batchManifestPath, "utf8"),
      readFile(noneMetricsPath, "utf8"),
      readFile(curatedMetricsPath, "utf8"),
    ]);
  const batchManifest = parseJson(
    batchManifestText,
    "Feedback comparison batch manifest",
  ) as FeedbackComparisonBatchManifest;
  await verifyFeedbackComparisonBatchFiles({ manifest: batchManifest });

  const receipt = buildFeedbackEvaluationReceipt({
    batchManifestFileName: path.basename(batchManifestPath),
    batchManifestText,
    metrics: {
      none: { fileName: path.basename(noneMetricsPath), text: noneMetricsText },
      curated: {
        fileName: path.basename(curatedMetricsPath),
        text: curatedMetricsText,
      },
    },
  });
  const expectedQueryIdentities = batchManifest.files.map(
    ({ queryId, startupId, fundingRoundId }) => ({
      queryId,
      startupId,
      fundingRoundId,
    }),
  );
  const perQuery = {
    none: validateFrozenRankingMetricsForFeedback({
      rawMetrics: parseJson(noneMetricsText, "No-feedback metrics"),
      expectedQueryIds: receipt.queryIds,
      expectedQueryIdentities,
    }).perQuery,
    curated: validateFrozenRankingMetricsForFeedback({
      rawMetrics: parseJson(curatedMetricsText, "Curated-feedback metrics"),
      expectedQueryIds: receipt.queryIds,
      expectedQueryIdentities,
    }).perQuery,
  };
  const decision = buildFeedbackEvaluationDecision(receipt);
  const visualisation = buildFeedbackEvaluationVisualisation({
    receipt,
    decision,
    perQuery,
    aiModel: args.aiModel,
    implementationCommitSha: args.implementationCommit,
    svgFileName: path.basename(args.svgOutput),
  });
  const written = await writeFeedbackEvaluationVisualisation({
    visualisation,
    svgPath: args.svgOutput,
    manifestPath: args.manifestOutput,
  });

  console.log(`Wrote feedback evaluation chart: ${written.svgPath}`);
  console.log(`Wrote chart manifest: ${written.manifestPath}`);
  console.log(`Evidence pattern: ${decision.evidencePattern}`);
  console.log(`Recommendation: ${decision.recommendation}`);
  console.log(`Review status: ${decision.reviewStatus}`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
