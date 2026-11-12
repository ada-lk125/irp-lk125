import {
  BLIND_JUDGEMENT_COLUMNS,
  BLIND_LABELLING_COLUMNS,
  type BlindLabellingRow,
} from "./blind-labelling";
import { blindPairKey } from "./blind-labelling-file";
import {
  validateFrozenLabellingRows,
  type FrozenLabellingValidation,
} from "./frozen-labelling";

const evidenceColumns = BLIND_LABELLING_COLUMNS.filter(
  (column) => !(BLIND_JUDGEMENT_COLUMNS as readonly string[]).includes(column),
);

function indexRows(
  rows: readonly BlindLabellingRow[],
  label: string,
  errors: string[],
): Record<string, BlindLabellingRow> {
  const indexed: Record<string, BlindLabellingRow> = Object.create(null);
  rows.forEach((row, index) => {
    const pair = blindPairKey(row);
    if (indexed[pair]) {
      errors.push(`${label} row ${index + 1} repeats a pair.`);
    } else {
      indexed[pair] = row;
    }
  });
  return indexed;
}

export function validateFrozenLabellingFile(args: {
  sourceRows: readonly BlindLabellingRow[];
  labelledRows: readonly BlindLabellingRow[];
  expectedQueryCount?: number;
  expectedRowsPerQuery?: number;
}): FrozenLabellingValidation {
  const rowValidation = validateFrozenLabellingRows(args.labelledRows);
  const errors = [...rowValidation.errors];
  const sourceIndex = indexRows(args.sourceRows, "Source CSV", errors);
  const labelledIndex = indexRows(args.labelledRows, "Labelled CSV", errors);

  args.sourceRows.forEach((sourceRow, index) => {
    if (BLIND_JUDGEMENT_COLUMNS.some((column) => sourceRow[column] !== "")) {
      errors.push(`Source CSV row ${index + 1} has a judgement value.`);
    }
    if (!labelledIndex[blindPairKey(sourceRow)]) {
      errors.push(
        `Labelled CSV is missing pair ${sourceRow.queryId} + ${sourceRow.investorId}.`,
      );
    }
  });

  args.labelledRows.forEach((labelledRow) => {
    const pair = blindPairKey(labelledRow);
    const sourceRow = sourceIndex[pair];
    if (!sourceRow) {
      errors.push(
        `Labelled CSV contains an unknown pair ${labelledRow.queryId} + ${labelledRow.investorId}.`,
      );
      return;
    }
    evidenceColumns.forEach((column) => {
      if (labelledRow[column] !== sourceRow[column]) {
        errors.push(
          `Pair ${labelledRow.queryId} + ${labelledRow.investorId} changed ${column}.`,
        );
      }
    });
  });

  const queryCounts: Record<string, number> = Object.create(null);
  args.labelledRows.forEach((row) => {
    queryCounts[row.queryId] = (queryCounts[row.queryId] || 0) + 1;
  });
  const queryIds = Object.keys(queryCounts);
  if (
    args.expectedQueryCount !== undefined &&
    queryIds.length !== args.expectedQueryCount
  ) {
    errors.push(
      `Labelled CSV must contain ${args.expectedQueryCount} queries; found ${queryIds.length}.`,
    );
  }
  if (args.expectedRowsPerQuery !== undefined) {
    queryIds.forEach((queryId) => {
      if (queryCounts[queryId] !== args.expectedRowsPerQuery) {
        errors.push(
          `Query ${queryId} must contain ${args.expectedRowsPerQuery} rows; found ${queryCounts[queryId]}.`,
        );
      }
    });
  }

  return { errors, summary: rowValidation.summary };
}
