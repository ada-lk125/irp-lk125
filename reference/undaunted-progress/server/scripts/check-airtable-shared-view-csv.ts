import assert from "node:assert/strict";
import { parseSharedInvestorCsv } from "../services/airtable-shared-view";

const header = [
  "Organisation",
  "Record ID",
  "Investment Stage",
  "Minimum Ticket Size GBP",
  "Geographic Regional Focus",
  "Investment Instruments",
].join(",");
const row = [
  "Example Climate VC",
  "recExampleInvestor01",
  '"Pre-Seed, Seed"',
  "25000",
  '"Europe, United Kingdom"',
  '"Equity, SAFE"',
].join(",");
const [investor] = parseSharedInvestorCsv(`${header}\n${row}\n`);
assert.equal(investor.id, "recExampleInvestor01");
assert.equal(investor.minTicketSize, 25_000);
assert.deepEqual(investor.investmentStage, ["Pre-Seed", "Seed"]);
assert.deepEqual(investor.regionalFocus, ["Europe", "United Kingdom"]);
assert.throws(
  () => parseSharedInvestorCsv(`${header}\n${row}\n${row}\n`),
  /repeats Record ID/,
);
console.log("Shared-view investor CSV checks passed.");
