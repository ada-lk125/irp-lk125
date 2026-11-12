import assert from 'node:assert/strict';
import type {
  AirtableFundingRound,
  AirtableStartup,
  Investor,
} from '../services/airtable';
import { getDefaultMatchingConfig } from '../services/matching-config';
import { runMatching } from '../services/matching';
import type { SemanticScorer } from '../services/semantic-scorer';

const startup: AirtableStartup = {
  id: 'startup-semantic-mode-check',
  name: 'Semantic mode check',
  description: 'Builds low-carbon industrial heat systems.',
};

const round: AirtableFundingRound = {
  id: 'round-semantic-mode-check',
  roundStage: 'Seed',
  roundSectors: ['Climate Tech'],
};

const investors: Investor[] = [
  {
    id: 'investor-semantic-one',
    organisation: 'Investor one',
    description: 'Invests in industrial decarbonisation.',
    investmentStage: ['Seed'],
  },
  {
    id: 'investor-semantic-two',
    organisation: 'Investor two',
    description: 'Invests in early-stage climate software.',
    investmentStage: ['Seed'],
  },
];

async function main() {
  const config = {
    ...getDefaultMatchingConfig(),
    aiCandidateCount: investors.length,
    aiBatchSize: investors.length,
  };
  let scorerCalls = 0;
  const injectedScorer: SemanticScorer = async () => {
    scorerCalls += 1;
    return {
      score: 75,
      exclusion_found: false,
      insight: 'Injected semantic result',
    };
  };

  const semanticResults = await runMatching(
    round,
    startup,
    investors,
    undefined,
    undefined,
    config,
    undefined,
    { semanticScorer: injectedScorer },
  );

  assert.equal(scorerCalls, investors.length);
  assert.ok(semanticResults.every(result => result.scoreBreakdown.semanticScore === 75));
  assert.ok(semanticResults.every(result => result.aiInsight === 'Injected semantic result'));

  const ruleOnlyResults = await runMatching(
    round,
    startup,
    investors,
    undefined,
    undefined,
    config,
    undefined,
    {
      semanticMode: 'rule-only',
      semanticScorer: async () => {
        throw new Error('Rule-only mode must not call the semantic scorer.');
      },
    },
  );

  assert.equal(scorerCalls, investors.length);
  assert.ok(ruleOnlyResults.every(result => result.scoreBreakdown.semanticScore === 0));
  assert.ok(ruleOnlyResults.every(result => result.aiInsight === undefined));

  const textSimilarityResults = await runMatching(
    round,
    startup,
    investors,
    undefined,
    undefined,
    config,
    undefined,
    { semanticMode: 'text-similarity' },
  );

  assert.ok(textSimilarityResults.every(result => (
    result.scoreBreakdown.semanticScore >= 0
      && result.scoreBreakdown.semanticScore <= 100
  )));
  assert.ok(textSimilarityResults.every(result => (
    result.aiInsight?.startsWith('Local text similarity score:')
  )));

  console.log('Semantic scoring mode check passed.');
  console.log('Checked injected scoring, rule-only, and local text similarity paths.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
