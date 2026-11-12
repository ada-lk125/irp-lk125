import {
  RELEVANCE_VALUES,
  type BlindLabellingRow,
  type RelevanceLabel,
} from "./blind-labelling";

export const HOLD_ERROR_CATEGORIES = ["data_missing", "uncertain"] as const;

export type FrozenLabellingSummary = {
  rowCount: number;
  judgedRowCount: number;
  holdRowCount: number;
  completeQueryCount: number;
  incompleteQueryCount: number;
  incompleteQueryIds: string[];
};

export type FrozenLabellingValidation = {
  errors: string[];
  summary: FrozenLabellingSummary;
};

function isRelevanceLabel(value: string): value is RelevanceLabel {
  return Object.prototype.hasOwnProperty.call(RELEVANCE_VALUES, value);
}

export function validateFrozenLabellingRows(
  rows: readonly BlindLabellingRow[],
): FrozenLabellingValidation {
  const errors: string[] = [];
  const pairs = new Set<string>();
  const queries: Record<string, { rowCount: number; completeRows: number }> =
    Object.create(null);
  let judgedRowCount = 0;
  let holdRowCount = 0;

  rows.forEach((row, index) => {
    const rowNumber = index + 1;
    const stableIds = [
      row.queryId,
      row.startupId,
      row.fundingRoundId,
      row.investorId,
    ];
    if (stableIds.some((value) => value.trim().length === 0)) {
      errors.push(`Row ${rowNumber} has a blank stable identifier.`);
    }

    const pair = `${row.queryId}\u0000${row.investorId}`;
    if (pairs.has(pair)) {
      errors.push(`Row ${rowNumber} repeats a queryId + investorId pair.`);
    }
    pairs.add(pair);

    const queryState = queries[row.queryId] || {
      rowCount: 0,
      completeRows: 0,
    };
    queryState.rowCount += 1;
    queries[row.queryId] = queryState;

    if (row.review_status === "hold") {
      holdRowCount += 1;
      if (row.relevance_label !== "" || row.relevance_value !== "") {
        errors.push(
          `Row ${rowNumber} is on hold but has a relevance label or value.`,
        );
      }
      if (row.uncertainty_note.trim().length === 0) {
        errors.push(`Row ${rowNumber} is on hold without an uncertainty note.`);
      }
      if (
        !(HOLD_ERROR_CATEGORIES as readonly string[]).includes(
          row.error_category,
        )
      ) {
        errors.push(
          `Row ${rowNumber} is on hold but error_category is not data_missing or uncertain.`,
        );
      }
      return;
    }

    if (!isRelevanceLabel(row.relevance_label)) {
      errors.push(`Row ${rowNumber} has an invalid or blank relevance label.`);
      return;
    }

    const expectedValue = String(RELEVANCE_VALUES[row.relevance_label]);
    if (row.relevance_value !== expectedValue) {
      errors.push(
        `Row ${rowNumber} relevance value must be ${expectedValue} for ${row.relevance_label}.`,
      );
      return;
    }
    if (row.review_status !== "" && row.review_status !== "complete") {
      errors.push(
        `Row ${rowNumber} review_status must be blank, complete or hold.`,
      );
      return;
    }

    judgedRowCount += 1;
    queryState.completeRows += 1;
  });

  const queryIds = Object.keys(queries).sort();
  const incompleteQueryIds = queryIds.filter(
    (queryId) => queries[queryId].completeRows !== queries[queryId].rowCount,
  );

  return {
    errors,
    summary: {
      rowCount: rows.length,
      judgedRowCount,
      holdRowCount,
      completeQueryCount: queryIds.length - incompleteQueryIds.length,
      incompleteQueryCount: incompleteQueryIds.length,
      incompleteQueryIds,
    },
  };
}
