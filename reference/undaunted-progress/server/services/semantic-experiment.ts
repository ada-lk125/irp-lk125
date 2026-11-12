import type { MatchingConfig } from "./matching";

export type SemanticExperimentMethod =
  | "rule-only"
  | "gpt-semantic"
  | "text-similarity";

export interface SemanticExperimentMethodConfig {
  method: SemanticExperimentMethod;
  semanticSource: "none" | "gpt-4o-mini" | "local-text-similarity";
  feedbackMode: "none";
}

export const semanticExperimentContract = {
  queryCount: 3,
  rowsPerQuery: 10,
  topK: 10,
  useSameCandidatePool: true,
  candidateTieBreak: "investor-id",
  methods: [
    {
      method: "rule-only",
      semanticSource: "none",
      feedbackMode: "none",
    },
    {
      method: "gpt-semantic",
      semanticSource: "gpt-4o-mini",
      feedbackMode: "none",
    },
    {
      method: "text-similarity",
      semanticSource: "local-text-similarity",
      feedbackMode: "none",
    },
  ] satisfies SemanticExperimentMethodConfig[],
} as const;

const expectedMatchingBoundary = {
  semanticWeight: 0.3,
  aiModel: "gpt-4o-mini",
  aiCandidateCount: 60,
  contextCharLimit: 2500,
  exclusionCap: 15,
};

function sameNumber(actual: number, expected: number) {
  return Math.abs(actual - expected) < 0.000001;
}

export function validateSemanticExperimentBoundary(config: MatchingConfig): string[] {
  const errors: string[] = [];

  if (!sameNumber(config.weights.semantic, expectedMatchingBoundary.semanticWeight)) {
    errors.push(
      `Expected semantic weight ${expectedMatchingBoundary.semanticWeight}; found ${config.weights.semantic}.`,
    );
  }
  if (config.aiModel !== expectedMatchingBoundary.aiModel) {
    errors.push(`Expected AI model ${expectedMatchingBoundary.aiModel}; found ${config.aiModel}.`);
  }
  if (config.aiCandidateCount !== expectedMatchingBoundary.aiCandidateCount) {
    errors.push(
      `Expected ${expectedMatchingBoundary.aiCandidateCount} AI candidates; found ${config.aiCandidateCount}.`,
    );
  }
  if (config.contextCharLimit !== expectedMatchingBoundary.contextCharLimit) {
    errors.push(
      `Expected context limit ${expectedMatchingBoundary.contextCharLimit}; found ${config.contextCharLimit}.`,
    );
  }
  if (config.exclusionCap !== expectedMatchingBoundary.exclusionCap) {
    errors.push(
      `Expected exclusion cap ${expectedMatchingBoundary.exclusionCap}; found ${config.exclusionCap}.`,
    );
  }

  return errors;
}
