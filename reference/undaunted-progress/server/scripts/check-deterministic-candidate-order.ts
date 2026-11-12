import assert from "node:assert/strict";
import type {
  AirtableFundingRound,
  AirtableStartup,
  Investor,
} from "../services/airtable";
import { runMatching } from "../services/matching";
import { getDefaultMatchingConfig } from "../services/matching-config";

const startup: AirtableStartup = {
  id: "startup-determinism-check",
  name: "Determinism check",
  description: "Industrial heat efficiency software.",
};

const fundingRound: AirtableFundingRound = {
  id: "round-determinism-check",
  roundStage: "Seed",
  roundSectors: ["Energy"],
  roundGeography: "United Kingdom",
  investmentTypes: ["Equity"],
};

const investors: Investor[] = ["investor-z", "investor-a", "investor-m"].map(
  id => ({
    id,
    organisation: "Tied fictional investor",
    description: "Invests in industrial heat efficiency software.",
    investmentStage: ["Seed"],
    sectorFocus: ["Energy"],
    regionalFocus: ["United Kingdom"],
    investmentInstruments: ["Equity"],
  }),
);

function ids(matches: Awaited<ReturnType<typeof runMatching>>) {
  return matches.map(({ investor }) => investor.id);
}

async function main() {
  const config = getDefaultMatchingConfig();
  const reversed = [...investors].reverse();

  const legacyOrder = await runMatching(
    fundingRound,
    startup,
    investors,
    [],
    undefined,
    config,
    undefined,
    { semanticMode: "rule-only", candidateTieBreak: "input-order" },
  );
  const reversedLegacyOrder = await runMatching(
    fundingRound,
    startup,
    reversed,
    [],
    undefined,
    config,
    undefined,
    { semanticMode: "rule-only", candidateTieBreak: "input-order" },
  );
  assert.deepEqual(ids(legacyOrder), investors.map(({ id }) => id));
  assert.deepEqual(ids(reversedLegacyOrder), reversed.map(({ id }) => id));

  for (const semanticMode of ["rule-only", "text-similarity"] as const) {
    const forward = await runMatching(
      fundingRound,
      startup,
      investors,
      [],
      undefined,
      config,
      undefined,
      { semanticMode, candidateTieBreak: "investor-id" },
    );
    const backward = await runMatching(
      fundingRound,
      startup,
      reversed,
      [],
      undefined,
      config,
      undefined,
      { semanticMode, candidateTieBreak: "investor-id" },
    );
    assert.deepEqual(ids(forward), ["investor-a", "investor-m", "investor-z"]);
    assert.deepEqual(ids(backward), ids(forward));
  }

  await assert.rejects(
    () =>
      runMatching(
        fundingRound,
        startup,
        investors,
        [],
        0,
        config,
        undefined,
        { semanticMode: "rule-only" },
      ),
    /topN must be a positive integer/,
  );
  await assert.rejects(
    () =>
      runMatching(
        fundingRound,
        startup,
        [investors[0], investors[0]],
        [],
        undefined,
        config,
        undefined,
        { semanticMode: "rule-only" },
      ),
    /Investor ids must be unique/,
  );
  await assert.rejects(
    () =>
      runMatching(
        fundingRound,
        startup,
        investors,
        [],
        undefined,
        { ...config, aiBatchSize: 0 },
        undefined,
        { semanticMode: "text-similarity" },
      ),
    /aiBatchSize must be a positive integer/,
  );

  console.log("Deterministic candidate order check passed.");
  console.log(
    "Checked legacy input-order compatibility, investor-id invariance and invalid run guards.",
  );
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
