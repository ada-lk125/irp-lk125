import { describe, expect, it } from "vitest";
import { parseSharedInvestorCsv } from "./airtable-shared-view";

const header = [
  "Organisation",
  "Description",
  "Investor Type",
  "Investment Stage",
  "Record ID",
  "Minimum Ticket Size GBP",
  "Maximum Ticket Size GBP",
  "Sector Focus",
  "Sub-Sectors",
  "Geographic Regional Focus",
  "HQ Location",
  "Investment Thesis",
  "Investment Instruments",
  "Investor Quality Score",
  "Investor Quality Tier",
].join(",");

describe("shared Airtable investor CSV", () => {
  it("maps the read-only grid export into the matcher investor shape", () => {
    const csv = `${header}\n"Example Climate VC","Invests in climate, energy and materials","VC Investor, Impact Investor","Pre-Seed, Seed",recExampleInvestor01,"£25,000","£500,000","Clean Energy, Materials",Hydrogen,"Europe, United Kingdom",London,"Backing early climate technologies","Equity, SAFE",87,A\n`;
    const [investor] = parseSharedInvestorCsv(csv);

    expect(investor).toMatchObject({
      id: "recExampleInvestor01",
      organisation: "Example Climate VC",
      investorType: ["VC Investor", "Impact Investor"],
      investmentStage: ["Pre-Seed", "Seed"],
      minTicketSize: 25_000,
      maxTicketSize: 500_000,
      regionalFocus: ["Europe", "United Kingdom"],
      investmentInstruments: ["Equity", "SAFE"],
      qualityScore: 87,
    });
  });

  it("rejects missing and duplicate stable record ids", () => {
    expect(() =>
      parseSharedInvestorCsv(`${header}\nExample,,,,,,,,,,,,,,\n`),
    ).toThrow(/valid Record ID/);

    const row = "Example,,,,recDuplicateInvestor01,,,,,,,,,,";
    expect(() => parseSharedInvestorCsv(`${header}\n${row}\n${row}\n`)).toThrow(
      /repeats Record ID/,
    );
  });

  it("orders reversed ticket bounds without changing the source snapshot", () => {
    const csv = `${header}\n"Reversed Range VC",,,,recReversedRange01,1010000,930000,,,,,,,,\n`;
    const [investor] = parseSharedInvestorCsv(csv);

    expect(investor.minTicketSize).toBe(930_000);
    expect(investor.maxTicketSize).toBe(1_010_000);
  });
});
