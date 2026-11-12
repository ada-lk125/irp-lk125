import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";
import {
  BLIND_LABELLING_COLUMNS,
  type BlindLabellingRow,
} from "../services/blind-labelling";
import { validateFrozenLabellingRows } from "../services/frozen-labelling";

function getInputPath(args: string[]): string {
  const index = args.indexOf("--input");
  const value = index >= 0 ? args[index + 1] : undefined;
  if (!value || value.startsWith("--")) {
    throw new Error("Usage: check-frozen-labelling-rules.ts --input <csv>");
  }
  return value;
}

function parseRows(csv: string): BlindLabellingRow[] {
  const records = parse(csv, {
    columns: false,
    skip_empty_lines: true,
  }) as string[][];
  const headers = records[0] || [];
  assert.equal(
    headers.join(","),
    BLIND_LABELLING_COLUMNS.join(","),
    "Sample headers must match the blind labelling contract.",
  );
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
  const rows = parseRows(await readFile(inputPath, "utf8"));
  const labels = ["strong_fit", "possible_fit", "weak_fit"] as const;
  const values = { strong_fit: "2", possible_fit: "1", weak_fit: "0" };
  const completedRows: BlindLabellingRow[] = rows.map((row, index) => {
    const label = labels[index % labels.length];
    return {
      ...row,
      relevance_label: label,
      relevance_value: values[label],
      review_status: "complete",
    };
  });

  const completed = validateFrozenLabellingRows(completedRows);
  assert.deepEqual(completed.errors, []);
  assert.equal(completed.summary.judgedRowCount, rows.length);
  assert.equal(completed.summary.completeQueryCount, 1);

  const heldRows = completedRows.map((row) => ({ ...row }));
  heldRows[0] = {
    ...heldRows[0],
    relevance_label: "",
    relevance_value: "",
    error_category: "data_missing",
    uncertainty_note: "Investor ticket evidence needs review.",
    review_status: "hold",
  };
  const held = validateFrozenLabellingRows(heldRows);
  assert.deepEqual(held.errors, []);
  assert.equal(held.summary.holdRowCount, 1);
  assert.equal(held.summary.incompleteQueryCount, 1);

  const invalidRows = completedRows.map((row) => ({ ...row }));
  invalidRows[0] = { ...invalidRows[0], relevance_value: "0" };
  const invalid = validateFrozenLabellingRows(invalidRows);
  assert.equal(invalid.errors.length, 1);
  assert.match(invalid.errors[0], /relevance value must be 2/);

  console.log("Frozen labelling rule check passed.");
  console.log(`Completed rows checked: ${completed.summary.rowCount}`);
  console.log(`Hold rows checked: ${held.summary.holdRowCount}`);
}

main().catch((error: Error) => {
  console.error(`Frozen labelling rule check failed: ${error.message}`);
  process.exit(1);
});
