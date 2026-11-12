import assert from 'node:assert/strict';
import {
  cosineSimilarity,
  tokeniseText,
} from '../services/text-similarity-scorer';

assert.deepEqual(
  tokeniseText('Clímate-tech, HEAT storage 24/7.'),
  ['climate', 'tech', 'heat', 'storage', '24'],
);

const identical = tokeniseText('industrial heat storage');
const related = tokeniseText('heat storage systems');
const unrelated = tokeniseText('marine biodiversity fund');

assert.equal(cosineSimilarity(identical, identical), 1);
assert.equal(cosineSimilarity(identical, unrelated), 0);
assert.equal(cosineSimilarity([], identical), 0);
assert.equal(
  cosineSimilarity(identical, related),
  cosineSimilarity(related, identical),
);

const repeatedTermScore = cosineSimilarity(
  tokeniseText('heat heat storage'),
  tokeniseText('heat storage'),
);
assert.ok(repeatedTermScore > 0 && repeatedTermScore < 1);

console.log('Text similarity foundation check passed.');
console.log('Checked tokenisation, cosine symmetry, repeated terms, and empty input.');
