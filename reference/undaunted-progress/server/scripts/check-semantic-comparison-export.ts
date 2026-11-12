import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Investor } from "../services/airtable";
import type { MatchResult } from "../services/matching";
import {
  buildSemanticComparisonIdentity,
} from "../services/semantic-comparison";
import {
  assertSemanticComparisonOutputAvailable,
  buildSemanticComparisonExport,
  validateSemanticComparisonExport,
} from "../services/semantic-comparison-export";
import type { SemanticComparisonRun } from "../services/semantic-comparison-runner";
import { semanticExperimentContract } from "../services/semantic-experiment";
import { buildSemanticSignalAudit } from "../services/semantic-signal-audit";

const investors: Investor[] = Array.from({ length: 12 }, (_, index) => ({
  id: `investor-${String(index + 1).padStart(2, "0")}`,
  organisation: `Investor ${index + 1}`,
}));

function matches(semanticScore: number): MatchResult[] {
  return investors.slice(0, semanticExperimentContract.topK).map(investor => ({
    investor,
    scoreBreakdown: {
      stageMatch: 80,
      ticketSizeMatch: 70,
      sectorOverlap: 90,
      geographyMatch: 100,
      instrumentMatch: 100,
      semanticScore,
      totalScore: 85,
    },
    matchReasons: ["Offline comparison check"],
  }));
}

function sampleComparison(): SemanticComparisonRun {
  return {
    identity: buildSemanticComparisonIdentity({
      queryId: "query-export-check",
      startupId: "startup-export-check",
      fundingRoundId: "round-export-check",
      investorIds: investors.map(({ id }) => id),
    }),
    signalAudit: buildSemanticSignalAudit({
      startup: { id: "startup-export-check", description: "Offline startup" },
      fundingRound: { id: "round-export-check", roundSectors: ["Energy"] },
      investors,
      config: { contextCharLimit: 2500 },
    }),
    methodRuns: [
      { method: "rule-only", matches: matches(0) },
      { method: "gpt-semantic", matches: matches(80) },
      { method: "text-similarity", matches: matches(40) },
    ],
  };
}

async function checkOutputGuard() {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "semantic-comparison-"));
  try {
    const output = await assertSemanticComparisonOutputAvailable(
      "exports/check.local.json",
      temporaryRoot,
    );
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, "{}\n", "utf8");
    await assert.rejects(
      () =>
        assertSemanticComparisonOutputAvailable(
          "exports/check.local.json",
          temporaryRoot,
        ),
      /will not be overwritten/,
    );
    await assert.rejects(
      () => assertSemanticComparisonOutputAvailable("outside.local.json", temporaryRoot),
      /inside exports/,
    );
    await assert.rejects(
      () => assertSemanticComparisonOutputAvailable("exports/check.json", temporaryRoot),
      /end with .local.json/,
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

async function main() {
  const output = buildSemanticComparisonExport({
    comparison: sampleComparison(),
    runId: "semantic-comparison-export-check",
    source: "offline-fixture.json",
    createdAt: "2026-07-16T00:00:00.000Z",
  });
  const summary = validateSemanticComparisonExport(output);
  assert.equal(summary.queryId, "query-export-check");
  assert.equal(summary.startupId, "startup-export-check");
  assert.equal(summary.fundingRoundId, "round-export-check");
  assert.equal(summary.candidateCount, investors.length);
  assert.deepEqual(summary.methodMatchCounts, {
    "rule-only": 10,
    "gpt-semantic": 10,
    "text-similarity": 10,
  });
  assert.equal(output.signalAudit.investors.candidateCount, investors.length);
  assert.equal(summary.signalAudit.investors.candidateCount, investors.length);

  const incomplete = structuredClone(output) as unknown as {
    methods: Array<{ method: string; matches: unknown[] }>;
  };
  incomplete.methods[2].matches.pop();
  assert.throws(
    () => validateSemanticComparisonExport(incomplete),
    /must contain 10 matches/,
  );
  const duplicateMethod = structuredClone(output) as unknown as {
    methods: Array<{ method: string; matches: unknown[] }>;
  };
  duplicateMethod.methods[2].method = "gpt-semantic";
  assert.throws(
    () => validateSemanticComparisonExport(duplicateMethod),
    /must be rule-only, gpt-semantic, text-similarity/,
  );
  const mismatchedAudit = structuredClone(output);
  mismatchedAudit.signalAudit.investors.candidateCount = investors.length + 1;
  assert.throws(
    () => validateSemanticComparisonExport(mismatchedAudit),
    /signal audit candidate count must match/,
  );

  await checkOutputGuard();
  console.log("Semantic comparison export check passed.");
  console.log("Checked method completeness, top-ten rows, local paths, and overwrite refusal.");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
