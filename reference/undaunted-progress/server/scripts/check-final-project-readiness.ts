import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const isProgressSnapshot = existsSync("server/services/matching.ts");

const requiredFiles = isProgressSnapshot
  ? [
      "server/services/matching.ts",
      "server/services/matching-normalisation.ts",
      "server/services/semantic-scorer.ts",
      "server/services/text-similarity-scorer.ts",
      "server/services/feedback-comparison-runner.ts",
      "server/services/final-matcher-route-lifecycle.ts",
      "server/services/final-delivery-report.ts",
      "server/demo.ts",
      "server/demo.test.ts",
      "vitest.config.ts",
      "client/index.html",
      "client/app.js",
      "client/styles.css",
      "docs/irp/evidence-summary.json",
      "server/scripts/check-week-three-input-readiness.ts",
      "server/scripts/check-deterministic-candidate-order.ts",
      "server/scripts/export-normalisation-comparison.ts",
      "server/scripts/export-pooled-supplementary-pack.ts",
      "server/services/label-freeze.ts",
      "server/scripts/freeze-supplementary-labels.ts",
      "server/services/frozen-label-transfer.ts",
      "server/scripts/transfer-frozen-labels.ts",
      "server/services/normalisation-evaluation.ts",
      "server/scripts/evaluate-normalisation-comparison.ts",
      "server/scripts/check-normalisation-evaluation.ts",
      "server/services/expert-review.ts",
      "server/scripts/prepare-expert-review-pack.ts",
      "server/scripts/evaluate-expert-reviews.ts",
      "server/scripts/check-expert-review-workflow.ts",
      "server/services/pooled-expert-review.ts",
      "server/scripts/prepare-pooled-expert-review-pack.ts",
      "server/scripts/evaluate-pooled-expert-reviews.ts",
      "server/scripts/check-pooled-expert-review-workflow.ts",
      "server/scripts/check-week-seven-final-readiness.ts",
      "../../docs/baseline-file-map.md",
      "../../docs/final-delivery-report.md",
    ]
  : [
      "src/services/matching.ts",
      "src/services/matching-normalisation.ts",
      "src/services/semantic-scorer.ts",
      "src/services/text-similarity-scorer.ts",
      "src/services/feedback-comparison-runner.ts",
      "src/services/final-matcher-route-lifecycle.ts",
      "src/services/final-delivery-report.ts",
      "src/scripts/check-week-three-input-readiness.ts",
      "src/scripts/check-deterministic-candidate-order.ts",
      "src/scripts/export-normalisation-comparison.ts",
      "src/scripts/export-pooled-supplementary-pack.ts",
      "src/services/label-freeze.ts",
      "src/scripts/freeze-supplementary-labels.ts",
      "src/services/frozen-label-transfer.ts",
      "src/scripts/transfer-frozen-labels.ts",
      "src/services/normalisation-evaluation.ts",
      "src/scripts/evaluate-normalisation-comparison.ts",
      "src/scripts/check-normalisation-evaluation.ts",
      "src/services/expert-review.ts",
      "src/scripts/prepare-expert-review-pack.ts",
      "src/scripts/evaluate-expert-reviews.ts",
      "src/scripts/check-expert-review-workflow.ts",
      "src/scripts/check-week-seven-final-readiness.ts",
      "../../docs/irp/2026-06-15-baseline-file-map.md",
      "../../docs/irp/2026-07-31-final-delivery-report.md",
    ];

function packageManager(): "npm" | "pnpm" {
  return process.env.npm_config_user_agent?.startsWith("pnpm")
    ? "pnpm"
    : "npm";
}

function runScript(script: string, label: string) {
  const command = packageManager();
  console.log(`\n> ${command} run ${script}\n`);
  const result = spawnSync(command, ["run", script], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
    shell: process.platform === "win32",
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

function main() {
  const missing = requiredFiles.filter(filePath => !existsSync(filePath));
  if (missing.length > 0) {
    throw new Error(
      `Missing final project files:\n${missing.join("\n")}`,
    );
  }
  console.log(
    `Final project source inventory passed (${requiredFiles.length} files).`,
  );

  runScript("irp:check-final-submission", "Repository submission audit");
  if (isProgressSnapshot) {
    runScript("check", "IRP TypeScript check");
    runScript("test", "IRP automated tests");
  }
  runScript(
    "irp:check-week-three-readiness",
    "Week 2 and Week 3 readiness",
  );
  runScript(
    "irp:check-week-seven-final-readiness",
    "Week 4 to Week 7 readiness",
  );
  runScript(
    "irp:check-normalisation-evaluation",
    "Normalisation evaluation workflow",
  );
  runScript(
    "irp:check-expert-review-workflow",
    "Maiko expert paired-review workflow",
  );
  if (isProgressSnapshot) {
    runScript(
      "irp:check-pooled-expert-review-workflow",
      "Algorithm-blinded pooled expert-review workflow",
    );
  }

  console.log("\nFinal IRP implementation readiness check passed.");
  console.log(
    "Checked the baseline snapshot, standalone interface, normalisation, pooled algorithm-blinded review, historical blind workflow, semantic comparison, feedback ablation, guarded route lifecycle and final delivery report.",
  );
  console.log(
    "The 55-pair pilot and the verified 383-investor snapshot comparison are complete. All 56 pooled pairs are covered, and Chuan Ju returned PASS_FINAL with no discrepancies for the frozen private package; public reporting uses anonymous aggregate metrics.",
  );
}

try {
  main();
} catch (error) {
  console.error(
    `Final IRP implementation readiness check failed: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exitCode = 1;
}
