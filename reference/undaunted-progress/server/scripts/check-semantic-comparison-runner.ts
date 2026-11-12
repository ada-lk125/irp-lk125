import assert from "node:assert/strict";
import type {
  AirtableFundingRound,
  AirtableStartup,
  Investor,
} from "../services/airtable";
import { getDefaultMatchingConfig } from "../services/matching-config";
import { runSemanticComparison } from "../services/semantic-comparison-runner";
import type { SemanticScorer } from "../services/semantic-scorer";

const startup: AirtableStartup = {
  id: "startup-comparison-check",
  name: "Comparison check startup",
  description: "Develops industrial energy efficiency software.",
};

const fundingRound: AirtableFundingRound = {
  id: "round-comparison-check",
  roundStage: "Seed",
  roundSectors: ["Energy"],
  roundGeography: "United Kingdom",
  investmentTypes: ["Equity"],
};

const investors: Investor[] = Array.from({ length: 12 }, (_, index) => ({
  id: `investor-${String(index + 1).padStart(2, "0")}`,
  organisation: `Comparison investor ${index + 1}`,
  description: "Invests in early-stage industrial energy efficiency companies.",
  investmentStage: ["Seed"],
  sectorFocus: ["Energy"],
  regionalFocus: ["United Kingdom"],
  investmentInstruments: ["Equity"],
}));

function fixedScorer(score: number, label: string, calls: string[]): SemanticScorer {
  return async (_startupContext, investorContext, feedbackContext) => {
    assert.equal(feedbackContext, "");
    calls.push(investorContext);
    return {
      score,
      exclusion_found: false,
      insight: label,
    };
  };
}

async function main() {
  const originalInvestorIds = investors.map(({ id }) => id);
  const gptCalls: string[] = [];
  const textSimilarityCalls: string[] = [];
  const progressMethods = new Set<string>();
  const comparison = await runSemanticComparison(
    {
      queryId: "query-comparison-check",
      fundingRound,
      startup,
      investors,
      config: getDefaultMatchingConfig(),
      onProgress: method => progressMethods.add(method),
    },
    {
      semanticScorers: {
        "gpt-semantic": fixedScorer(80, "GPT comparison result", gptCalls),
        "text-similarity": fixedScorer(
          40,
          "Text similarity comparison result",
          textSimilarityCalls,
        ),
      },
    },
  );

  assert.deepEqual(investors.map(({ id }) => id), originalInvestorIds);
  assert.equal(comparison.identity.candidateCount, investors.length);
  assert.equal(comparison.signalAudit.investors.candidateCount, investors.length);
  assert.equal(comparison.signalAudit.investors.emptyContextCount, 0);
  assert.deepEqual(
    comparison.methodRuns.map(({ method }) => method),
    ["rule-only", "gpt-semantic", "text-similarity"],
  );
  assert.ok(comparison.methodRuns.every(({ matches }) => matches.length === 10));

  const [ruleOnly, gptSemantic, textSimilarity] = comparison.methodRuns;
  assert.ok(ruleOnly.matches.every(match => match.scoreBreakdown.semanticScore === 0));
  assert.ok(gptSemantic.matches.every(match => match.scoreBreakdown.semanticScore === 80));
  assert.ok(textSimilarity.matches.every(match => match.scoreBreakdown.semanticScore === 40));
  assert.equal(gptCalls.length, investors.length);
  assert.equal(textSimilarityCalls.length, investors.length);
  assert.deepEqual(
    Array.from(progressMethods).sort(),
    ["gpt-semantic", "rule-only", "text-similarity"],
  );

  await assert.rejects(
    () =>
      runSemanticComparison({
        queryId: "query-comparison-check",
        fundingRound,
        startup,
        investors,
        config: {
          ...getDefaultMatchingConfig(),
          weights: {
            ...getDefaultMatchingConfig().weights,
            semantic: 0.2,
          },
        },
      }),
    /Semantic comparison boundary failed/,
  );

  console.log("Semantic comparison runner check passed.");
  console.log("Checked shared candidates, text coverage, method order, top-ten outputs, and feedback isolation.");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
