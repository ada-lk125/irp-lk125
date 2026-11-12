import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getInvestors, type Investor } from "../services/airtable";
import {
  buildBaselineExportBody,
  buildBaselineMatcherInput,
  validateBaselineExportInput,
} from "../services/baseline-export";
import { runMatching, type MatchProgress } from "../services/matching";
import { getDefaultMatchingConfig } from "../services/matching-config";
import { parseSharedInvestorCsv } from "../services/airtable-shared-view";

type ExportArgs = {
  inputPath: string;
  investorsPath?: string;
  investorsCsvPath?: string;
  outputPath: string;
  runId?: string;
  createdAt?: string;
  dryRun: boolean;
  skipAi: boolean;
  normalisationProfile?: "legacy" | "normalisation-v1";
};

const usage = [
  "Usage:",
  "  tsx server/scripts/export-baseline-matches.ts --input path/to/input.json [options]",
  "",
  "Options:",
  "  --output <path>      Write export JSON to this local path.",
  "  --investors <path>   Use a local investor fixture instead of Airtable.",
  "  --investors-csv <path> Use an exported read-only Airtable Investors view.",
  "  --run-id <id>        Use a stable run id in the export metadata.",
  "  --created-at <iso>   Use a stable ISO timestamp in the export metadata.",
  "  --dry-run            Validate input and write an empty export shell.",
  "  --skip-ai            Run local fixture checks without semantic scoring.",
  "  --normalisation-profile <legacy|normalisation-v1> Select the auditable rule profile.",
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
  if (index >= 0) {
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${name} needs a value.`);
    }
    return value;
  }
  return undefined;
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

function normaliseIsoTimestamp(value?: string): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("--created-at must be a valid date or ISO timestamp.");
  }
  return parsed.toISOString();
}

function parseNormalisationProfile(
  value: string | undefined,
): ExportArgs["normalisationProfile"] {
  if (!value) return undefined;
  if (value !== "legacy" && value !== "normalisation-v1") {
    throw new Error(
      "--normalisation-profile must be legacy or normalisation-v1.",
    );
  }
  return value;
}

function parseArgs(args: string[]): ExportArgs | null {
  if (hasFlag(args, "--help")) {
    console.log(usage);
    return null;
  }

  const inputPath = getArgValue(args, "--input");
  if (!inputPath) {
    throw new Error(`Missing --input.\n\n${usage}`);
  }

  const investorsPath = getArgValue(args, "--investors");
  const investorsCsvPath = getArgValue(args, "--investors-csv");
  if (investorsPath && investorsCsvPath) {
    throw new Error("Use either --investors or --investors-csv, not both.");
  }

  return {
    inputPath,
    investorsPath,
    investorsCsvPath,
    outputPath: getArgValue(args, "--output") || "exports/baseline-matches.local.json",
    runId: getArgValue(args, "--run-id"),
    createdAt: normaliseIsoTimestamp(getArgValue(args, "--created-at")),
    dryRun: hasFlag(args, "--dry-run"),
    skipAi: hasFlag(args, "--skip-ai"),
    normalisationProfile: parseNormalisationProfile(
      getArgValue(args, "--normalisation-profile"),
    ),
  };
}

async function loadInvestors(
  investorsPath?: string,
  investorsCsvPath?: string,
): Promise<Investor[]> {
  if (investorsCsvPath) {
    return parseSharedInvestorCsv(await readFile(investorsCsvPath, "utf8"));
  }
  if (!investorsPath) {
    return getInvestors();
  }

  const rawInvestors = await readFile(investorsPath, "utf8");
  const investors = JSON.parse(rawInvestors);
  if (!Array.isArray(investors)) {
    throw new Error("Investor fixture must be a JSON array.");
  }

  validateInvestorFixture(investors);
  return investors as Investor[];
}

function isStringArray(value: unknown) {
  return Array.isArray(value) && value.every(item => typeof item === "string");
}

function validateInvestorFixture(investors: unknown[]) {
  const errors: string[] = [];
  investors.forEach((investor, index) => {
    if (!investor || typeof investor !== "object" || Array.isArray(investor)) {
      errors.push(`investors[${index}] must be an object.`);
      return;
    }

    const row = investor as Record<string, unknown>;
    const label = `investors[${index}]`;
    if (typeof row.id !== "string" || row.id.trim().length === 0) {
      errors.push(`${label}.id must be a non-empty string.`);
    }
    if (typeof row.organisation !== "string" || row.organisation.trim().length === 0) {
      errors.push(`${label}.organisation must be a non-empty string.`);
    }
    for (const field of ["description", "hqLocation", "investmentThesis"]) {
      const value = row[field];
      if (
        value !== undefined &&
        value !== null &&
        (typeof value !== "string" || value.trim().length === 0)
      ) {
        errors.push(`${label}.${field} must be a non-empty string when present.`);
      }
    }
    for (const field of ["investmentStage", "sectorFocus", "regionalFocus", "investmentInstruments"]) {
      if (!isStringArray(row[field])) {
        errors.push(`${label}.${field} must be an array of strings.`);
      }
    }
  });

  if (errors.length > 0) {
    throw new Error(`Investor fixture is invalid:\n${errors.map(error => `- ${error}`).join("\n")}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args) return;

  const rawInput = await readFile(args.inputPath, "utf8");
  const input = validateBaselineExportInput(JSON.parse(rawInput));
  const matcherInput = buildBaselineMatcherInput(input);
  const runId = args.runId || `baseline-${Date.now()}`;
  const baseConfig = getDefaultMatchingConfig();
  const selectedConfig = args.normalisationProfile
    ? { ...baseConfig, normalisationProfile: args.normalisationProfile }
    : baseConfig;
  const config = args.skipAi
    ? { ...selectedConfig, aiCandidateCount: 0, aiBatchSize: 0 }
    : selectedConfig;

  if (args.dryRun) {
    const exportBody = buildBaselineExportBody({
      runId,
      matcherInput,
      config,
      source: path.resolve(args.inputPath),
      createdAt: args.createdAt,
      dryRun: args.dryRun,
      progress: [],
      matches: [],
    });
    await mkdir(path.dirname(args.outputPath), { recursive: true });
    await writeFile(args.outputPath, `${JSON.stringify(exportBody, null, 2)}\n`, "utf8");
    console.log(`Wrote dry-run baseline export to ${args.outputPath}`);
    return;
  }

  const investors = await loadInvestors(
    args.investorsPath,
    args.investorsCsvPath,
  );
  const progressLog: MatchProgress[] = [];
  const matches = await runMatching(
    matcherInput.fundingRound,
    matcherInput.startup,
    investors,
    [],
    undefined,
    config,
    progress => progressLog.push(progress),
  );

  const exportBody = buildBaselineExportBody({
    runId,
    matcherInput,
    config,
    source: path.resolve(args.inputPath),
    createdAt: args.createdAt,
    dryRun: args.dryRun,
    progress: progressLog,
    matches,
  });

  await mkdir(path.dirname(args.outputPath), { recursive: true });
  await writeFile(args.outputPath, `${JSON.stringify(exportBody, null, 2)}\n`, "utf8");
  console.log(`Wrote baseline export to ${args.outputPath}`);
}

main().catch((err: Error) => {
  console.error(`Baseline export failed: ${err.message}`);
  process.exit(1);
});
