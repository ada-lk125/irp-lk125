import {
  BLIND_JUDGEMENT_COLUMNS,
  type BlindLabellingRow,
} from "./blind-labelling";

export type SupplementarySelectionSummary = {
  candidatePairCount: number;
  frozenPairCount: number;
  existingPairCount: number;
  newPairCount: number;
  queryCount: number;
};

export type SupplementarySelection = {
  rows: BlindLabellingRow[];
  summary: SupplementarySelectionSummary;
};

function pairKey(row: BlindLabellingRow): string {
  return `${row.queryId}\u0000${row.investorId}`;
}

function buildUniquePairSet(
  rows: readonly BlindLabellingRow[],
  label: string,
): Set<string> {
  const pairs = new Set<string>();
  rows.forEach((row, index) => {
    if (row.queryId.trim().length === 0 || row.investorId.trim().length === 0) {
      throw new Error(`${label} row ${index + 1} has a blank pair identifier.`);
    }
    const pair = pairKey(row);
    if (pairs.has(pair)) {
      throw new Error(
        `${label} repeats queryId + investorId: ${row.queryId} + ${row.investorId}.`,
      );
    }
    pairs.add(pair);
  });
  return pairs;
}

function blankJudgements(row: BlindLabellingRow): BlindLabellingRow {
  const blankRow = { ...row };
  BLIND_JUDGEMENT_COLUMNS.forEach((column) => {
    blankRow[column] = "";
  });
  return blankRow;
}

export function selectSupplementaryRows(
  candidateRows: readonly BlindLabellingRow[],
  frozenRows: readonly BlindLabellingRow[],
): SupplementarySelection {
  buildUniquePairSet(candidateRows, "Candidate set");
  const frozenPairs = buildUniquePairSet(frozenRows, "Frozen label set");
  const rows = candidateRows
    .filter((row) => !frozenPairs.has(pairKey(row)))
    .map(blankJudgements);
  const queryIds = new Set(rows.map((row) => row.queryId));

  return {
    rows,
    summary: {
      candidatePairCount: candidateRows.length,
      frozenPairCount: frozenRows.length,
      existingPairCount: candidateRows.length - rows.length,
      newPairCount: rows.length,
      queryCount: queryIds.size,
    },
  };
}
