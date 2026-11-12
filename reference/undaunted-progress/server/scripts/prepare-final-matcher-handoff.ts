import { readFile } from "node:fs/promises";
import path from "node:path";
import type { FeedbackEvaluationDecision } from "../services/feedback-evaluation-decision";
import type { FeedbackEvaluationReceipt } from "../services/feedback-evaluation-receipt";
import type { FeedbackEvaluationVisualisationManifest } from "../services/feedback-evaluation-visualisation";
import {
  buildFinalMatcherHandoff,
  hashFinalMatcherSource,
  writeFinalMatcherHandoff,
  type FinalMatcherMethod,
  type FinalMatcherReviewOutcome,
} from "../services/final-matcher-handoff";

type Option =
  | "receipt"
  | "decision"
  | "visualisation"
  | "errorReview"
  | "selectedMethod"
  | "reviewOutcome"
  | "output";

const OPTIONS: Record<string, Option> = {
  "--receipt": "receipt",
  "--decision": "decision",
  "--visualisation-manifest": "visualisation",
  "--error-review": "errorReview",
  "--selected-method": "selectedMethod",
  "--review-outcome": "reviewOutcome",
  "--output": "output",
};

function usage(): never {
  console.error(
    "Usage: prepare-final-matcher-handoff.ts --receipt <result.local.receipt.json> --decision <result.local.decision.json> --visualisation-manifest <result.local.visualisation.json> --error-review <summary.local.error-review.json> --selected-method <no_feedback_gpt|curated_feedback> --review-outcome <keep-control|approve-curated> --output <handoff.local.final-matcher.json>",
  );
  process.exit(1);
}

function parseArgs(args: string[]): Record<Option, string> {
  const parsed = {} as Record<Option, string>;
  for (let index = 0; index < args.length; index += 2) {
    const option = OPTIONS[args[index]];
    const value = args[index + 1];
    if (!option || !value || value.startsWith("--")) usage();
    if (parsed[option]) {
      throw new Error(`${args[index]} was provided more than once.`);
    }
    parsed[option] = value;
  }
  if (Object.keys(parsed).length !== Object.keys(OPTIONS).length) usage();
  return parsed;
}

function privateInput(filePath: string, suffix: string): string {
  const exportsRoot = path.resolve(process.cwd(), "exports");
  const resolved = path.resolve(process.cwd(), filePath);
  const relative = path.relative(exportsRoot, resolved);
  if (
    relative.length === 0
    || relative.startsWith("..")
    || path.isAbsolute(relative)
    || !path.basename(resolved).endsWith(suffix)
  ) {
    throw new Error(
      `Private input must stay inside exports/ and end with ${suffix}.`,
    );
  }
  return resolved;
}

function parseJson<T>(text: string, label: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${label} must contain valid JSON.`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const paths = {
    receipt: privateInput(args.receipt, ".local.receipt.json"),
    decision: privateInput(args.decision, ".local.decision.json"),
    visualisation: privateInput(
      args.visualisation,
      ".local.visualisation.json",
    ),
    errorReview: privateInput(
      args.errorReview,
      ".local.error-review.json",
    ),
  };
  const texts = {
    receipt: await readFile(paths.receipt, "utf8"),
    decision: await readFile(paths.decision, "utf8"),
    visualisation: await readFile(paths.visualisation, "utf8"),
    errorReview: await readFile(paths.errorReview, "utf8"),
  };

  const handoff = buildFinalMatcherHandoff({
    receipt: parseJson<FeedbackEvaluationReceipt>(
      texts.receipt,
      "Evaluation receipt",
    ),
    decision: parseJson<FeedbackEvaluationDecision>(
      texts.decision,
      "Evaluation decision",
    ),
    visualisation: parseJson<FeedbackEvaluationVisualisationManifest>(
      texts.visualisation,
      "Visualisation manifest",
    ),
    selectedMethod: args.selectedMethod as FinalMatcherMethod,
    reviewOutcome: args.reviewOutcome as FinalMatcherReviewOutcome,
    sources: {
      receipt: {
        fileName: path.basename(paths.receipt),
        sha256: hashFinalMatcherSource(texts.receipt),
      },
      decision: {
        fileName: path.basename(paths.decision),
        sha256: hashFinalMatcherSource(texts.decision),
      },
      visualisation: {
        fileName: path.basename(paths.visualisation),
        sha256: hashFinalMatcherSource(texts.visualisation),
      },
      errorReview: {
        fileName: path.basename(paths.errorReview),
        sha256: hashFinalMatcherSource(texts.errorReview),
      },
    },
  });
  const outputPath = await writeFinalMatcherHandoff({
    handoff,
    outputPath: args.output,
  });
  console.log(`Wrote final matcher handoff: ${outputPath}`);
  console.log(`Selected method: ${handoff.selectedMethod}`);
  console.log(`Review outcome: ${handoff.evaluation.reviewOutcome}`);
  console.log(`Status: ${handoff.status}`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
