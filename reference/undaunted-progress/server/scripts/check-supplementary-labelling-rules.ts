import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";
import {
  BLIND_JUDGEMENT_COLUMNS,
  BLIND_LABELLING_COLUMNS,
  type BlindLabellingRow,
} from "../services/blind-labelling";
import { selectSupplementaryRows } from "../services/supplementary-labelling";

function getInputPath(args: string[]): string {
  const index = args.indexOf("--input");
  const value = index >= 0 ? args[index + 1] : undefined;
  if (!value || value.startsWith("--")) {
    throw new Error(
      "Usage: check-supplementary-labelling-rules.ts --input <csv>",
    );
  }
  return value;
}

function parseRows(csv: string): BlindLabellingRow[] {
  const records = parse(csv, {
    columns: false,
    skip_empty_lines: true,
  }) as string[][];
  assert.equal((records[0] || []).join(","), BLIND_LABELLING_COLUMNS.join(","));
  return records
    .slice(1)
    .map((values) =>
      Object.fromEntries(
        BLIND_LABELLING_COLUMNS.map((column, index) => [
          column,
          values[index] || "",
        ]),
      ),
    ) as BlindLabellingRow[];
}

async function main() {
  const inputPath = getInputPath(process.argv.slice(2));
  const frozenRows = parseRows(await readFile(inputPath, "utf8"));
  const sameQueryNewInvestor: BlindLabellingRow = {
    ...frozenRows[0],
    investorId: `${frozenRows[0].investorId}-new`,
    relevance_label: "strong_fit",
    relevance_value: "2",
    review_status: "complete",
  };
  const nextRoundSameInvestor: BlindLabellingRow = {
    ...frozenRows[1],
    queryId: `${frozenRows[1].queryId}-next-round`,
    fundingRoundId: `${frozenRows[1].fundingRoundId}-next-round`,
  };
  const candidateRows = [
    ...frozenRows,
    sameQueryNewInvestor,
    nextRoundSameInvestor,
  ];

  const selection = selectSupplementaryRows(candidateRows, frozenRows);
  assert.equal(selection.summary.candidatePairCount, 6);
  assert.equal(selection.summary.existingPairCount, 4);
  assert.equal(selection.summary.newPairCount, 2);
  assert.equal(selection.summary.queryCount, 2);
  assert.deepEqual(
    selection.rows.map((row) => row.investorId),
    [sameQueryNewInvestor.investorId, nextRoundSameInvestor.investorId],
  );
  assert.equal(
    selection.rows.every((row) =>
      BLIND_JUDGEMENT_COLUMNS.every((column) => row[column] === ""),
    ),
    true,
  );

  assert.throws(
    () =>
      selectSupplementaryRows([...candidateRows, candidateRows[0]], frozenRows),
    /Candidate set repeats queryId \+ investorId/,
  );

  console.log("Supplementary labelling rule check passed.");
  console.log(`Existing pairs skipped: ${selection.summary.existingPairCount}`);
  console.log(`New pairs selected: ${selection.summary.newPairCount}`);
}

main().catch((error: Error) => {
  console.error(`Supplementary labelling rule check failed: ${error.message}`);
  process.exit(1);
});
