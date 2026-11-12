import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  checkVariantComparisonReadiness,
  type VariantComparisonReadiness,
} from "../services/variant-comparison";

function getArgValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} needs a value.`);
  return value;
}

function parseTopK(value: string | undefined): number {
  if (!value) return 10;
  const topK = Number(value);
  if (!Number.isInteger(topK) || topK <= 0) {
    throw new Error("--top-k must be a positive integer.");
  }
  return topK;
}

function sampleExport(investorIds: string[]) {
  return {
    run: {
      schemaVersion: "baseline-export-v2",
      runId: "sample-run",
    },
    input: {
      queryId: "query-sample",
      fundingRound: {
        id: "round-sample",
        startupId: "startup-sample",
      },
      startup: {
        id: "startup-sample",
      },
    },
    matches: investorIds.map((id, index) => ({
      rank: index + 1,
      investor: { id },
    })),
  };
}

function assertSelfCheck() {
  const readiness = checkVariantComparisonReadiness(
    sampleExport(["investor-a", "investor-b", "investor-c"]),
    sampleExport(["investor-b", "investor-c", "investor-d"]),
    { topK: 3, requireFullTopK: true },
  );

  assert.equal(readiness.ok, true);
  assert.equal(readiness.sharedTopKCount, 2);
  assert.equal(readiness.baselineOnlyTopKCount, 1);
  assert.equal(readiness.variantOnlyTopKCount, 1);

  const mismatch = checkVariantComparisonReadiness(
    sampleExport(["investor-a", "investor-b", "investor-c"]),
    {
      ...sampleExport(["investor-a", "investor-b", "investor-c"]),
      input: {
        ...sampleExport(["investor-a"]).input,
        queryId: "different-query",
      },
    },
    { topK: 3 },
  );
  assert.equal(mismatch.ok, false);
  assert.match(mismatch.errors.join(" "), /queryId/);

  assert.throws(
    () =>
      checkVariantComparisonReadiness(
        sampleExport(["investor-a", "investor-a"]),
        sampleExport(["investor-a", "investor-b"]),
      ),
    /duplicate investor ids/,
  );
}

function printSummary(readiness: VariantComparisonReadiness) {
  console.log("Variant comparison input check:");
  console.log(`- queryId match: ${readiness.baseline.queryId === readiness.variant.queryId}`);
  console.log(`- startup id match: ${readiness.baseline.startupId === readiness.variant.startupId}`);
  console.log(`- funding round id match: ${readiness.baseline.fundingRoundId === readiness.variant.fundingRoundId}`);
  console.log(`- baseline matches: ${readiness.baseline.matchCount}`);
  console.log(`- variant matches: ${readiness.variant.matchCount}`);
  console.log(`- shared top-${readiness.topK} pairs: ${readiness.sharedTopKCount}`);
  console.log(`- baseline-only top-${readiness.topK} pairs: ${readiness.baselineOnlyTopKCount}`);
  console.log(`- variant-only top-${readiness.topK} pairs: ${readiness.variantOnlyTopKCount}`);
}

async function main() {
  const args = process.argv.slice(2);
  const baselinePath = getArgValue(args, "--baseline");
  const variantPath = getArgValue(args, "--variant");
  const topK = parseTopK(getArgValue(args, "--top-k"));
  const requireFullTopK = args.includes("--require-full-top-k");

  if (!baselinePath && !variantPath) {
    assertSelfCheck();
    console.log("Variant comparison input self-check passed.");
    return;
  }
  if (!baselinePath || !variantPath) {
    throw new Error("Provide both --baseline and --variant, or neither for the self-check.");
  }

  const [baselineExport, variantExport] = await Promise.all([
    readFile(baselinePath, "utf8").then((value) => JSON.parse(value) as unknown),
    readFile(variantPath, "utf8").then((value) => JSON.parse(value) as unknown),
  ]);
  const readiness = checkVariantComparisonReadiness(
    baselineExport,
    variantExport,
    { topK, requireFullTopK },
  );
  printSummary(readiness);

  if (!readiness.ok) {
    for (const error of readiness.errors) console.error(`- ${error}`);
    process.exitCode = 1;
  }
}

main().catch((error: Error) => {
  console.error(`Variant comparison input check failed: ${error.message}`);
  process.exit(1);
});
