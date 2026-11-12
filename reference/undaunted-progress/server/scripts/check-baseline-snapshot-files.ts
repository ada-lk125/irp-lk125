import fs from "node:fs";

const requiredFiles = [
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "docs/irp/samples/baseline-export-input.sample.json",
  "docs/irp/samples/baseline-export-output.sample.json",
  "docs/irp/fixtures/baseline-investors.sample.json",
  "shared/sector-taxonomy.ts",
  "server/scripts/export-baseline-matches.ts",
  "server/scripts/check-baseline-export-shape.ts",
  "server/scripts/check-baseline-live-env.ts",
  "server/scripts/check-baseline-output-paths.ts",
  "server/scripts/check-baseline-snapshot-files.ts",
  "server/scripts/check-week-two-baseline-readiness.ts",
  "server/services/airtable.ts",
  "server/services/baseline-export.ts",
  "server/services/matching.ts",
  "server/services/matching-config.ts",
];

function main() {
  const missing = requiredFiles.filter(file => !fs.existsSync(file));

  if (missing.length > 0) {
    console.error("Baseline snapshot file check failed.");
    console.error("Missing files:");
    for (const file of missing) {
      console.error(`- ${file}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("Baseline snapshot file check passed.");
  console.log(`Checked files: ${requiredFiles.length}`);
}

main();
