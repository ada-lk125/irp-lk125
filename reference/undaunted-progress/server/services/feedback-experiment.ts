export const FEEDBACK_EXPERIMENT_SCHEMA_VERSION = "feedback-experiment-v1";

export type FeedbackExperimentMode = "none" | "curated";

export interface FeedbackExperimentQueryIdentity {
  queryId: string;
  startupId: string;
  fundingRoundId: string;
  candidatePoolHash: string;
}

export interface FeedbackExperimentDefinition {
  schemaVersion: typeof FEEDBACK_EXPERIMENT_SCHEMA_VERSION;
  semanticMethod: "gpt-semantic";
  topK: 10;
  matchingConfigHash: string;
  queries: FeedbackExperimentQueryIdentity[];
  runs: [
    { feedbackMode: "none" },
    {
      feedbackMode: "curated";
      feedbackSetVersion: string;
      feedbackSetHash: string;
    },
  ];
  evaluationStatus: "requires-frozen-labels";
}

function requireIdentifier(value: string, label: string): string {
  const identifier = value.trim();
  if (identifier.length === 0) {
    throw new Error(`${label} must be a non-empty identifier.`);
  }
  return identifier;
}

function requireSha256(value: string, label: string): string {
  const hash = value.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(hash)) {
    throw new Error(`${label} must be a SHA-256 hash.`);
  }
  return hash;
}

export function buildFeedbackExperimentDefinition(args: {
  matchingConfigHash: string;
  feedbackSetVersion: string;
  feedbackSetHash: string;
  queries: readonly FeedbackExperimentQueryIdentity[];
}): FeedbackExperimentDefinition {
  if (args.queries.length !== 3) {
    throw new Error("Feedback experiment requires exactly three query identities.");
  }

  const queries = args.queries.map((query, index) => ({
    queryId: requireIdentifier(query.queryId, `queries[${index}].queryId`),
    startupId: requireIdentifier(query.startupId, `queries[${index}].startupId`),
    fundingRoundId: requireIdentifier(
      query.fundingRoundId,
      `queries[${index}].fundingRoundId`,
    ),
    candidatePoolHash: requireSha256(
      query.candidatePoolHash,
      `queries[${index}].candidatePoolHash`,
    ),
  }));

  const queryIds = queries.map(({ queryId }) => queryId);
  if (new Set(queryIds).size !== queryIds.length) {
    throw new Error("Feedback experiment queryId values must be unique.");
  }

  const startupRoundPairs = queries.map(
    ({ startupId, fundingRoundId }) => `${startupId}\u0000${fundingRoundId}`,
  );
  if (new Set(startupRoundPairs).size !== startupRoundPairs.length) {
    throw new Error("Feedback experiment startup and funding round pairs must be unique.");
  }

  return {
    schemaVersion: FEEDBACK_EXPERIMENT_SCHEMA_VERSION,
    semanticMethod: "gpt-semantic",
    topK: 10,
    matchingConfigHash: requireSha256(args.matchingConfigHash, "matchingConfigHash"),
    queries,
    runs: [
      { feedbackMode: "none" },
      {
        feedbackMode: "curated",
        feedbackSetVersion: requireIdentifier(args.feedbackSetVersion, "feedbackSetVersion"),
        feedbackSetHash: requireSha256(args.feedbackSetHash, "feedbackSetHash"),
      },
    ],
    evaluationStatus: "requires-frozen-labels",
  };
}
