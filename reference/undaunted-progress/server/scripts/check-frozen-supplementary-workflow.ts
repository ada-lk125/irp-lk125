import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  BLIND_LABELLING_COLUMNS,
  BLIND_LABELLING_SCHEMA_VERSION,
  BLIND_JUDGEMENT_COLUMNS,
  type BlindLabellingRow,
} from "../services/blind-labelling";
import {
  serialiseBlankBlindCsv,
  serialiseBlindCsv,
} from "../services/blind-labelling-csv";
import { parseBlindLabellingCsv } from "../services/blind-labelling-file";
import {
  buildBlindPackManifest,
  sha256Text,
} from "../services/blind-labelling-manifest";
import { validateFrozenLabellingFile } from "../services/frozen-labelling-file";
import {
  FROZEN_LABEL_MANIFEST_SCHEMA_VERSION,
  parseFrozenLabelManifest,
  type FrozenLabelManifest,
} from "../services/frozen-labelling-manifest";
import { transferFrozenJudgements } from "../services/frozen-label-transfer";
import { validateSourcePackManifest } from "../services/label-freeze";
import { selectSupplementaryRows } from "../services/supplementary-labelling";

function getInputPath(args: string[]): string {
  const index = args.indexOf("--input");
  const value = index >= 0 ? args[index + 1] : undefined;
  if (!value || value.startsWith("--")) {
    throw new Error(
      "Usage: check-frozen-supplementary-workflow.ts --input <blind-csv>",
    );
  }
  return value;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
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

function completeRows(rows: readonly BlindLabellingRow[]): BlindLabellingRow[] {
  const labels = ["strong_fit", "possible_fit", "weak_fit"] as const;
  return rows.map((row, index) => {
    const relevanceLabel = labels[index % labels.length];
    return {
      ...row,
      relevance_label: relevanceLabel,
      relevance_value: String(2 - (index % labels.length)),
      judgement_note: `Offline judgement ${index + 1}`,
      error_category: "",
      uncertainty_note: "",
      review_status: "complete",
    };
  });
}

async function main() {
  const inputPath = getInputPath(process.argv.slice(2));
  const sourceCsv = await readFile(inputPath, "utf8");
  const sourceRows = parseBlindLabellingCsv(sourceCsv, "Offline source CSV");
  const labelledRows = completeRows(sourceRows);
  const labelledCsv = serialiseBlindCsv(labelledRows);
  const validation = validateFrozenLabellingFile({
    sourceRows,
    labelledRows,
    expectedQueryCount: 1,
    expectedRowsPerQuery: sourceRows.length,
  });
  assert(validation.errors.length === 0, validation.errors.join("\n"));

  const sourceManifest = buildBlindPackManifest({
    csv: sourceCsv,
    rows: sourceRows,
    packVersion: "offline-formal-v1",
    purpose: "formal",
    createdAt: "2026-07-01T09:00:00.000Z",
    fileName: path.basename(inputPath),
  });
  const frozenManifest: FrozenLabelManifest = {
    schemaVersion: FROZEN_LABEL_MANIFEST_SCHEMA_VERSION,
    labellingSchemaVersion: BLIND_LABELLING_SCHEMA_VERSION,
    frozenVersion: "offline-frozen-v1",
    frozenAt: "2026-07-02T09:00:00.000Z",
    fileName: "offline-labelled.local.csv",
    sha256: sha256Text(labelledCsv),
    sourcePackVersion: sourceManifest.packVersion,
    sourcePackSha256: sourceManifest.sha256,
    rowCount: validation.summary.rowCount,
    queryCount:
      validation.summary.completeQueryCount +
      validation.summary.incompleteQueryCount,
    judgedRowCount: validation.summary.judgedRowCount,
    holdRowCount: validation.summary.holdRowCount,
    completeQueryCount: validation.summary.completeQueryCount,
    incompleteQueryCount: validation.summary.incompleteQueryCount,
    columnCount: BLIND_LABELLING_COLUMNS.length,
  };
  parseFrozenLabelManifest(frozenManifest, {
    csv: labelledCsv,
    fileName: "offline-labelled.local.csv",
    summary: validation.summary,
  });

  const tamperedRows = labelledRows.map((row) => ({ ...row }));
  tamperedRows[0].startupDescription = `${tamperedRows[0].startupDescription} changed`;
  const tamperedValidation = validateFrozenLabellingFile({
    sourceRows,
    labelledRows: tamperedRows,
  });
  assert(
    tamperedValidation.errors.some((error) =>
      error.includes("changed startupDescription"),
    ),
    "Changed evidence was not rejected.",
  );

  const newPair = {
    ...sourceRows[0],
    investorId: `${sourceRows[0].investorId}-new`,
  };
  const selection = selectSupplementaryRows(
    [...sourceRows, newPair],
    labelledRows,
  );
  assert(
    selection.rows.length === 1,
    "Supplementary selection must keep one new pair.",
  );
  assert(
    BLIND_JUDGEMENT_COLUMNS.every((column) => selection.rows[0][column] === ""),
    "Supplementary judgement fields must be blank.",
  );
  const supplementaryCsv = serialiseBlankBlindCsv(selection.rows);
  const supplementaryManifest = buildBlindPackManifest({
    csv: supplementaryCsv,
    rows: selection.rows,
    packVersion: "offline-supplementary-v1",
    purpose: "supplementary",
    createdAt: "2026-07-02T10:00:00.000Z",
    fileName: "offline-supplementary.local.csv",
  });
  assert(
    supplementaryManifest.purpose === "supplementary",
    "Supplementary manifest has the wrong purpose.",
  );
  validateSourcePackManifest({
    raw: supplementaryManifest,
    csv: supplementaryCsv,
    sourcePath: "offline-supplementary.local.csv",
    expectedPurpose: "supplementary",
  });

  const unevenSourceRows = Array.from({ length: 6 }, (_, index) => {
    const row = sourceRows[index % sourceRows.length];
    const queryNumber = index < 3 ? 1 : index < 5 ? 2 : 3;
    return {
      ...row,
      queryId: `uneven-query-${queryNumber}`,
      startupId: `uneven-startup-${queryNumber}`,
      fundingRoundId: `uneven-round-${queryNumber}`,
      investorId: `${row.investorId}-uneven-${index}`,
    };
  });
  const unevenValidation = validateFrozenLabellingFile({
    sourceRows: unevenSourceRows,
    labelledRows: completeRows(unevenSourceRows),
    expectedQueryCount: 3,
  });
  assert(
    unevenValidation.errors.length === 0,
    `Uneven supplementary rows were rejected:\n${unevenValidation.errors.join("\n")}`,
  );
  const unevenLabels = completeRows(unevenSourceRows);
  const transferred = transferFrozenJudgements({
    sourceRows: unevenSourceRows,
    frozenLabelSets: [{ label: "synthetic frozen labels", rows: unevenLabels }],
  });
  assert(
    transferred.every(row => row.review_status === "complete"),
    "Transferred labels were not complete.",
  );
  const changedEvidence = unevenSourceRows.map(row => ({ ...row }));
  changedEvidence[0].startupDescription += " changed";
  expectFailure(
    () =>
      transferFrozenJudgements({
        sourceRows: changedEvidence,
        frozenLabelSets: [
          { label: "synthetic frozen labels", rows: unevenLabels },
        ],
      }),
    "changed startupDescription",
  );

  console.log("Frozen file and supplementary workflow check passed.");
  console.log(`Frozen rows: ${validation.summary.rowCount}`);
  console.log(`New supplementary pairs: ${selection.summary.newPairCount}`);
  console.log("Verified supplementary manifest and uneven rows per query.");
  console.log("Verified safe frozen-judgement transfer and evidence guard.");
}

main().catch((error: Error) => {
  console.error(`Frozen workflow check failed: ${error.message}`);
  process.exit(1);
});
