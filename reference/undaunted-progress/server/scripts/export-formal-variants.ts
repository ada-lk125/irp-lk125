import { spawnSync } from "node:child_process";
import { access, rm } from "node:fs/promises";

const inputPaths = [
  "exports/formal-query-input-01.local.json",
  "exports/formal-query-input-02.local.json",
  "exports/formal-query-input-03.local.json",
];
const outputPaths = [
  "exports/variant-query-01.local.json",
  "exports/variant-query-02.local.json",
  "exports/variant-query-03.local.json",
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
      // Expected before the first formal variant run.
    }
  }
  if (existing.length > 0) {
    throw new Error(
      `Formal variant outputs already exist and will not be overwritten:\n${existing
        .map((filePath) => `- ${filePath}`)
        .join("\n")}`,
    );
  }
}

function exportVariant(
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
      `normalisation-v1-query-${String(index + 1).padStart(2, "0")}`,
      "--normalisation-profile",
      "normalisation-v1",
      ...sourceArgs,
    ],
    { stdio: "inherit", shell: process.platform === "win32" },
  );
  if (result.status !== 0) {
    throw new Error(`Variant export failed for ${inputPath}.`);
  }
}

async function main() {
  const investorSource = parseInvestorSource(process.argv.slice(2));
  await requireFiles(inputPaths, "Missing private formal query inputs");
  await requireUnusedOutputs();

  try {
    for (let index = 0; index < inputPaths.length; index += 1) {
      exportVariant(inputPaths[index], outputPaths[index], index, investorSource);
    }
  } catch (error) {
    await Promise.all(outputPaths.map((outputPath) => rm(outputPath, { force: true })));
    throw error;
  }

  console.log("Prepared three formal normalisation-v1 variant exports.");
  outputPaths.forEach((outputPath) => console.log(`- ${outputPath}`));
}

main().catch((error: Error) => {
  console.error(`Formal variant export failed: ${error.message}`);
  process.exit(1);
});
