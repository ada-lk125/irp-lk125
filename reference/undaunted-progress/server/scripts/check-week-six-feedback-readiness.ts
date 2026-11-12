import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const requiredFiles = [
  "server/services/feedback-experiment.ts",
  "server/services/feedback-selection.ts",
  "server/services/feedback-selection-source.ts",
  "server/services/feedback-context.ts",
  "server/services/feedback-comparison-runner.ts",
  "server/services/feedback-comparison-export.ts",
  "server/services/feedback-comparison-batch.ts",
  "server/services/feedback-comparison-batch-manifest.ts",
  "server/services/feedback-ablation-intake.ts",
  "server/services/feedback-evaluation-receipt.ts",
  "server/services/feedback-evaluation-decision.ts",
  "server/services/feedback-evaluation-files.ts",
  "server/scripts/check-feedback-experiment-boundary.ts",
  "server/scripts/check-feedback-selection.ts",
  "server/scripts/check-feedback-selection-source.ts",
  "server/scripts/export-feedback-selection-source.ts",
  "server/scripts/export-feedback-comparison-batch.ts",
  "server/scripts/check-feedback-context.ts",
  "server/scripts/check-feedback-comparison-runner.ts",
  "server/scripts/check-feedback-comparison-export.ts",
  "server/scripts/check-feedback-comparison-batch.ts",
  "server/scripts/check-feedback-comparison-batch-manifest.ts",
  "server/scripts/check-feedback-ablation-intake.ts",
  "server/scripts/prepare-feedback-ablation-intake.ts",
  "server/scripts/check-feedback-evaluation-receipt.ts",
  "server/scripts/check-feedback-evaluation-decision.ts",
  "server/scripts/prepare-feedback-evaluation-decision.ts",
];

function runCommand(command: string, args: string[], label: string) {
  console.log(`\n> ${command} ${args.join(" ")}\n`);
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) {
    throw new Error(`${label} could not start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(
      `${label} failed with exit code ${result.status ?? "unknown"}.`,
    );
  }
}

function runTypeScriptCheck(scriptPath: string, label: string) {
  runCommand(
    process.execPath,
    [...process.execArgv, path.resolve(process.cwd(), scriptPath)],
    label,
  );
}

function main() {
  const missingFiles = requiredFiles.filter((file) => !existsSync(file));
  if (missingFiles.length > 0) {
    throw new Error(
      `Missing Week 6 feedback files:\n${missingFiles.join("\n")}`,
    );
  }
  console.log("Required Week 6 feedback source files are present.");

  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  runCommand(
    npmCommand,
    ["run", "irp:check-week-five-semantic-readiness"],
    "Week 5 semantic readiness",
  );
  runTypeScriptCheck(
    "server/scripts/check-feedback-experiment-boundary.ts",
    "Feedback experiment boundary",
  );
  runTypeScriptCheck(
    "server/scripts/check-feedback-selection.ts",
    "Curated feedback selection",
  );
  runTypeScriptCheck(
    "server/scripts/check-feedback-selection-source.ts",
    "Read-only feedback selection source",
  );
  runTypeScriptCheck(
    "server/scripts/check-feedback-context.ts",
    "Curated feedback context",
  );
  runTypeScriptCheck(
    "server/scripts/check-feedback-comparison-runner.ts",
    "Controlled feedback comparison runner",
  );
  runTypeScriptCheck(
    "server/scripts/check-feedback-comparison-export.ts",
    "Protected feedback comparison export",
  );
  runTypeScriptCheck(
    "server/scripts/check-feedback-comparison-batch.ts",
    "Three-query feedback comparison batch",
  );
  runTypeScriptCheck(
    "server/scripts/check-feedback-comparison-batch-manifest.ts",
    "Three-query feedback comparison manifest",
  );
  runTypeScriptCheck(
    "server/scripts/check-feedback-ablation-intake.ts",
    "Feedback ablation intake contract",
  );
  runTypeScriptCheck(
    "server/scripts/check-feedback-evaluation-receipt.ts",
    "Frozen metric receipt",
  );
  runTypeScriptCheck(
    "server/scripts/check-feedback-evaluation-decision.ts",
    "Feedback evaluation decision",
  );

  console.log("\nWeek 6 feedback readiness check passed.");
  console.log(
    "Checked the curated input, three-query run, pre-metric intake, and downstream frozen-metric handoff.",
  );
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Week 6 feedback readiness check failed: ${message}`);
  process.exitCode = 1;
}
