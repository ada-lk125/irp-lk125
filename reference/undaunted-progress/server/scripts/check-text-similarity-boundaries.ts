import assert from 'node:assert/strict';
import { getDefaultMatchingConfig } from '../services/matching-config';
import {
  compareTextSimilarity,
  scoreTextSimilarityMatch,
  tokeniseText,
} from '../services/text-similarity-scorer';

assert.deepEqual(
  tokeniseText(
    'Startup: The clean heat solution. Description: An industrial system for the market.',
  ),
  ['clean', 'heat', 'solution', 'industrial', 'system', 'market'],
);

const related = compareTextSimilarity(
  'Startup: Industrial heat and energy storage.',
  'Organisation: Climate fund. Thesis: Industrial heat storage systems.',
);
const unrelated = compareTextSimilarity(
  'Startup: Industrial heat and energy storage.',
  'Organisation: Marine biodiversity research.',
);

assert.ok(related.score > unrelated.score);
assert.equal(related.sharedTermCount, 3);
assert.equal(unrelated.sharedTermCount, 0);
assert.ok(related.similarity >= 0 && related.similarity <= 1);

async function checkScorerBoundary() {
  const config = getDefaultMatchingConfig();
  const withFeedback = await scoreTextSimilarityMatch(
    'Startup: Industrial heat storage.',
    'Organisation: Industrial climate investor.',
    'Feedback that must not affect local similarity.',
    config,
  );
  const withoutFeedback = await scoreTextSimilarityMatch(
    'Startup: Industrial heat storage.',
    'Organisation: Industrial climate investor.',
    '',
    config,
  );

  assert.deepEqual(withFeedback, withoutFeedback);
  assert.equal(withFeedback.exclusion_found, false);
  assert.match(withFeedback.insight, /shared term/);

  const emptyResult = await scoreTextSimilarityMatch(
    'Startup: the and',
    'Organisation: the and',
    '',
    config,
  );
  assert.deepEqual(emptyResult, {
    score: 0,
    exclusion_found: false,
    insight: 'Insufficient text for local similarity scoring',
  });

  console.log('Text similarity boundary check passed.');
  console.log('Checked context labels, common words, diagnostics, and feedback isolation.');
}

checkScorerBoundary().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
