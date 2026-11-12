import assert from "node:assert/strict";
import {
  normaliseFundingStage,
  normaliseFundingStages,
  normaliseInvestmentInstrument,
  normaliseInvestmentInstruments,
} from "../services/matching-normalisation";
import { getDefaultMatchingConfig } from "../services/matching-config";
import { runMatching } from "../services/matching";
import type { AirtableFundingRound, AirtableStartup, Investor } from "../services/airtable";

assert.equal(normaliseFundingStage(" Pre_Seed "), "Pre-seed");
assert.equal(normaliseFundingStage("series-c"), "Post-Series B");
assert.equal(normaliseFundingStage("Series C+"), "Post-Series B");
assert.equal(normaliseFundingStage("all stages"), "All");
assert.equal(normaliseFundingStage("Bridge"), "Bridge");
assert.equal(normaliseFundingStage("  "), undefined);

assert.deepEqual(
  normaliseFundingStages(["Pre Seed", "pre-seed", "Series A", "series_a"]),
  ["Pre-seed", "Series A"],
);

assert.equal(normaliseInvestmentInstrument("Equity (VC)"), "Equity");
assert.equal(normaliseInvestmentInstrument("convertible"), "Convertible Note");
assert.equal(normaliseInvestmentInstrument("SAFE note"), "SAFE");
assert.equal(normaliseInvestmentInstrument("revenue_based_finance"), "Revenue-Based Financing");
assert.equal(normaliseInvestmentInstrument("Other"), "Other");

assert.deepEqual(
  normaliseInvestmentInstruments([
    "Equity (Angel)",
    "venture capital",
    "Convertible Loan",
    "convertible-note",
    "Grant Funding",
  ]),
  ["Equity", "Convertible Note", "Grant"],
);

async function checkScoringPath() {
  const startup: AirtableStartup = { id: "startup-check", name: "Normalisation check" };
  const canonicalRound: AirtableFundingRound = {
    id: "round-canonical",
    roundStage: "Seed",
    investmentTypes: ["Convertible Note"],
  };
  const aliasRound: AirtableFundingRound = {
    id: "round-alias",
    roundStage: " seed ",
    investmentTypes: ["convertible"],
  };
  const canonicalInvestor: Investor = {
    id: "investor-canonical",
    investmentStage: ["Pre-seed"],
    investmentInstruments: ["Convertible Note"],
  };
  const aliasInvestor: Investor = {
    id: "investor-alias",
    investmentStage: ["pre_seed"],
    investmentInstruments: ["convertible loan"],
  };

  const config = { ...getDefaultMatchingConfig(), aiCandidateCount: 0 };
  const [canonicalResult] = await runMatching(canonicalRound, startup, [canonicalInvestor], undefined, undefined, config);
  const [aliasResult] = await runMatching(aliasRound, startup, [aliasInvestor], undefined, undefined, config);

  assert.equal(canonicalResult.scoreBreakdown.stageMatch, 100);
  assert.equal(canonicalResult.scoreBreakdown.instrumentMatch, 100);
  assert.equal(aliasResult.scoreBreakdown.stageMatch, canonicalResult.scoreBreakdown.stageMatch);
  assert.equal(aliasResult.scoreBreakdown.instrumentMatch, canonicalResult.scoreBreakdown.instrumentMatch);
  assert.equal(aliasResult.scoreBreakdown.totalScore, canonicalResult.scoreBreakdown.totalScore);
  assert.deepEqual(aliasResult.matchReasons, canonicalResult.matchReasons);

  const legacyConfig = {
    ...config,
    normalisationProfile: "legacy" as const,
  };
  const [legacyAliasResult] = await runMatching(
    aliasRound,
    startup,
    [aliasInvestor],
    undefined,
    undefined,
    legacyConfig,
  );
  assert.notEqual(
    legacyAliasResult.scoreBreakdown.instrumentMatch,
    aliasResult.scoreBreakdown.instrumentMatch,
  );

  const unknownInstrumentRound = { ...canonicalRound, investmentTypes: ["Other"] };
  const unknownInstrumentInvestor = { ...canonicalInvestor, investmentInstruments: ["other"] };
  const [unknownInstrumentResult] = await runMatching(
    unknownInstrumentRound,
    startup,
    [unknownInstrumentInvestor],
    undefined,
    undefined,
    config,
  );
  assert.equal(unknownInstrumentResult.scoreBreakdown.instrumentMatch, 100);

  console.log("Stage and instrument normalisation checks passed.");
  console.log("Canonical and alias inputs produce the same rule scores.");
  console.log("Legacy and normalisation-v1 profiles are distinguishable.");
}

checkScoringPath().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
