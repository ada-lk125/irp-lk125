import { describe, expect, it } from "vitest";
import {
  assertFormalStartupEvidenceSufficiency,
  buildFormalBaselineInput,
  populatedFormalStartupEvidenceFields,
  validateFormalQuerySelection,
  validateFormalQuerySourceSnapshot,
} from "./formal-query-input";

const selection = {
  queryId: "query-real-01",
  startupId: "recCompany01",
  fundingRoundId: "recRound01",
};

const validManifest = {
  schemaVersion: "formal-query-selection-v1",
  queries: [
    selection,
    {
      queryId: "query-real-02",
      startupId: "recCompany02",
      fundingRoundId: "recRound02",
    },
    {
      queryId: "query-real-03",
      startupId: "recCompany03",
      fundingRoundId: "recRound03",
    },
  ],
};

describe("formal query input", () => {
  it("requires exactly three queries", () => {
    expect(() =>
      validateFormalQuerySelection({
        schemaVersion: "formal-query-selection-v1",
        queries: validManifest.queries.slice(0, 2),
      }),
    ).toThrow(/exactly 3 queries/);
  });

  it("rejects duplicate query and funding-round identifiers", () => {
    expect(() =>
      validateFormalQuerySelection({
        schemaVersion: "formal-query-selection-v1",
        queries: [selection, selection, selection],
      }),
    ).toThrow(/duplicate queryId/);

    expect(() =>
      validateFormalQuerySelection({
        ...validManifest,
        queries: [
          validManifest.queries[0],
          {
            ...validManifest.queries[1],
            fundingRoundId: validManifest.queries[0].fundingRoundId,
          },
          validManifest.queries[2],
        ],
      }),
    ).toThrow(/duplicate fundingRoundId/);
  });

  it("normalises surrounding whitespace in selected identifiers", () => {
    const queries = validateFormalQuerySelection({
      ...validManifest,
      queries: validManifest.queries.map((query) => ({
        queryId: ` ${query.queryId} `,
        startupId: ` ${query.startupId} `,
        fundingRoundId: ` ${query.fundingRoundId} `,
      })),
    });

    expect(queries).toEqual(validManifest.queries);
  });

  it("maps read-only Airtable records into the baseline input contract", () => {
    const input = buildFormalBaselineInput({
      selection,
      startupRecord: {
        id: "recCompany01",
        fields: {
          Name: "Real Climate Company",
          Description: "A real company description.",
          "Climate Problem": "Industrial emissions.",
          Solution: "Lower-carbon process equipment.",
          "Business Model": "Equipment sales and service contracts.",
        },
      },
      fundingRoundRecord: {
        id: "recRound01",
        fields: {
          Startup: ["recCompany01"],
          "Round Stage": "Seed",
          "Amount Raising": 1_500_000,
          "Min Ticket Size": 50_000,
          "Investment Types": ["Equity"],
          "Round Geography": "United Kingdom",
          "Round Sectors": ["Clean Energy"],
        },
      },
    });

    expect(input).toMatchObject({
      ...selection,
      startupName: "Real Climate Company",
      roundStage: "Seed",
      amountRaising: 1_500_000,
      investmentTypes: ["Equity"],
    });
  });

  it("validates an API-free formal query source snapshot against the selection", () => {
    const inputs = validateFormalQuerySourceSnapshot(
      {
        schemaVersion: "formal-query-source-v1",
        inputs: [...validManifest.queries].reverse().map((query) => ({
          ...query,
          startupName: ` ${query.queryId} company `,
          description: ` ${query.queryId} description `,
          roundStage: " Pre-Seed ",
          amountRaising: 500_000,
          investmentTypes: [" Equity ", "Equity", ""],
        })),
      },
      validManifest.queries,
    );

    expect(inputs.map((input) => input.queryId)).toEqual(
      validManifest.queries.map((query) => query.queryId),
    );
    expect(inputs[0]).toMatchObject({
      ...validManifest.queries[0],
      startupName: "query-real-01 company",
      roundStage: "Pre-Seed",
      investmentTypes: ["Equity"],
    });
  });

  it("rejects source snapshots whose stable ids differ from the selection", () => {
    expect(() =>
      validateFormalQuerySourceSnapshot(
        {
          schemaVersion: "formal-query-source-v1",
          inputs: validManifest.queries.map((query, index) => ({
            ...query,
            fundingRoundId: index === 0 ? "recWrongRound" : query.fundingRoundId,
            startupName: "Company",
            description: "Description",
            roundStage: "Seed",
          })),
        },
        validManifest.queries,
      ),
    ).toThrow(/fundingRoundId does not match/);
  });

  it("checks the agreed formal startup-evidence sufficiency threshold", () => {
    const input = {
      ...selection,
      startupName: "Company",
      description: "Description",
      roundStage: "Pre-Seed",
      climateProblem: "Verified problem.",
      solutionDescription: "Verified solution.",
    };

    expect(populatedFormalStartupEvidenceFields(input)).toEqual([
      "climateProblem",
      "solutionDescription",
    ]);
    expect(() =>
      assertFormalStartupEvidenceSufficiency([input], 2),
    ).not.toThrow();
    expect(() =>
      assertFormalStartupEvidenceSufficiency([input], 3),
    ).toThrow(/businessModel, targetMarket/);
  });

  it("maps the shared startup and fundraising table aliases", () => {
    const input = buildFormalBaselineInput({
      selection,
      startupRecord: {
        id: selection.startupId,
        fields: {
          Company: "Shared Climate Company",
          "Full Description": "A verified description from the shared startup source.",
          Sector: ["Clean Energy"],
        },
      },
      fundingRoundRecord: {
        id: selection.fundingRoundId,
        fields: {
          Companies: [selection.startupId],
          "Fundraising Stage": "Pre-Seed",
          "Target Raise Amount": 900_000,
          "Minimum Ticket Size": 25_000,
          "Funding Instrument": ["Equity"],
          "Target Investor Type": ["Angel", "VC"],
        },
      },
    });

    expect(input).toMatchObject({
      ...selection,
      startupName: "Shared Climate Company",
      description: "A verified description from the shared startup source.",
      roundStage: "Pre-Seed",
      amountRaising: 900_000,
      minTicketSize: 25_000,
      investmentTypes: ["Equity"],
      roundSectors: ["Clean Energy"],
      preferredInvestorTypes: ["Angel", "VC"],
    });
  });

  it("rejects a funding round linked to a different company", () => {
    expect(() =>
      buildFormalBaselineInput({
        selection,
        startupRecord: {
          id: "recCompany01",
          fields: { Name: "Company", Description: "Description" },
        },
        fundingRoundRecord: {
          id: "recRound01",
          fields: { Startup: ["recOtherCompany"], "Round Stage": "Seed" },
        },
      }),
    ).toThrow(/is not linked to Company/);
  });

  it("supports the legacy Airtable field aliases without preferring blanks", () => {
    const input = buildFormalBaselineInput({
      selection,
      startupRecord: {
        id: selection.startupId,
        fields: {
          Name: "   ",
          "Startup Name": "Legacy Climate Company",
          Description: " ",
          "One Sentence Description": "Legacy description.",
          "Climate Problem Tackled": "Industrial emissions.",
          "Target Market Description": "UK manufacturers.",
          "Competitors and Differentiation": "Lower installation cost.",
        },
      },
      fundingRoundRecord: {
        id: selection.fundingRoundId,
        fields: {
          Startup: [selection.startupId],
          "Round Stage": " ",
          "Fundraising Stage": "Pre-seed",
          "Amount Raising (£)": 750_000,
          "Minimum Ticket Size GBP": 25_000,
          "Type of Investment Considered": [" Equity ", "Equity", ""],
          "Round Sectors (Snapshot)": ["Clean Energy"],
        },
      },
    });

    expect(input).toMatchObject({
      startupName: "Legacy Climate Company",
      description: "Legacy description.",
      climateProblem: "Industrial emissions.",
      targetMarket: "UK manufacturers.",
      competitors: "Lower installation cost.",
      roundStage: "Pre-seed",
      amountRaising: 750_000,
      minTicketSize: 25_000,
      investmentTypes: ["Equity"],
      roundSectors: ["Clean Energy"],
    });
  });

  it("rejects fetched records whose ids differ from the selection", () => {
    expect(() =>
      buildFormalBaselineInput({
        selection,
        startupRecord: {
          id: "recUnexpectedCompany",
          fields: { Name: "Company", Description: "Description" },
        },
        fundingRoundRecord: {
          id: selection.fundingRoundId,
          fields: { Startup: [selection.startupId], "Round Stage": "Seed" },
        },
      }),
    ).toThrow(/does not match selection startupId/);
  });
});
