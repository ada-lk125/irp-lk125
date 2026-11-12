import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getInvestors, type Investor } from "../services/airtable";
import {
  buildBaselineMatcherInput,
  validateBaselineExportInput,
} from "../services/baseline-export";
import { getDefaultMatchingConfig } from "../services/matching-config";
import {
  assertSemanticComparisonOutputAvailable,
  buildSemanticComparisonExport,
} from "../services/semantic-comparison-export";
import { runSemanticComparison } from "../services/semantic-comparison-runner";
import { semanticExperimentContract } from "../services/semantic-experiment";

type ExportArgs = {
  inputPath: string;
  investorsPath?: string;
  outputPath: string;
  runId: string;
  createdAt?: string;
};

const usage = [
  "Usage:",
  "  tsx server/scripts/export-semantic-comparison.ts --input path/to/input.json [options]",
  "",
  "Options:",
  "  --output <path>      Write private output under exports/*.local.json.",
  "  --investors <path>   Use a local investor fixture instead of Airtable.",
  "  --run-id <id>        Use a stable comparison run id.",
  "  --created-at <iso>   Use a stable ISO timestamp.",
  "  --help               Show this help text.",
].join("\n");

function getArgValue(args: string[], name: string): string | undefined {
  const prefix = `${name}=`;
  const inline = args.find(arg => arg.startsWith(prefix));
  if (inline) {
    const value = inline.slice(prefix.length);
    if (!value) throw new Error(`${name} needs a value.`);
    return value;
  }
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} needs a value.`);
  return value;
}

function parseArgs(args: string[]): ExportArgs | null {
  if (args.includes("--help")) {
    console.log(usage);
    return null;
  }
  const inputPath = getArgValue(args, "--input");
  if (!inputPath) throw new Error(`Missing --input.\n\n${usage}`);
  const createdAt = getArgValue(args, "--created-at");
  if (createdAt && Number.isNaN(new Date(createdAt).getTime())) {
    throw new Error("--created-at must be a valid date or ISO timestamp.");
  }
  return {
    inputPath,
    investorsPath: getArgValue(args, "--investors"),
    outputPath:
      getArgValue(args, "--output") || "exports/semantic-comparison.local.json",
    runId: getArgValue(args, "--run-id") || `semantic-comparison-${Date.now()}`,
    createdAt,
  };
}

async function loadInvestors(investorsPath?: string): Promise<Investor[]> {
  const rawInvestors = investorsPath
    ? JSON.parse(await readFile(investorsPath, "utf8"))
    : await getInvestors();
  if (!Array.isArray(rawInvestors)) {
    throw new Error("Investor source must be an array.");
  }
  rawInvestors.forEach((investor, index) => {
    if (!investor || typeof investor !== "object" || Array.isArray(investor)) {
      throw new Error(`investors[${index}] must be an object.`);
    }
    const id = (investor as Record<string, unknown>).id;
    if (typeof id !== "string" || id.trim().length === 0) {
      throw new Error(`investors[${index}].id must be a non-empty string.`);
    }
  });
  if (rawInvestors.length < semanticExperimentContract.topK) {
    throw new Error(
      `Comparison needs at least ${semanticExperimentContract.topK} investors.`,
    );
  }
  return rawInvestors as Investor[];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args) return;
  const outputPath = await assertSemanticComparisonOutputAvailable(args.outputPath);
  const input = validateBaselineExportInput(
    JSON.parse(await readFile(args.inputPath, "utf8")),
  );
  const matcherInput = buildBaselineMatcherInput(input);
  const investors = await loadInvestors(args.investorsPath);
  const comparison = await runSemanticComparison({
    queryId: matcherInput.queryId,
    fundingRound: matcherInput.fundingRound,
    startup: matcherInput.startup,
    investors,
    config: getDefaultMatchingConfig(),
  });
  const output = buildSemanticComparisonExport({
    comparison,
    runId: args.runId,
    source: path.resolve(args.inputPath),
    createdAt: args.createdAt,
  });

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  console.log(`Wrote semantic comparison to ${args.outputPath}`);
}

main().catch((error: Error) => {
  console.error(`Semantic comparison export failed: ${error.message}`);
  process.exit(1);
});
