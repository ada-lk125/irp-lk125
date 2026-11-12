import {
  BLIND_JUDGEMENT_COLUMNS,
  BLIND_LABELLING_COLUMNS,
  type BlindLabellingRow,
} from "./blind-labelling";
import { blindPairKey } from "./blind-labelling-file";
import { validateFrozenLabellingFile } from "./frozen-labelling-file";
import { validateFrozenLabellingRows } from "./frozen-labelling";

const evidenceColumns = BLIND_LABELLING_COLUMNS.filter(
  column => !(BLIND_JUDGEMENT_COLUMNS as readonly string[]).includes(column),
);

export function transferFrozenJudgements(args: {
  sourceRows: readonly BlindLabellingRow[];
  frozenLabelSets: readonly {
    label: string;
    rows: readonly BlindLabellingRow[];
  }[];
}): BlindLabellingRow[] {
  if (args.sourceRows.length === 0) {
    throw new Error("Source pack must contain at least one row.");
  }
  const frozenIndex = new Map<string, BlindLabellingRow>();
  for (const labelSet of args.frozenLabelSets) {
    const validation = validateFrozenLabellingRows(labelSet.rows);
    if (validation.errors.length > 0) {
      throw new Error(
        `${labelSet.label} is not a valid frozen label set:\n${validation.errors.join("\n")}`,
      );
    }
    if (
      validation.summary.judgedRowCount !== validation.summary.rowCount
      || validation.summary.holdRowCount !== 0
      || validation.summary.incompleteQueryCount !== 0
    ) {
      throw new Error(`${labelSet.label} must be complete and contain no holds.`);
    }
    for (const row of labelSet.rows) {
      const pair = blindPairKey(row);
      if (frozenIndex.has(pair)) {
        throw new Error(
          `Frozen label sets repeat pair ${row.queryId} + ${row.investorId}.`,
        );
      }
      frozenIndex.set(pair, row);
    }
  }

  const labelledRows = args.sourceRows.map(sourceRow => {
    const frozenRow = frozenIndex.get(blindPairKey(sourceRow));
    if (!frozenRow) {
      throw new Error(
        `No frozen judgement exists for ${sourceRow.queryId} + ${sourceRow.investorId}.`,
      );
    }
    for (const column of evidenceColumns) {
      if (sourceRow[column] !== frozenRow[column]) {
        throw new Error(
          `Pair ${sourceRow.queryId} + ${sourceRow.investorId} changed ${column}.`,
        );
      }
    }
    const labelledRow = { ...sourceRow };
    for (const column of BLIND_JUDGEMENT_COLUMNS) {
      labelledRow[column] = frozenRow[column];
    }
    return labelledRow;
  });

  const validation = validateFrozenLabellingFile({
    sourceRows: args.sourceRows,
    labelledRows,
  });
  if (validation.errors.length > 0) {
    throw new Error(validation.errors.join("\n"));
  }
  return labelledRows;
}
