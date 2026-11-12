import assert from "node:assert/strict";
import {
  CURATED_FEEDBACK_CONTEXT_SCHEMA_VERSION,
  buildCuratedFeedbackContext,
} from "../services/feedback-context";
import {
  selectCuratedFeedback,
  type FeedbackSelectionInput,
} from "../services/feedback-selection";

function feedback(
  feedbackId: string,
  rating: "up" | "down",
  reason: string,
): FeedbackSelectionInput {
  return {
    feedbackId,
    investorId: `private-investor-${feedbackId}`,
    investorName: `Private Investor ${feedbackId}`,
    fundingRoundId: `historical-round-${feedbackId}`,
    startupName: `Private Startup ${feedbackId}`,
    rating,
    reason,
    evidenceGroup: "useful",
    createdAt: "2026-07-01T09:00:00.000Z",
  };
}

function selection(entries: FeedbackSelectionInput[]) {
  return selectCuratedFeedback({
    feedbackSetVersion: "curated-feedback-2026-07-21",
    entries,
    evaluationFundingRoundIds: ["round-1", "round-2", "round-3"],
    maxPerRating: 2,
  });
}

function main() {
  const selected = selection([
    feedback("positive", "up", "The investor has relevant industrial climate experience."),
    feedback("negative", "down", "The ticket range is too small for this round."),
  ]);
  const context = buildCuratedFeedbackContext({
    selection: selected,
    maxCharacters: 2000,
  });

  assert.equal(context.schemaVersion, CURATED_FEEDBACK_CONTEXT_SCHEMA_VERSION);
  assert.equal(context.feedbackSetVersion, selected.feedbackSetVersion);
  assert.equal(context.feedbackSetHash, selected.feedbackSetHash);
  assert.equal(context.characterCount, context.text.length);
  assert.equal(context.selectedUpCount, 1);
  assert.equal(context.selectedDownCount, 1);
  assert.match(context.text, /Negative review reasons/);
  assert.match(context.text, /ticket range is too small/);
  assert.match(context.text, /Positive review reasons/);
  assert.match(context.text, /relevant industrial climate experience/);
  assert.ok(
    context.text.indexOf("Negative review reasons")
      < context.text.indexOf("Positive review reasons"),
  );
  assert.doesNotMatch(
    context.text,
    /Private Investor|Private Startup|private-investor|historical-round/,
  );

  const oneSided = buildCuratedFeedbackContext({
    selection: selection([
      feedback("positive-only", "up", "The investor fits the target market."),
    ]),
    maxCharacters: 2000,
  });
  assert.doesNotMatch(oneSided.text, /Negative review reasons/);
  assert.match(oneSided.text, /Positive review reasons/);

  assert.throws(
    () => buildCuratedFeedbackContext({ selection: selected, maxCharacters: 20 }),
    /above the 20 character limit/,
  );
  assert.throws(
    () => buildCuratedFeedbackContext({ selection: selected, maxCharacters: 0 }),
    /maxCharacters must be a positive integer/,
  );
  assert.throws(
    () => buildCuratedFeedbackContext({ selection: selection([]), maxCharacters: 2000 }),
    /requires at least one selected entry/,
  );

  console.log("Curated feedback context check passed.");
  console.log("Checked rating groups, private-field exclusion, identity, and context limits.");
}

main();
