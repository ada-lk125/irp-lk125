import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  verifyFeedbackComparisonBatchFiles,
  type FeedbackComparisonBatchManifest,
} from "../services/feedback-comparison-batch-manifest";
import { buildFeedbackEvaluationDecision } from "../services/feedback-evaluation-decision";
import { writeFeedbackEvaluationArtifacts } from "../services/feedback-evaluation-files";
import { buildFeedbackEvaluationReceipt } from "../services/feedback-evaluation-receipt";

type Option =
  | "batchManifest"
  | "noneMetrics"
  | "curatedMetrics"
  | "receiptOutput"
  | "decisionOutput";

const OPTION_NAMES: Record<string, Option> = {
  "--batch-manifest": "batchManifest",
  "--none-metrics": "noneMetrics",
  "--curated-metrics": "curatedMetrics",
  "--receipt-output": "receiptOutput",
  "--decision-output": "decisionOutput",
};

function usage(): never {
  console.error(
    "Usage: prepare-feedback-evaluation-decision.ts --batch-manifest <batch.local.manifest.json> --none-metrics <none.local.json> --curated-metrics <curated.local.json> --receipt-output <result.local.receipt.json> --decision-output <result.local.decision.json>",
  );
  process.exit(1);
}

function parseArgs(args: string[]): Record<Option, string> {
  const options = {} as Record<Option, string>;
  for (let index = 0; index < args.length; index += 2) {
    const option = OPTION_NAMES[args[index]];
    const value = args[index + 1];
    if (!option || !value || value.startsWith("--")) usage();
    if (options[option]) throw new Error(`${args[index]} was provided more than once.`);
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
    throw new Error(`Private input must stay inside exports/ and end with ${expectedSuffix}.`);
  }
  return resolved;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const batchManifestPath = assertPrivateInput(
    args.batchManifest,
    ".local.manifest.json",
  );
  const noneMetricsPath = assertPrivateInput(args.noneMetrics, ".local.json");
  const curatedMetricsPath = assertPrivateInput(args.curatedMetrics, ".local.json");
  const [batchManifestText, noneMetricsText, curatedMetricsText] = await Promise.all([
    readFile(batchManifestPath, "utf8"),
    readFile(noneMetricsPath, "utf8"),
    readFile(curatedMetricsPath, "utf8"),
  ]);
  const batchManifest = JSON.parse(
    batchManifestText,
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
  const decision = buildFeedbackEvaluationDecision(receipt);
  const written = await writeFeedbackEvaluationArtifacts({
    receipt,
    decision,
    receiptPath: args.receiptOutput,
    decisionPath: args.decisionOutput,
  });
  console.log(`Wrote feedback evaluation receipt: ${written.receiptPath}`);
  console.log(`Wrote feedback evaluation decision: ${written.decisionPath}`);
  console.log(`Review status: ${decision.reviewStatus}`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
