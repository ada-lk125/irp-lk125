import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildFeedbackSelectionSource,
  feedbackSelectionSourceSha256,
  validateFeedbackSelectionSource,
  writeFeedbackSelectionSource,
  type MatchFeedbackSourceRow,
} from "../services/feedback-selection-source";

function row(
  id: number,
  overrides: Partial<MatchFeedbackSourceRow> = {},
): MatchFeedbackSourceRow {
  return {
    id,
    investorId: `investor-${id}`,
    investorName: `Investor ${id}`,
    fundingRoundId: `historical-round-${id}`,
    startupName: `Startup ${id}`,
    rating: id % 2 === 0 ? "down" : "up",
    reason: `Human reason ${id}`,
    createdAt: `2026-07-${String(id).padStart(2, "0")}T09:00:00.000Z`,
    ...overrides,
  };
}

async function main() {
  const source = buildFeedbackSelectionSource({
    rows: [
      row(1),
      row(2),
      row(3, { reason: " " }),
      row(4, { reason: "x".repeat(501) }),
      row(5, { rating: "neutral" }),
      row(6, { createdAt: "invalid" }),
    ],
    createdAt: "2026-07-23T00:00:00.000Z",
  });

  assert.equal(source.summary.sourceCount, 6);
  assert.equal(source.summary.eligibleCount, 2);
  assert.equal(source.summary.eligibleUpCount, 1);
  assert.equal(source.summary.eligibleDownCount, 1);
  assert.equal(source.summary.missingReasonCount, 1);
  assert.equal(source.summary.overlongReasonCount, 1);
  assert.equal(source.summary.unsupportedRatingCount, 1);
  assert.equal(source.summary.invalidIdentityOrTimestampCount, 1);
  assert.deepEqual(
    source.entries.map(({ feedbackId }) => feedbackId),
    ["match-feedback-1", "match-feedback-2"],
  );
  assert.match(feedbackSelectionSourceSha256(source), /^[a-f0-9]{64}$/);

  const validated = validateFeedbackSelectionSource(
    JSON.parse(JSON.stringify(source)),
  );
  assert.deepEqual(validated, source);

  const workingDirectory = await mkdtemp(
    path.join(os.tmpdir(), "feedback-selection-source-"),
  );
  try {
    const filePath = "exports/feedback-source.local.json";
    const written = await writeFeedbackSelectionSource({
      source,
      filePath,
      workingDirectory,
    });
    assert.deepEqual(JSON.parse(await readFile(written, "utf8")), source);
    await assert.rejects(
      writeFeedbackSelectionSource({
        source,
        filePath,
        workingDirectory,
      }),
      /already exists/,
    );
    await assert.rejects(
      writeFeedbackSelectionSource({
        source,
        filePath: "../feedback-source.local.json",
        workingDirectory,
      }),
      /must stay inside exports/,
    );
  } finally {
    await rm(workingDirectory, { recursive: true, force: true });
  }

  console.log("Feedback selection source check passed.");
  console.log(
    "Checked read-only source policy, eligibility counts, hashing, and protected output.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
