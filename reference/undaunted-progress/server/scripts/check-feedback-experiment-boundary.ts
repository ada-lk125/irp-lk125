import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  buildFeedbackExperimentDefinition,
  FEEDBACK_EXPERIMENT_SCHEMA_VERSION,
  type FeedbackExperimentQueryIdentity,
} from "../services/feedback-experiment";

function hash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

const queries: FeedbackExperimentQueryIdentity[] = [1, 2, 3].map(index => ({
  queryId: `query-${index}`,
  startupId: `startup-${index}`,
  fundingRoundId: `round-${index}`,
  candidatePoolHash: hash(`candidate-pool-${index}`),
}));

function build(queryIdentities: readonly FeedbackExperimentQueryIdentity[] = queries) {
  return buildFeedbackExperimentDefinition({
    matchingConfigHash: hash("fixed-matching-config"),
    feedbackSetVersion: "curated-feedback-2026-07-20",
    feedbackSetHash: hash("curated-feedback-set"),
    queries: queryIdentities,
  });
}

function main() {
  const definition = build();

  assert.equal(definition.schemaVersion, FEEDBACK_EXPERIMENT_SCHEMA_VERSION);
  assert.equal(definition.semanticMethod, "gpt-semantic");
  assert.equal(definition.topK, 10);
  assert.deepEqual(
    definition.runs.map(({ feedbackMode }) => feedbackMode),
    ["none", "curated"],
  );
  assert.equal(definition.evaluationStatus, "requires-frozen-labels");
  assert.doesNotMatch(
    JSON.stringify(definition),
    /investorName|startupName|reason|feedbackText/,
  );

  assert.throws(
    () => build(queries.slice(0, 2)),
    /exactly three query identities/,
  );
  assert.throws(
    () => build([queries[0], { ...queries[1], queryId: queries[0].queryId }, queries[2]]),
    /queryId values must be unique/,
  );
  assert.throws(
    () =>
      build([
        queries[0],
        {
          ...queries[1],
          startupId: queries[0].startupId,
          fundingRoundId: queries[0].fundingRoundId,
        },
        queries[2],
      ]),
    /startup and funding round pairs must be unique/,
  );
  assert.throws(
    () => build([{ ...queries[0], candidatePoolHash: "not-a-hash" }, ...queries.slice(1)]),
    /must be a SHA-256 hash/,
  );
  assert.throws(
    () =>
      buildFeedbackExperimentDefinition({
        matchingConfigHash: hash("fixed-matching-config"),
        feedbackSetVersion: " ",
        feedbackSetHash: hash("curated-feedback-set"),
        queries,
      }),
    /feedbackSetVersion must be a non-empty identifier/,
  );

  console.log("Feedback experiment boundary check passed.");
  console.log("Checked fixed runs, query identity, hashes, and private-value omission.");
}

main();
