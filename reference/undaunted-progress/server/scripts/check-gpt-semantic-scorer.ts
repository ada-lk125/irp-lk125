import assert from 'node:assert/strict';
import { getDefaultMatchingConfig } from '../services/matching-config';
import {
  createGptSemanticScorer,
  type SemanticCompletionRequest,
} from '../services/semantic-scorer';

async function main() {
  const config = getDefaultMatchingConfig();
  let emptyContextCalls = 0;
  const emptyContextScorer = createGptSemanticScorer({
    complete: async () => {
      emptyContextCalls += 1;
      return undefined;
    },
  });
  const emptyContextResult = await emptyContextScorer('', 'Investor', '', config);

  assert.equal(emptyContextCalls, 0);
  assert.deepEqual(emptyContextResult, {
    score: config.defaultScores.aiFailure,
    exclusion_found: false,
    insight: 'Insufficient data for semantic analysis',
  });

  const upperBoundScorer = createGptSemanticScorer({
    complete: async () => JSON.stringify({
      score: 120,
      exclusion_found: true,
      insight: 'Hard constraint found',
    }),
  });
  assert.deepEqual(
    await upperBoundScorer('Startup', 'Investor', '', config),
    { score: 100, exclusion_found: true, insight: 'Hard constraint found' },
  );

  const lowerBoundScorer = createGptSemanticScorer({
    complete: async () => JSON.stringify({
      score: -5,
      exclusion_found: 'false',
    }),
  });
  assert.deepEqual(
    await lowerBoundScorer('Startup', 'Investor', '', config),
    { score: 0, exclusion_found: false, insight: 'No insight provided' },
  );

  const responses = [undefined, '{invalid-json', JSON.stringify({
    score: 'not-a-number',
    exclusion_found: false,
    insight: 'Recovered response',
  })];
  const requests: SemanticCompletionRequest[] = [];
  const waits: number[] = [];
  const failedAttempts: number[] = [];
  const retryScorer = createGptSemanticScorer({
    complete: async request => {
      requests.push(request);
      return responses.shift();
    },
    wait: async delayMs => {
      waits.push(delayMs);
    },
    reportError: attempt => {
      failedAttempts.push(attempt);
    },
  });
  const retryResult = await retryScorer(
    'Startup context',
    'Investor context',
    '\nFeedback context',
    config,
  );

  assert.equal(requests.length, 3);
  assert.deepEqual(waits, [1000, 2000]);
  assert.deepEqual(failedAttempts, [2]);
  assert.equal(requests[0].model, config.aiModel);
  assert.equal(requests[0].maxTokens, config.aiMaxTokens);
  assert.equal(requests[0].systemPrompt, `${config.aiSystemPrompt}\nFeedback context`);
  assert.equal(requests[0].userPrompt, 'STARTUP:\nStartup context\n\nINVESTOR:\nInvestor context');
  assert.deepEqual(retryResult, {
    score: config.defaultScores.aiFailure,
    exclusion_found: false,
    insight: 'Recovered response',
  });

  let exhaustedAttempts = 0;
  const exhaustedScorer = createGptSemanticScorer({
    complete: async () => {
      exhaustedAttempts += 1;
      throw new Error('Offline failure');
    },
    wait: async () => undefined,
    reportError: () => undefined,
  });
  assert.deepEqual(
    await exhaustedScorer('Startup', 'Investor', '', config),
    {
      score: config.defaultScores.aiFailure,
      exclusion_found: false,
      insight: 'Unable to perform semantic analysis',
    },
  );
  assert.equal(exhaustedAttempts, 3);

  console.log('GPT semantic scorer check passed.');
  console.log('Checked request shape, response parsing, retries, and fallback behaviour.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
