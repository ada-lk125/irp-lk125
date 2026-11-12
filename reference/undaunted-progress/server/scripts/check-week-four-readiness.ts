import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const checks = [
  "irp:check-week-four-boundary",
  "irp:check-stage-instrument-normalisation",
  "irp:check-geography-normalisation",
  "irp:check-variant-comparison-inputs",
];

const requiredSourceFiles = [
  "server/services/matching.ts",
  "server/services/matching-config.ts",
  "server/services/matching-normalisation.ts",
  "server/services/variant-comparison.ts",
  "server/scripts/check-week-four-rule-boundary.ts",
  "server/scripts/check-stage-instrument-normalisation.ts",
  "server/scripts/check-geography-normalisation.ts",
  "server/scripts/check-variant-comparison-inputs.ts",
  "server/scripts/export-formal-variants.ts",
];

function packageManager(): "npm" | "pnpm" {
  return process.env.npm_config_user_agent?.startsWith("pnpm") ? "pnpm" : "npm";
}

function checkRequiredSourceFiles() {
  const missing = requiredSourceFiles.filter((file) => !existsSync(file));
  if (missing.length > 0) {
    throw new Error(`Missing Week 4 source files: ${missing.join(", ")}`);
  }
  console.log("Required Week 4 source files are present.");
}

function runCheck(script: string) {
  const command = packageManager();
  console.log(`\n> ${command} run ${script}`);
  const result = spawnSync(command, ["run", script], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    throw new Error(`${script} failed.`);
  }
}

function main() {
  checkRequiredSourceFiles();
  for (const check of checks) runCheck(check);
  console.log("\nWeek 4 readiness check passed.");
  console.log("Checked rule boundaries, normalisation paths, and variant export identity.");
}

main();
