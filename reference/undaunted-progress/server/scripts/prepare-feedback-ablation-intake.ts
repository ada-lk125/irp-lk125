import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  buildFeedbackAblationIntake,
  writeFeedbackAblationIntakeArtifacts,
} from "../services/feedback-ablation-intake";
import {
  validateFeedbackComparisonBatchManifest,
  type FeedbackComparisonBatchManifest,
} from "../services/feedback-comparison-batch-manifest";

type Option =
  | "batchManifest"
  | "frozenLabels"
  | "frozenManifest"
  | "csvOutput"
  | "manifestOutput"
  | "createdAt";

const OPTION_NAMES: Record<string, Option> = {
  "--batch-manifest": "batchManifest",
  "--frozen-labels": "frozenLabels",
  "--frozen-manifest": "frozenManifest",
  "--csv-output": "csvOutput",
  "--manifest-output": "manifestOutput",
  "--created-at": "createdAt",
};

type ParsedOptions = Record<Exclude<Option, "createdAt">, string> & {
  createdAt?: string;
};

function usage(): never {
  console.error(
    "Usage: prepare-feedback-ablation-intake.ts --batch-manifest <batch.local.manifest.json> --frozen-labels <labels.local.csv> --frozen-manifest <labels-frozen-manifest.local.json> --csv-output <intake.local.csv> --manifest-output <intake.local.manifest.json> [--created-at <ISO timestamp>]",
  );
  process.exit(1);
}

function parseArgs(args: string[]): ParsedOptions {
  const options: Partial<Record<Option, string>> = {};
  for (let index = 0; index < args.length; index += 2) {
    const optionName = args[index];
    const option = OPTION_NAMES[optionName];
    const value = args[index + 1];
    if (!option || !value || value.startsWith("--")) usage();
    if (options[option]) {
      throw new Error(`${optionName} was provided more than once.`);
    }
    options[option] = value;
  }
  for (const required of [
    "batchManifest",
    "frozenLabels",
    "frozenManifest",
    "csvOutput",
    "manifestOutput",
  ] as const) {
    if (!options[required]) usage();
  }
  return options as ParsedOptions;
}

function resolvePrivateInput(
  filePath: string,
  suffix: ".local.csv" | ".local.json" | ".local.manifest.json",
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const batchManifestPath = resolvePrivateInput(
    args.batchManifest,
    ".local.manifest.json",
  );
  const frozenLabelsPath = resolvePrivateInput(args.frozenLabels, ".local.csv");
  const frozenManifestPath = resolvePrivateInput(
    args.frozenManifest,
    ".local.json",
  );
  const [batchManifestText, frozenLabelsCsv, frozenManifestText] =
    await Promise.all([
      readFile(batchManifestPath, "utf8"),
      readFile(frozenLabelsPath, "utf8"),
      readFile(frozenManifestPath, "utf8"),
    ]);
  const batchManifest = JSON.parse(
    batchManifestText,
  ) as FeedbackComparisonBatchManifest;
  validateFeedbackComparisonBatchManifest(batchManifest);
  const exportsRoot = path.resolve(process.cwd(), "exports");
  const comparisonFiles = await Promise.all(
    batchManifest.files.map(async (file) => ({
      fileName: file.fileName,
      text: await readFile(path.join(exportsRoot, file.fileName), "utf8"),
    })),
  );

  const artifacts = buildFeedbackAblationIntake({
    batchManifestFileName: path.basename(batchManifestPath),
    batchManifestText,
    comparisonFiles,
    frozenLabelsCsv,
    frozenLabelsFileName: path.basename(frozenLabelsPath),
    frozenManifestText,
    frozenManifestFileName: path.basename(frozenManifestPath),
    csvFileName: path.basename(args.csvOutput),
    createdAt: args.createdAt,
  });
  const written = await writeFeedbackAblationIntakeArtifacts({
    artifacts,
    csvPath: args.csvOutput,
    manifestPath: args.manifestOutput,
  });

  console.log(`Wrote feedback ablation intake CSV: ${written.csvPath}`);
  console.log(
    `Wrote feedback ablation intake manifest: ${written.manifestPath}`,
  );
  console.log(`Evaluation status: ${artifacts.manifest.evaluationStatus}`);
  if (artifacts.manifest.labelCoverage.missingPairCount > 0) {
    console.log(
      `Stop before metrics: ${artifacts.manifest.labelCoverage.missingPairCount} unique top-ten pair(s) need supplementary blind labelling.`,
    );
  } else if (!artifacts.manifest.labelCoverage.frozenLabelsComplete) {
    console.log(
      "Stop before metrics: the frozen label set contains incomplete queries.",
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
