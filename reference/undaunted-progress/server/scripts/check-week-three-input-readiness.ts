import { spawnSync } from "node:child_process";

const checks = [
  "irp:check-week-two-readiness",
  "irp:check-blind-contract",
  "irp:check-sample-query-set",
  "irp:check-local-blind-projection",
  "irp:export-local-blind-sample",
  "irp:check-local-blind-sample",
  "irp:check-formal-query-inputs",
  "irp:check-shared-investor-csv",
  "irp:check-frozen-label-rules",
  "irp:check-supplementary-rules",
  "irp:check-frozen-workflow",
];

function packageManager(): "npm" | "pnpm" {
  return process.env.npm_config_user_agent?.startsWith("pnpm") ? "pnpm" : "npm";
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
  for (const check of checks) runCheck(check);
  console.log("\nWeek 3 input readiness check passed.");
}

main();
