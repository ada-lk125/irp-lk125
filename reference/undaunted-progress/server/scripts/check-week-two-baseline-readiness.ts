import { spawnSync } from "node:child_process";

const checks = [
  "irp:check-snapshot-files",
  "irp:check-live-paths",
  "irp:export-local-fixture",
  "irp:check-local-fixture",
];

function runCheck(script: string) {
  console.log(`\n> npm run ${script}`);
  const result = spawnSync("npm", ["run", script], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    throw new Error(`${script} failed.`);
  }
}

function main() {
  for (const check of checks) {
    runCheck(check);
  }

  console.log("\nWeek 2 baseline readiness check passed.");
}

main();
