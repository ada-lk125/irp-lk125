import { randomInt } from "node:crypto";
import {
  BLIND_IDENTIFIER_COLUMNS,
  BLIND_JUDGEMENT_COLUMNS,
  BLIND_LABELLING_COLUMNS,
  type BlindLabellingRow,
} from "./blind-labelling";

const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const urlPattern = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function sanitiseBlindText(
  value: string,
  directIdentifiers: readonly string[] = [],
): string {
  let cleaned = value
    .replace(/\r\n?|\n/g, " ")
    .replace(emailPattern, "[email removed]")
    .replace(urlPattern, "[link removed]");

  const identifiers = [...new Set(directIdentifiers.map((item) => item.trim()))]
    .filter((item) => item.length >= 3)
    .sort((left, right) => right.length - left.length);
  for (const identifier of identifiers) {
    cleaned = cleaned.replace(
      new RegExp(escapeRegExp(identifier), "gi"),
      "[name removed]",
    );
  }

  return cleaned.replace(/\s+/g, " ").trim();
}

export function sanitiseBlindRow(
  row: BlindLabellingRow,
  directIdentifiers: readonly string[],
): BlindLabellingRow {
  const unchangedColumns = new Set<string>([
    ...BLIND_IDENTIFIER_COLUMNS,
    ...BLIND_JUDGEMENT_COLUMNS,
  ]);
  return Object.fromEntries(
    BLIND_LABELLING_COLUMNS.map((column) => [
      column,
      unchangedColumns.has(column)
        ? row[column]
        : sanitiseBlindText(row[column], directIdentifiers),
    ]),
  ) as BlindLabellingRow;
}

type PickIndex = (upperExclusive: number) => number;

export function shuffleBlindRows(
  rows: readonly BlindLabellingRow[],
  pickIndex: PickIndex = randomInt,
): BlindLabellingRow[] {
  const shuffled = rows.map((row) => ({ ...row }));
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = pickIndex(index + 1);
    if (!Number.isInteger(swapIndex) || swapIndex < 0 || swapIndex > index) {
      throw new Error(`Shuffle index must be between 0 and ${index}.`);
    }
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }
  return shuffled;
}

function quoteCsvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function serialiseBlindCsv(rows: readonly BlindLabellingRow[]): string {
  if (rows.length === 0) {
    throw new Error("Blind labelling CSV needs at least one row.");
  }

  const lines = [BLIND_LABELLING_COLUMNS.map(quoteCsvCell).join(",")];
  rows.forEach((row, index) => {
    const columns = Object.keys(row);
    if (columns.join(",") !== BLIND_LABELLING_COLUMNS.join(",")) {
      throw new Error(
        `Blind row ${index} does not match the fixed column order.`,
      );
    }
    lines.push(
      BLIND_LABELLING_COLUMNS.map((column) => quoteCsvCell(row[column])).join(
        ",",
      ),
    );
  });

  return `${lines.join("\n")}\n`;
}

export function serialiseBlankBlindCsv(
  rows: readonly BlindLabellingRow[],
): string {
  rows.forEach((row, index) => {
    if (BLIND_JUDGEMENT_COLUMNS.some((column) => row[column] !== "")) {
      throw new Error(
        `Blind row ${index} contains a completed judgement field.`,
      );
    }
  });
  return serialiseBlindCsv(rows);
}
