import {
  BLIND_LABELLING_COLUMNS,
  type BlindLabellingRow,
} from "../services/blind-labelling";
import { buildNormalisationEvaluation } from "../services/normalisation-evaluation";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function labelRow(
  queryId: string,
  investorId: string,
  relevance: 0 | 1 | 2,
): BlindLabellingRow {
  const row = Object.fromEntries(
    BLIND_LABELLING_COLUMNS.map(column => [column, ""]),
  ) as BlindLabellingRow;
  const labels = ["weak_fit", "possible_fit", "strong_fit"] as const;
  return {
    ...row,
    queryId,
    startupId: `startup-${queryId}`,
    fundingRoundId: `round-${queryId}`,
    investorId,
    relevance_label: labels[relevance],
    relevance_value: String(relevance),
    judgement_note: "Synthetic workflow check",
    review_status: "complete",
  };
}

function comparison() {
  const queries = ["q1", "q2", "q3"].map(queryId => ({
    queryId,
    startupId: `startup-${queryId}`,
    fundingRoundId: `round-${queryId}`,
    profiles: [
      {
        normalisationProfile: "legacy",
        matches: Array.from({ length: 10 }, (_, index) => ({
          rank: index + 1,
          investor: { id: `${queryId}-i${index + 2}` },
        })),
      },
      {
        normalisationProfile: "normalisation-v1",
        matches: Array.from({ length: 10 }, (_, index) => ({
          rank: index + 1,
          investor: { id: `${queryId}-i${index}` },
        })),
      },
    ],
  }));
  return {
    run: {
      schemaVersion: "normalisation-paired-comparison-v1",
      experimentId: "synthetic-evaluation-check",
      purpose: "pilot",
      semanticMode: "rule-only",
      feedbackMode: "none",
      candidateTieBreak: "investor-id",
      topK: 10,
      queryCount: 3,
      implementation: {
        matchingSha256: "a".repeat(64),
        workingTreeDirty: true,
      },
      candidatePool: {
        candidatePoolSha256: "b".repeat(64),
      },
    },
    queries,
  };
}

function expectFailure(action: () => unknown, messagePart: string) {
  try {
    action();
  } catch (error) {
    assert(
      error instanceof Error && error.message.includes(messagePart),
      `Expected failure containing "${messagePart}".`,
    );
    return;
  }
  throw new Error(`Expected failure containing "${messagePart}".`);
}

function main() {
  const labels = ["q1", "q2", "q3"].flatMap(queryId =>
    Array.from({ length: 12 }, (_, index) =>
      labelRow(
        queryId,
        `${queryId}-i${index}`,
        index === 0 ? 2 : index === 1 ? 1 : 0,
      ),
    ),
  );
  const source = {
    fileName: "synthetic-comparison.local.json",
    sha256: "c".repeat(64),
    value: comparison(),
  };
  const evaluation = buildNormalisationEvaluation({
    purpose: "pilot",
    comparisons: [source],
    labelSets: [
      {
        fileName: "synthetic-labels.local.csv",
        sha256: "d".repeat(64),
        rows: labels,
      },
    ],
  });
  const macro = evaluation.methods[0].macro;
  assert(macro.profiles.legacy.precisionAt10 === 0, "Legacy P@10 changed.");
  assert(
    macro.profiles["normalisation-v1"].precisionAt5 === 0.4,
    "Variant P@5 changed.",
  );
  assert(
    macro.profiles["normalisation-v1"].precisionAt10 === 0.2,
    "Variant P@10 changed.",
  );
  assert(
    macro.profiles["normalisation-v1"].mrr === 1,
    "Variant MRR changed.",
  );
  assert(
    macro.profiles["normalisation-v1"].ndcgAt10 === 1,
    "Variant NDCG@10 changed.",
  );

  expectFailure(
    () =>
      buildNormalisationEvaluation({
        purpose: "pilot",
        comparisons: [source],
        labelSets: [
          {
            fileName: "missing-label.local.csv",
            sha256: "e".repeat(64),
            rows: labels.filter(
              row => !(row.queryId === "q1" && row.investorId === "q1-i11"),
            ),
          },
        ],
      }),
    "Missing frozen label",
  );
  expectFailure(
    () =>
      buildNormalisationEvaluation({
        purpose: "formal",
        comparisons: [source],
        labelSets: [
          {
            fileName: "synthetic-labels.local.csv",
            sha256: "d".repeat(64),
            rows: labels,
          },
        ],
      }),
    "clean formal comparison",
  );

  console.log("Normalisation evaluation workflow check passed.");
  console.log("Verified metrics, missing-label refusal and formal-run guard.");
}

main();
