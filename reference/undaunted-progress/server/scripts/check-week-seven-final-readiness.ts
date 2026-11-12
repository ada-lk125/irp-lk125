import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const requiredFiles = [
  "server/services/feedback-evaluation-visualisation.ts",
  "server/scripts/prepare-feedback-evaluation-visualisation.ts",
  "server/scripts/check-feedback-evaluation-visualisation.ts",
  "server/services/final-matcher-handoff.ts",
  "server/scripts/prepare-final-matcher-handoff.ts",
  "server/scripts/check-final-matcher-handoff.ts",
  "server/services/final-matcher-runtime.ts",
  "server/scripts/check-final-matcher-runtime.ts",
  "server/services/final-matcher-route-result.ts",
  "server/scripts/check-final-matcher-route-result.ts",
  "server/services/final-matcher-route-execution.ts",
  "server/scripts/check-final-matcher-route-execution.ts",
  "server/services/final-matcher-route-lifecycle.ts",
  "server/scripts/check-final-matcher-route-lifecycle.ts",
  "server/services/final-ranking-movement.ts",
  "server/scripts/prepare-final-ranking-movement.ts",
  "server/scripts/check-final-ranking-movement.ts",
  "server/services/final-evidence-page.ts",
  "server/scripts/prepare-final-evidence-page.ts",
  "server/scripts/check-final-evidence-page.ts",
  "server/services/final-delivery-report.ts",
  "server/scripts/prepare-final-delivery-report.ts",
  "server/scripts/check-final-delivery-report.ts",
  "server/scripts/check-week-seven-final-readiness.ts",
];

function runTypeScriptCheck(scriptPath: string, label: string) {
  console.log(`\n> ${scriptPath}\n`);
  const result = spawnSync(
    process.execPath,
    [...process.execArgv, path.resolve(process.cwd(), scriptPath)],
    {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    },
  );
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
  const missingFiles = requiredFiles.filter(file => !existsSync(file));
  if (missingFiles.length > 0) {
    throw new Error(
      `Missing Week 7 final evaluation files:\n${missingFiles.join("\n")}`,
    );
  }
  console.log("Required Week 7 final evaluation source files are present.");

  runTypeScriptCheck(
    "server/scripts/check-week-six-feedback-readiness.ts",
    "Week 6 feedback readiness",
  );
  runTypeScriptCheck(
    "server/scripts/check-feedback-evaluation-visualisation.ts",
    "Feedback evaluation visualisation",
  );
  runTypeScriptCheck(
    "server/scripts/check-final-matcher-handoff.ts",
    "Final matcher handoff",
  );
  runTypeScriptCheck(
    "server/scripts/check-final-matcher-runtime.ts",
    "Final matcher runtime",
  );
  runTypeScriptCheck(
    "server/scripts/check-final-matcher-route-result.ts",
    "Final matcher route result",
  );
  runTypeScriptCheck(
    "server/scripts/check-final-matcher-route-execution.ts",
    "Final matcher route execution",
  );
  runTypeScriptCheck(
    "server/scripts/check-final-matcher-route-lifecycle.ts",
    "Final matcher route lifecycle",
  );
  runTypeScriptCheck(
    "server/scripts/check-final-ranking-movement.ts",
    "Final ranking movement",
  );
  runTypeScriptCheck(
    "server/scripts/check-final-evidence-page.ts",
    "Final evidence page",
  );
  runTypeScriptCheck(
    "server/scripts/check-final-delivery-report.ts",
    "Final delivery report",
  );

  console.log("\nWeek 7 final evaluation readiness check passed.");
  console.log(
    "The producer workflow, frozen-metric receiver, handoff gate, guarded route lifecycle and final delivery report are ready.",
  );
}

try {
  main();
} catch (error) {
  console.error(
    `Week 7 final evaluation readiness check failed: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exitCode = 1;
}
