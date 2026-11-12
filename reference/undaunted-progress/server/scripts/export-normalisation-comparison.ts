import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseSharedInvestorCsv } from "../services/airtable-shared-view";
import {
  buildBaselineMatcherInput,
  toBaselineExportRow,
  validateBaselineExportInput,
} from "../services/baseline-export";
import { runMatching, type MatchingRunOptions } from "../services/matching";
import { getDefaultMatchingConfig } from "../services/matching-config";

const schemaVersion = "normalisation-paired-comparison-v1";
const profiles = ["legacy", "normalisation-v1"] as const;
const candidateTieBreak = "investor-id" as const;
const feedbackMode = "none" as const;
const topK = 10;

type SemanticMode = NonNullable<MatchingRunOptions["semanticMode"]>;
type Purpose = "pilot" | "formal";

type ExportArgs = {
  inputPaths: string[];
  investorsCsvPath: string;
  outputPath: string;
  experimentId: string;
  purpose: Purpose;
  semanticMode: SemanticMode;
  createdAt: string;
};

const usage = [
  "Usage:",
  "  tsx server/scripts/export-normalisation-comparison.ts --input <file> --input <file> [--input <file> ...] --investors-csv <file> --experiment-id <id> --created-at <iso> [options]",
  "",
  "Options:",
  "  --input <file>         Repeat for two to four distinct case inputs.",
  "  --output <path>        Protected output under exports/*.local.json.",
  "  --purpose <value>      pilot or formal (default: pilot).",
  "  --semantic-mode <mode> rule-only, text-similarity or gpt-semantic.",
  "  --help                 Show this help text.",
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
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} needs a value.`);
  }
  return value;
}

function getArgValues(args: string[], name: string): string[] {
  const values: string[] = [];
  const prefix = `${name}=`;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg.startsWith(prefix)) {
      const value = arg.slice(prefix.length);
      if (!value) throw new Error(`${name} needs a value.`);
      values.push(value);
    } else if (arg === name) {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${name} needs a value.`);
      }
      values.push(value);
      index += 1;
    }
  }
  return values;
}

function parsePurpose(value?: string): Purpose {
  if (!value || value === "pilot") return "pilot";
  if (value === "formal") return "formal";
  throw new Error("--purpose must be pilot or formal.");
}

function parseSemanticMode(value?: string): SemanticMode {
  if (!value || value === "text-similarity") return "text-similarity";
  if (value === "rule-only" || value === "gpt-semantic") return value;
  throw new Error(
    "--semantic-mode must be rule-only, text-similarity or gpt-semantic.",
  );
}

function parseCreatedAt(value?: string): string {
  if (!value) throw new Error("--created-at is required.");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("--created-at must be a valid date or ISO timestamp.");
  }
  return date.toISOString();
}

