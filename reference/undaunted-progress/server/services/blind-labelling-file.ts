import { parse } from "csv-parse/sync";
import {
  BLIND_LABELLING_COLUMNS,
  type BlindLabellingRow,
} from "./blind-labelling";

export function blindPairKey(row: BlindLabellingRow): string {
  return `${row.queryId}\u0000${row.investorId}`;
}

export function parseBlindLabellingCsv(
  csv: string,
  label = "CSV",
): BlindLabellingRow[] {
  const records = parse(csv, {
    columns: false,
    skip_empty_lines: true,
  }) as string[][];
  const headers = records[0] || [];
  if (headers.join(",") !== BLIND_LABELLING_COLUMNS.join(",")) {
    throw new Error(`${label} headers do not match the blind column order.`);
  }

  return records.slice(1).map((values, index) => {
    if (values.length !== BLIND_LABELLING_COLUMNS.length) {
      throw new Error(
        `${label} row ${index + 1} has ${values.length} columns; expected ${BLIND_LABELLING_COLUMNS.length}.`,
      );
    }
    return Object.fromEntries(
      BLIND_LABELLING_COLUMNS.map((column, columnIndex) => [
        column,
        values[columnIndex] || "",
      ]),
    ) as BlindLabellingRow;
  });
}
