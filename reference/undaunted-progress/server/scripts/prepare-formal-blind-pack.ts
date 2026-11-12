import { readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const inputPaths = [
  "exports/baseline-formal-query-01.local.json",
  "exports/baseline-formal-query-02.local.json",
  "exports/baseline-formal-query-03.local.json",
];

const finalCsvPath = "exports/blind-labelling-formal-v1.local.csv";
const finalManifestPath =
  "exports/blind-labelling-formal-v1-manifest.local.json";
const pendingCsvPath = "exports/blind-labelling-formal-v1.pending.local.csv";
const pendingManifestPath =
  "exports/blind-labelling-formal-v1-manifest.pending.local.json";

function packageManager(): "npm" | "pnpm" {
  return process.env.npm_config_user_agent?.startsWith("pnpm") ? "pnpm" : "npm";
}

function runScript(script: string, args: string[]) {
  const command = packageManager();
  console.log(`\n> ${command} run ${script}`);
  const result = spawnSync(command, ["run", script, "--", ...args], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) throw new Error(`${script} failed.`);
}

async function requirePrivateInputs() {
  const missing: string[] = [];
  for (const inputPath of inputPaths) {
    try {
      const details = await stat(inputPath);
      if (!details.isFile()) missing.push(inputPath);
    } catch {
      missing.push(inputPath);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `Missing private scored inputs:\n${missing.map((file) => `- ${file}`).join("\n")}`,
    );
  }
}

async function removePendingFiles() {
  await rm(pendingCsvPath, { force: true });
  await rm(pendingManifestPath, { force: true });
}

async function removeGeneratedFiles() {
  await removePendingFiles();
  await rm(finalCsvPath, { force: true });
  await rm(finalManifestPath, { force: true });
}

async function requireUnusedFormalVersion() {
  const existing: string[] = [];
  for (const outputPath of [finalCsvPath, finalManifestPath]) {
    try {
      await stat(outputPath);
      existing.push(outputPath);
    } catch {
      // A missing output is expected before the first formal-v1 run.
    }
  }
  if (existing.length > 0) {
    throw new Error(
      `Formal pack version already exists and will not be overwritten:\n${existing.map((file) => `- ${file}`).join("\n")}`,
    );
  }
}

async function promoteValidatedFiles() {
  const manifest = JSON.parse(await readFile(pendingManifestPath, "utf8"));
  manifest.fileName = path.basename(finalCsvPath);
  await writeFile(
    pendingManifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  await rename(pendingCsvPath, finalCsvPath);
  await rename(pendingManifestPath, finalManifestPath);
}

async function main() {
  await removePendingFiles();
  await requireUnusedFormalVersion();
  await requirePrivateInputs();
  const exportArgs: string[] = [];
  for (const inputPath of inputPaths) {
    exportArgs.push("--input", inputPath);
  }
  exportArgs.push(
    "--output",
    pendingCsvPath,
    "--manifest",
    pendingManifestPath,
    "--pack-version",
    "formal-v1",
    "--purpose",
    "formal",
    "--expected-query-count",
    "3",
    "--expected-rows-per-query",
    "10",
  );

  try {
    runScript("irp:export-blind-pack", exportArgs);
    runScript("irp:check-blind-pack", [
      "--input",
      pendingCsvPath,
      "--manifest",
      pendingManifestPath,
      "--expected-purpose",
      "formal",
      "--expected-query-count",
      "3",
      "--expected-rows-per-query",
      "10",
    ]);
    await promoteValidatedFiles();
    runScript("irp:check-blind-pack", [
      "--input",
      finalCsvPath,
      "--manifest",
      finalManifestPath,
      "--expected-purpose",
      "formal",
      "--expected-query-count",
      "3",
      "--expected-rows-per-query",
      "10",
    ]);
  } catch (error) {
    await removeGeneratedFiles();
    throw error;
  }

  console.log("\nFormal blind pack prepared and validated.");
  console.log(`CSV: ${finalCsvPath}`);
  console.log(`Manifest: ${finalManifestPath}`);
}

main().catch((error: Error) => {
  console.error(`Formal blind pack preparation failed: ${error.message}`);
  process.exit(1);
});
