import { readFile } from "node:fs/promises";
import {
  BLIND_JUDGEMENT_COLUMNS,
  BLIND_LABELLING_COLUMNS,
  FORBIDDEN_BLIND_COLUMNS,
} from "../services/blind-labelling";
import { projectBlindLabellingRows } from "../services/blind-labelling-projection";

function getInputPath(args: string[]): string {
  const inline = args.find((arg) => arg.startsWith("--input="));
  if (inline) return inline.slice("--input=".length);
  const index = args.indexOf("--input");
  const value = index >= 0 ? args[index + 1] : undefined;
  if (!value || value.startsWith("--")) {
    throw new Error(
      "Usage: tsx check-blind-labelling-projection.ts --input <scored-json>",
    );
  }
  return value;
}

async function main() {
  const inputPath = getInputPath(process.argv.slice(2));
  const source = JSON.parse(await readFile(inputPath, "utf8")) as unknown;
  const rows = projectBlindLabellingRows(source);
  const errors: string[] = [];
  const pairs = new Set<string>();

  rows.forEach((row, index) => {
    const columns = Object.keys(row);
    if (columns.join(",") !== BLIND_LABELLING_COLUMNS.join(",")) {
      errors.push(`row ${index} does not match the fixed column order.`);
    }
    const exposed = columns.filter((column) =>
      (FORBIDDEN_BLIND_COLUMNS as readonly string[]).includes(column),
    );
    if (exposed.length > 0) {
      errors.push(
        `row ${index} exposes forbidden columns: ${exposed.join(", ")}.`,
      );
    }
    if (BLIND_JUDGEMENT_COLUMNS.some((column) => row[column] !== "")) {
      errors.push(`row ${index} has a non-blank judgement field.`);
    }
    const minimumTicket = Number(row.investorMinimumTicketSizeGbp);
    const maximumTicket = Number(row.investorMaximumTicketSizeGbp);
    if (
      row.investorMinimumTicketSizeGbp !== "" &&
      row.investorMaximumTicketSizeGbp !== "" &&
      minimumTicket > maximumTicket
    ) {
      errors.push(`row ${index} has an inverted investor ticket range.`);
    }
    const pair = `${row.queryId}\u0000${row.investorId}`;
    if (pairs.has(pair))
      errors.push(`row ${index} repeats a query-investor pair.`);
    pairs.add(pair);
  });

  if (rows.length === 0) errors.push("projection produced no rows.");
  if (errors.length > 0) {
    console.error("Blind labelling projection check failed.");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Blind labelling projection check passed: ${rows.length} rows.`);
  console.log(`Columns per row: ${BLIND_LABELLING_COLUMNS.length}`);
}

main().catch((error: Error) => {
  console.error(`Blind labelling projection check failed: ${error.message}`);
  process.exit(1);
});
