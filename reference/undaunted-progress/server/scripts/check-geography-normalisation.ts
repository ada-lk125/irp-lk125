import assert from "node:assert/strict";
import { getDefaultMatchingConfig } from "../services/matching-config";
import { runMatching } from "../services/matching";
import type { AirtableFundingRound, AirtableStartup, Investor } from "../services/airtable";
import {
  normaliseGeographies,
  normaliseGeography,
} from "../services/matching-normalisation";

assert.equal(normaliseGeography(" UK "), "United Kingdom");
assert.equal(normaliseGeography("Europe excl UK"), "Europe (excl. UK)");
assert.equal(normaliseGeography("United States"), "North America");
assert.equal(normaliseGeography("international"), "Global");
assert.equal(normaliseGeography("Worldwide"), "Worldwide");
assert.equal(normaliseGeography("Latin America"), "Latin America");
assert.equal(normaliseGeography("  "), undefined);

assert.deepEqual(
  normaliseGeographies(["UK", "United Kingdom", "Europe", "eu", "Worldwide"]),
  ["United Kingdom", "Europe", "Worldwide"],
);

async function checkScoringPath() {
  const startup: AirtableStartup = { id: "startup-check", name: "Geography normalisation check" };
  const canonicalRound: AirtableFundingRound = {
    id: "round-canonical",
    roundGeography: "United Kingdom",
  };
  const aliasRound: AirtableFundingRound = {
    id: "round-alias",
    roundGeography: " uk ",
  };
  const canonicalInvestor: Investor = {
    id: "investor-canonical",
    regionalFocus: ["Europe"],
  };
  const aliasInvestor: Investor = {
    id: "investor-alias",
    regionalFocus: ["eu"],
  };

  const config = { ...getDefaultMatchingConfig(), aiCandidateCount: 0 };
  const [canonicalResult] = await runMatching(canonicalRound, startup, [canonicalInvestor], undefined, undefined, config);
  const [aliasResult] = await runMatching(aliasRound, startup, [aliasInvestor], undefined, undefined, config);

  assert.equal(canonicalResult.scoreBreakdown.geographyMatch, 100);
  assert.equal(aliasResult.scoreBreakdown.geographyMatch, canonicalResult.scoreBreakdown.geographyMatch);
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
    legacyAliasResult.scoreBreakdown.geographyMatch,
    aliasResult.scoreBreakdown.geographyMatch,
  );

  const worldwideInvestor: Investor = {
    id: "investor-worldwide",
    regionalFocus: ["worldwide"],
  };
  const [worldwideResult] = await runMatching(canonicalRound, startup, [worldwideInvestor], undefined, undefined, config);
  assert.equal(worldwideResult.scoreBreakdown.geographyMatch, 100);

  console.log("Geography normalisation checks passed.");
  console.log("Canonical and alias geography inputs produce the same rule scores.");
  console.log("Legacy and normalisation-v1 geography profiles are distinguishable.");
}

checkScoringPath().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
