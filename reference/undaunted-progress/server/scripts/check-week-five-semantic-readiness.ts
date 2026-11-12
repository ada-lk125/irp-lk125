import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const checks = [
  "irp:check-week-four-readiness",
  "irp:check-semantic-context",
  "irp:check-semantic-signal-audit",
  "irp:check-semantic-experiment-boundary",
  "irp:check-semantic-scoring-mode",
  "irp:check-gpt-semantic-scorer",
  "irp:check-text-similarity-foundation",
  "irp:check-text-similarity-boundaries",
  "irp:check-deterministic-candidate-order",
  "irp:check-semantic-comparison-identity",
  "irp:check-semantic-comparison-runner",
  "irp:check-semantic-comparison-export",
  "irp:check-semantic-comparison-review",
];

const requiredSourceFiles = [
  "server/services/matching.ts",
  "server/services/matching-config.ts",
  "server/services/semantic-context.ts",
  "server/services/semantic-signal-audit.ts",
  "server/services/semantic-experiment.ts",
  "server/services/semantic-scorer.ts",
  "server/services/text-similarity-scorer.ts",
  "server/services/semantic-comparison.ts",
  "server/services/semantic-comparison-runner.ts",
  "server/services/semantic-comparison-export.ts",
  "server/services/semantic-comparison-review.ts",
  "server/scripts/check-semantic-context.ts",
  "server/scripts/check-semantic-signal-audit.ts",
  "server/scripts/check-semantic-experiment-boundary.ts",
  "server/scripts/check-semantic-scoring-mode.ts",
  "server/scripts/check-gpt-semantic-scorer.ts",
  "server/scripts/check-text-similarity-foundation.ts",
  "server/scripts/check-text-similarity-boundaries.ts",
  "server/scripts/check-deterministic-candidate-order.ts",
  "server/scripts/check-semantic-comparison-identity.ts",
  "server/scripts/check-semantic-comparison-runner.ts",
  "server/scripts/check-semantic-comparison-export.ts",
  "server/scripts/check-semantic-comparison-review.ts",
  "server/scripts/export-semantic-comparison.ts",
  "server/scripts/review-semantic-comparisons.ts",
];

function packageManager(): "npm" | "pnpm" {
  return process.env.npm_config_user_agent?.startsWith("pnpm") ? "pnpm" : "npm";
}

function checkRequiredSourceFiles() {
  const missing = requiredSourceFiles.filter(file => !existsSync(file));
  if (missing.length > 0) {
    throw new Error(`Missing Week 5 semantic source files: ${missing.join(", ")}`);
  }
  console.log("Required Week 5 semantic source files are present.");
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
  console.log("\nWeek 5 semantic readiness check passed.");
  console.log("Checked all three methods, text coverage, ranking differences, and private output guards.");
}

main();
