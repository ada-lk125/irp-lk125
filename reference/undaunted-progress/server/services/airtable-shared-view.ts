import { parse } from "csv-parse/sync";
import {
  normaliseInvestorTicketRange,
  type Investor,
} from "./airtable";

type CsvRow = Record<string, string>;

function firstValue(row: CsvRow, names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = row[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

function parseList(value: string | undefined): string[] {
  if (!value) return [];
  return Array.from(
    new Set(
      value
        .split(/\r?\n|\s*,\s*/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function parseNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const normalised = value.replace(/[^0-9.+-]/g, "");
  if (!normalised) return undefined;
  const parsed = Number(normalised);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function requireRecordId(row: CsvRow, index: number): string {
  const id = firstValue(row, ["Record ID", "Record Id", "recordId"]);
  if (!id || !/^rec[A-Za-z0-9]+$/.test(id)) {
    throw new Error(`Investors CSV row ${index + 1} needs a valid Record ID.`);
  }
  return id;
}

export function parseSharedInvestorCsv(csv: string): Investor[] {
  const rows = parse(csv, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as CsvRow[];
  if (rows.length === 0) {
    throw new Error("Investors CSV contains no records.");
  }

  const seenIds = new Set<string>();
  return rows.map((row, index) => {
    const id = requireRecordId(row, index);
    if (seenIds.has(id)) {
      throw new Error(`Investors CSV repeats Record ID ${id}.`);
    }
    seenIds.add(id);

    const organisation = firstValue(row, ["Organisation", "Organization"]);
    if (!organisation) {
      throw new Error(`Investors CSV row ${index + 1} has no organisation.`);
    }

    const ticketRange = normaliseInvestorTicketRange(
      parseNumber(
        firstValue(row, ["Minimum Ticket Size GBP", "Minimum Ticket Size"]),
      ),
      parseNumber(
        firstValue(row, ["Maximum Ticket Size GBP", "Maximum Ticket Size"]),
      ),
    );

    return {
      id,
      organisation,
      description: firstValue(row, ["Description", "Description "]),
      linkedinUrl: firstValue(row, ["Organisation LinkedIn", "LinkedIn"]),
      websiteUrl: firstValue(row, ["Website URL", "Website"]),
      investorType: parseList(firstValue(row, ["Investor Type"])),
      investmentStage: parseList(firstValue(row, ["Investment Stage"])),
      sectorFocus: parseList(firstValue(row, ["Sector Focus"])),
      subSectors: parseList(firstValue(row, ["Sub-Sectors", "Sub Sectors"])),
      regionalFocus: parseList(
        firstValue(row, ["Geographic Regional Focus", "Regional Focus"]),
      ),
      hqLocation: firstValue(row, ["HQ Location", "HQ Location "]),
      investmentThesis: firstValue(row, [
        "Investment Thesis",
        "Investment Thesis ",
      ]),
      minTicketSize: ticketRange.minTicketSize,
      maxTicketSize: ticketRange.maxTicketSize,
      investmentInstruments: parseList(
        firstValue(row, ["Investment Instruments"]),
      ),
      qualityScore: parseNumber(firstValue(row, ["Investor Quality Score"])),
      qualityTier: firstValue(row, [
        "Investor Quality Tier",
        "Investor Quality Tier ",
      ]),
      connectionStrength: firstValue(row, [
        "Connection Strength (1-5)",
        "Connection Strength",
      ]),
    };
  });
}
