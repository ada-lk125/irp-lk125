import { access, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const inputPaths = [
  "exports/formal-query-input-01.local.json",
  "exports/formal-query-input-02.local.json",
  "exports/formal-query-input-03.local.json",
];
const outputPaths = [
  "exports/baseline-formal-query-01.local.json",
  "exports/baseline-formal-query-02.local.json",
  "exports/baseline-formal-query-03.local.json",
];

type InvestorSource =
  | { flag: "--investors"; path: string }
  | { flag: "--investors-csv"; path: string }
  | undefined;

function getArgValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} needs a value.`);
  return value;
}

function parseInvestorSource(args: string[]): InvestorSource {
  const investors = getArgValue(args, "--investors");
  const investorsCsv = getArgValue(args, "--investors-csv");
  if (investors && investorsCsv) {
    throw new Error("Use either --investors or --investors-csv, not both.");
  }
  if (investors) return { flag: "--investors", path: investors };
  if (investorsCsv) return { flag: "--investors-csv", path: investorsCsv };
  return undefined;
}

function packageManager(): "npm" | "pnpm" {
  return process.env.npm_config_user_agent?.startsWith("pnpm") ? "pnpm" : "npm";
}

async function requireFiles(filePaths: string[], label: string) {
  const missing: string[] = [];
  for (const filePath of filePaths) {
    try {
      await access(filePath);
    } catch {
      missing.push(filePath);
    }
  }
  if (missing.length > 0) {
    throw new Error(`${label}:\n${missing.map((filePath) => `- ${filePath}`).join("\n")}`);
  }
}

async function requireUnusedOutputs() {
  const existing: string[] = [];
  for (const outputPath of outputPaths) {
    try {
      await access(outputPath);
      existing.push(outputPath);
    } catch {
      // Expected before the first formal baseline run.
    }
  }
  if (existing.length > 0) {
    throw new Error(
      `Formal baseline outputs already exist and will not be overwritten:\n${existing
        .map((filePath) => `- ${filePath}`)
        .join("\n")}`,
    );
  }
}

function exportBaseline(
  inputPath: string,
  outputPath: string,
  index: number,
  investorSource: InvestorSource,
) {
  const command = packageManager();
  const sourceArgs = investorSource
    ? [investorSource.flag, investorSource.path]
    : [];
  const result = spawnSync(
    command,
    [
      "run",
      "irp:export-baseline",
      "--",
      "--input",
      inputPath,
      "--output",
      outputPath,
      "--run-id",
      `baseline-legacy-query-${String(index + 1).padStart(2, "0")}`,
      "--normalisation-profile",
      "legacy",
      ...sourceArgs,
    ],
    { stdio: "inherit", shell: process.platform === "win32" },
  );
  if (result.status !== 0) {
    throw new Error(`Baseline export failed for ${inputPath}.`);
  }
}

async function main() {
  const investorSource = parseInvestorSource(process.argv.slice(2));
  await requireFiles(inputPaths, "Missing private formal query inputs");
  await requireUnusedOutputs();

  try {
    for (let index = 0; index < inputPaths.length; index += 1) {
      exportBaseline(inputPaths[index], outputPaths[index], index, investorSource);
    }
  } catch (error) {
    await Promise.all(outputPaths.map((outputPath) => rm(outputPath, { force: true })));
    throw error;
  }

  console.log("Prepared three real formal baseline exports.");
  outputPaths.forEach((outputPath) => console.log(`- ${outputPath}`));
}

main().catch((error: Error) => {
  console.error(`Formal baseline export failed: ${error.message}`);
  process.exit(1);
});
