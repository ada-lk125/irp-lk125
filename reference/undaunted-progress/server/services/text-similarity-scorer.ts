import type { SemanticScorer } from './semantic-scorer';

const CONTEXT_LABEL_PATTERN = /(?:^|\.\s+)(?:startup|description|solution|climate problem|business model|target market|competitors|pitch|traction|unfair advantage|location|sectors|preferred investor types|organisation|thesis|sub-sectors|hq|regional focus|type):\s*/gi;

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'have', 'in', 'into', 'is', 'it', 'its', 'of', 'on', 'or',
  'our', 'startup', 'that', 'the', 'their', 'them', 'they', 'this',
  'to', 'we', 'with', 'you', 'your', 'investor',
]);

export interface TextSimilarityDetails {
  score: number;
  similarity: number;
  startupTokenCount: number;
  investorTokenCount: number;
  sharedTermCount: number;
}

function termFrequencies(tokens: string[]): Map<string, number> {
  const frequencies = new Map<string, number>();
  for (const token of tokens) {
    frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
  }
  return frequencies;
}

export function tokeniseText(value: string): string[] {
  const normalised = value
    .replace(CONTEXT_LABEL_PATTERN, ' ')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();

  return (normalised.match(/[a-z0-9]+/g) ?? [])
    .filter(token => token.length > 1 && !STOP_WORDS.has(token));
}

export function cosineSimilarity(
  leftTokens: string[],
  rightTokens: string[],
): number {
  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return 0;
  }

  const left = termFrequencies(leftTokens);
  const right = termFrequencies(rightTokens);
  let dotProduct = 0;
  let leftMagnitudeSquared = 0;
  let rightMagnitudeSquared = 0;

  for (const [token, count] of left) {
    dotProduct += count * (right.get(token) ?? 0);
    leftMagnitudeSquared += count * count;
  }
  for (const count of right.values()) {
    rightMagnitudeSquared += count * count;
  }

  const denominator = Math.sqrt(leftMagnitudeSquared * rightMagnitudeSquared);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

export function compareTextSimilarity(
  startupContext: string,
  investorContext: string,
): TextSimilarityDetails {
  const startupTokens = tokeniseText(startupContext);
  const investorTokens = tokeniseText(investorContext);
  const similarity = cosineSimilarity(startupTokens, investorTokens);
  const investorTerms = new Set(investorTokens);
  const sharedTermCount = new Set(
    startupTokens.filter(token => investorTerms.has(token)),
  ).size;

  return {
    score: Math.round(similarity * 100),
    similarity,
    startupTokenCount: startupTokens.length,
    investorTokenCount: investorTokens.length,
    sharedTermCount,
  };
}

export const scoreTextSimilarityMatch: SemanticScorer = async (
  startupContext,
  investorContext,
) => {
  const details = compareTextSimilarity(startupContext, investorContext);

  if (details.startupTokenCount === 0 || details.investorTokenCount === 0) {
    return {
      score: 0,
      exclusion_found: false,
      insight: 'Insufficient text for local similarity scoring',
    };
  }

  const termLabel = details.sharedTermCount === 1 ? 'term' : 'terms';
  return {
    score: details.score,
    exclusion_found: false,
    insight: `Local text similarity score: ${details.score}/100 from ${details.sharedTermCount} shared ${termLabel} after removing common words`,
  };
};