function parseArgs(args: string[]): ExportArgs | null {
  if (args.includes("--help")) {
    console.log(usage);
    return null;
  }
  const inputPaths = getArgValues(args, "--input");
  if (inputPaths.length < 2 || inputPaths.length > 4) {
    throw new Error(`Two to four --input files are required.\n\n${usage}`);
  }
  if (
    new Set(inputPaths.map(input => path.resolve(input))).size
    !== inputPaths.length
  ) {
    throw new Error("--input files must be unique.");
  }
  const investorsCsvPath = getArgValue(args, "--investors-csv");
  if (!investorsCsvPath) throw new Error("Missing --investors-csv.");
  const experimentId = getArgValue(args, "--experiment-id");
  if (!experimentId?.trim()) throw new Error("Missing --experiment-id.");
  return {
    inputPaths,
    investorsCsvPath,
    outputPath:
      getArgValue(args, "--output")
      ?? "exports/normalisation-comparison.local.json",
    experimentId: experimentId.trim(),
    purpose: parsePurpose(getArgValue(args, "--purpose")),
    semanticMode: parseSemanticMode(getArgValue(args, "--semantic-mode")),
    createdAt: parseCreatedAt(getArgValue(args, "--created-at")),
  };
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function gitValue(args: string[]): string {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed.`);
  }
  return result.stdout.trim();
}

async function resolveOutputPath(filePath: string): Promise<string> {
  const exportsRoot = path.resolve("exports");
  const resolved = path.resolve(filePath);
  const relative = path.relative(exportsRoot, resolved);
  const insideExports =
    relative.length > 0
    && !relative.startsWith("..")
    && !path.isAbsolute(relative);
  if (!insideExports || !path.basename(resolved).endsWith(".local.json")) {
    throw new Error("Output must stay inside exports/ and end with .local.json.");
  }
  try {
    await access(resolved);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return resolved;
    throw error;
  }
  throw new Error(`Output already exists and will not be overwritten: ${filePath}`);
}

function inputOrderHash(ids: string[]): string {
  return sha256(JSON.stringify(ids));
}

function candidatePoolHash(ids: string[]): string {
  return sha256(
    JSON.stringify(
      [...ids].sort((left, right) =>
        left < right ? -1 : left > right ? 1 : 0,
      ),
    ),
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args) return;
  if (
    args.semanticMode === "gpt-semantic"
    && !process.env.AI_INTEGRATIONS_OPENAI_API_KEY
  ) {
    throw new Error(
      "gpt-semantic requires AI_INTEGRATIONS_OPENAI_API_KEY; refusing to create fallback-only experiment output.",
    );
  }
  const outputPath = await resolveOutputPath(args.outputPath);
  const gitCommit = gitValue(["rev-parse", "HEAD"]);
  const gitStatus = gitValue(["status", "--porcelain"]);
  const implementationDirty = gitStatus.length > 0;
  if (args.purpose === "formal" && implementationDirty) {
    throw new Error(
      "Formal comparison requires a clean Git worktree. Use --purpose pilot while implementation changes are uncommitted.",
    );
  }

  const investorsCsv = await readFile(args.investorsCsvPath, "utf8");
  const investors = parseSharedInvestorCsv(investorsCsv);
  const investorIds = investors.map(({ id }) => id);
  if (investors.length < topK) {
    throw new Error(`Investor source must contain at least ${topK} records.`);
  }
  if (new Set(investorIds).size !== investorIds.length) {
    throw new Error("Investor source contains duplicate ids.");
  }

  const matchingPath = existsSync("src/services/matching.ts")
    ? "src/services/matching.ts"
    : "server/services/matching.ts";
  const matchingSource = await readFile(matchingPath, "utf8");
  const baseConfig = getDefaultMatchingConfig();
  const queryIds = new Set<string>();
  const queries = [];

  for (const inputPath of args.inputPaths) {
    const inputText = await readFile(inputPath, "utf8");
    const input = validateBaselineExportInput(JSON.parse(inputText));
    if (queryIds.has(input.queryId)) {
      throw new Error(`Duplicate query id: ${input.queryId}.`);
    }
    queryIds.add(input.queryId);
    const matcherInput = buildBaselineMatcherInput(input);
    const profileRuns = [];

    for (const normalisationProfile of profiles) {
      const config = { ...baseConfig, normalisationProfile };
      const matches = await runMatching(
        matcherInput.fundingRound,
        matcherInput.startup,
        investors,
        [],
        undefined,
        config,
        undefined,
        {
          semanticMode: args.semanticMode,
          candidateTieBreak,
        },
      );
      if (
        args.semanticMode === "gpt-semantic"
        && matches.some(
          match => match.aiInsight === "Unable to perform semantic analysis",
        )
      ) {
        throw new Error(
          `gpt-semantic failed for ${input.queryId} ${normalisationProfile}; no partial fallback output was written.`,
        );
      }
      profileRuns.push({
        normalisationProfile,
        configSha256: sha256(JSON.stringify(config)),
        matches: matches.slice(0, topK).map(toBaselineExportRow),
      });
    }

    const legacyIds = profileRuns[0].matches.map(match => match.investor.id);
    const variantIds = profileRuns[1].matches.map(match => match.investor.id);
    const variantSet = new Set(variantIds);
    queries.push({
      queryId: input.queryId,
      startupId: input.startupId,
      fundingRoundId: input.fundingRoundId,
      reviewContext: {
        startupName: input.startupName,
        description: input.description,
        climateProblem: input.climateProblem,
        solutionDescription: input.solutionDescription,
        businessModel: input.businessModel,
        targetMarket: input.targetMarket,
        competitors: input.competitors,
        roundStage: input.roundStage,
        amountRaising: input.amountRaising,
        minTicketSize: input.minTicketSize,
        investmentTypes: input.investmentTypes,
        roundGeography: input.roundGeography,
        roundSectors: input.roundSectors,
        tweetPitch: input.tweetPitch,
        tractionSummary: input.tractionSummary,
        unfairAdvantage: input.unfairAdvantage,
        preferredInvestorTypes: input.preferredInvestorTypes,
      },
      input: {
        fileName: path.basename(inputPath),
        sha256: sha256(inputText),
      },
      topKOverlap: legacyIds.filter(id => variantSet.has(id)).length,
      profiles: profileRuns,
    });
  }

  const output = {
    run: {
      schemaVersion,
      experimentId: args.experimentId,
      purpose: args.purpose,
      evidenceStatus: args.purpose === "formal"
        ? "formal-unlabelled"
        : "pilot-unlabelled",
      createdAt: args.createdAt,
      semanticMode: args.semanticMode,
      feedbackMode,
      candidateTieBreak,
      topK,
      queryCount: queries.length,
      implementation: {
        gitCommit,
        workingTreeDirty: implementationDirty,
        matchingFile: matchingPath,
        matchingSha256: sha256(matchingSource),
      },
      candidatePool: {
        fileName: path.basename(args.investorsCsvPath),
        fileSha256: sha256(investorsCsv),
        candidateCount: investors.length,
        candidatePoolSha256: candidatePoolHash(investorIds),
        inputOrderSha256: inputOrderHash(investorIds),
      },
    },
    queries,
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  console.log(`Wrote ${args.purpose} comparison to ${args.outputPath}`);
  console.log(
    `${queries.length} queries, ${investors.length} candidates, ${args.semanticMode}, ${candidateTieBreak} tie-break.`,
  );
  for (const query of queries) {
    console.log(`${query.queryId}: top-${topK} overlap ${query.topKOverlap}/${topK}`);
  }
}

main().catch((error: Error) => {
  console.error(`Normalisation comparison failed: ${error.message}`);
  process.exitCode = 1;
});
