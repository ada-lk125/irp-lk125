import assert from "node:assert/strict";
import {
  CURATED_FEEDBACK_SELECTION_SCHEMA_VERSION,
  MAX_CURATED_FEEDBACK_REASON_LENGTH,
  selectCuratedFeedback,
  type FeedbackSelectionInput,
} from "../services/feedback-selection";

const evaluationFundingRoundIds = ["round-1", "round-2", "round-3"];

function entry(
  feedbackId: string,
  overrides: Partial<FeedbackSelectionInput> = {},
): FeedbackSelectionInput {
  return {
    feedbackId,
    investorId: `investor-${feedbackId}`,
    investorName: `Investor ${feedbackId}`,
    fundingRoundId: `historical-round-${feedbackId}`,
    startupName: `Startup ${feedbackId}`,
    rating: "up",
    reason: `Useful reason for ${feedbackId}`,
    evidenceGroup: "useful",
    createdAt: "2026-07-01T09:00:00.000Z",
    ...overrides,
  };
}

function select(entries: readonly FeedbackSelectionInput[], maxPerRating = 2) {
  return selectCuratedFeedback({
    feedbackSetVersion: "curated-feedback-2026-07-20",
    entries,
    evaluationFundingRoundIds,
    maxPerRating,
  });
}

function main() {
  const sourceEntries = [
    entry("up-old"),
    entry("up-new", { createdAt: "2026-07-03T09:00:00.000Z" }),
    entry("down-new", {
      rating: "down",
      reason: "  Clear mismatch\nwith the round  ",
      createdAt: "2026-07-04T09:00:00.000Z",
    }),
    entry("weak", { evidenceGroup: "weak" }),
    entry("current-round", { fundingRoundId: "round-2" }),
  ];
  const selection = select(sourceEntries, 1);

  assert.equal(selection.schemaVersion, CURATED_FEEDBACK_SELECTION_SCHEMA_VERSION);
  assert.match(selection.feedbackSetHash, /^[a-f0-9]{64}$/);
  assert.equal(selection.summary.sourceCount, 5);
  assert.equal(selection.summary.usefulCount, 4);
  assert.equal(selection.summary.weakCount, 1);
  assert.equal(selection.summary.excludedCurrentRoundCount, 1);
  assert.equal(selection.summary.selectedUpCount, 1);
  assert.equal(selection.summary.selectedDownCount, 1);
  assert.deepEqual(
    selection.entries.map(({ feedbackId }) => feedbackId),
    ["down-new", "up-new"],
  );
  assert.equal(selection.entries[0].reason, "Clear mismatch with the round");
  assert.doesNotMatch(
    JSON.stringify(selection.summary),
    /Investor|Startup|reason|mismatch/,
  );

  const reordered = select([...sourceEntries].reverse(), 1);
  assert.equal(reordered.feedbackSetHash, selection.feedbackSetHash);
  assert.deepEqual(reordered.entries, selection.entries);

  assert.throws(
    () => select([sourceEntries[0], { ...sourceEntries[1], feedbackId: "up-old" }]),
    /duplicate feedbackId/,
  );
  assert.throws(
    () =>
      select([
        sourceEntries[0],
        {
          ...sourceEntries[1],
          investorId: sourceEntries[0].investorId,
          fundingRoundId: sourceEntries[0].fundingRoundId,
        },
      ]),
    /repeat an investor and funding round pair/,
  );
  assert.throws(
    () => select([entry("blank-reason", { reason: " " })]),
    /reason must be a non-empty string/,
  );
  assert.throws(
    () => select([entry("long-reason", { reason: "x".repeat(MAX_CURATED_FEEDBACK_REASON_LENGTH + 1) })]),
    /must not exceed 500 characters/,
  );
  assert.throws(
    () => selectCuratedFeedback({
      feedbackSetVersion: "curated-feedback-2026-07-20",
      entries: sourceEntries,
      evaluationFundingRoundIds: ["round-1", "round-1", "round-3"],
      maxPerRating: 1,
    }),
    /evaluationFundingRoundIds must be unique/,
  );

  console.log("Curated feedback selection check passed.");
  console.log("Checked useful groups, leakage exclusion, stable hashing, and private summaries.");
}

main();
