import assert from "node:assert/strict";
import type {
  AirtableFundingRound,
  AirtableStartup,
  Investor,
} from "../services/airtable";
import {
  buildSemanticSignalAudit,
  SEMANTIC_SIGNAL_AUDIT_SCHEMA_VERSION,
  validateSemanticSignalAudit,
} from "../services/semantic-signal-audit";

const startup: AirtableStartup = {
  id: "startup-audit-check",
  name: "Audit Check",
  description: "Repairs industrial heat losses",
  climateProblem: "Wasted process heat",
};
const fundingRound: AirtableFundingRound = {
  id: "round-audit-check",
  roundGeography: "United Kingdom",
  roundSectors: ["Energy"],
};
const investors: Investor[] = [
  {
    id: "investor-audit-01",
    organisation: "Industrial Climate Fund",
    description: "Invests in industrial efficiency",
    investmentThesis: "Backs measurable emissions reductions",
    sectorFocus: ["Energy"],
  },
  {
    id: "investor-audit-02",
    organisation: "Early Climate Capital",
    description: "Seed investor in climate software and hardware",
  },
  { id: "investor-audit-03" },
];

function main() {
  const audit = buildSemanticSignalAudit({
    startup,
    fundingRound,
    investors,
    config: { contextCharLimit: 70 },
  });

  assert.equal(audit.schemaVersion, SEMANTIC_SIGNAL_AUDIT_SCHEMA_VERSION);
  assert.equal(audit.contextCharLimit, 70);
  assert.equal(audit.startup.includedFieldCount, 5);
  assert.equal(audit.startup.truncated, true);
  assert.equal(audit.investors.candidateCount, 3);
  assert.equal(audit.investors.emptyContextCount, 1);
  assert.equal(audit.investors.truncatedContextCount, 2);
  assert.equal(audit.investors.missingFieldCounts["investor.investmentThesis"], 2);
  assert.equal(audit.investors.missingFieldCounts["investor.regionalFocus"], 3);

  const publicAudit = JSON.stringify(audit);
  assert.equal(publicAudit.includes("industrial efficiency"), false);
  assert.equal(publicAudit.includes("investor-audit-01"), false);
  assert.throws(
    () =>
      buildSemanticSignalAudit({
        startup,
        fundingRound,
        investors: [investors[0], investors[0]],
        config: { contextCharLimit: 2500 },
      }),
    /duplicate candidates/,
  );
  assert.throws(
    () =>
      buildSemanticSignalAudit({
        startup,
        fundingRound,
        investors,
        config: { contextCharLimit: 0 },
      }),
    /positive integer/,
  );
  const invalidAudit = structuredClone(audit);
  invalidAudit.investors.emptyContextCount = investors.length + 1;
  assert.throws(
    () => validateSemanticSignalAudit(invalidAudit),
    /must not exceed 3/,
  );
  const auditWithPrivateField = structuredClone(audit) as unknown as {
    startup: Record<string, unknown>;
  };
  auditWithPrivateField.startup.rawText = "Private startup context";
  assert.throws(
    () => validateSemanticSignalAudit(auditWithPrivateField),
    /unexpected fields: rawText/,
  );

  console.log("Semantic signal audit check passed.");
  console.log("Checked field coverage, empty contexts, truncation, and private-value omission.");
}

main();
