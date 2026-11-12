import type {
  AirtableFundingRound,
  AirtableStartup,
  Investor,
} from "../services/airtable";
import {
  buildInvestorContext,
  buildInvestorContextDetails,
  buildStartupContext,
  buildStartupContextDetails,
} from "../services/semantic-context";

function expectEqual(actual: string, expected: string, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}\nExpected: ${expected}\nReceived: ${actual}`);
  }
}

function expectArrayEqual(actual: string[], expected: string[], message: string) {
  expectEqual(JSON.stringify(actual), JSON.stringify(expected), message);
}

function main() {
  const startup: AirtableStartup = {
    id: "startup-sample",
    name: "Sample Climate Systems",
    description: "Builds heat recovery equipment",
    solutionDescription: "Reuses industrial waste heat",
    climateProblem: "Industrial heat loss",
    businessModel: "Equipment sales",
    targetMarket: "UK manufacturers",
    competitors: "Conventional boilers",
  };
  const round: AirtableFundingRound = {
    id: "round-sample",
    tweetPitch: "Turn waste heat into useful energy",
    tractionSummary: "Two paid pilots",
    unfairAdvantage: "Compact retrofit design",
    roundGeography: "United Kingdom",
    roundSectors: ["Energy", "Industrial"],
    preferredInvestorTypes: ["Venture Capital"],
  };
  const investor: Investor = {
    id: "investor-sample",
    organisation: "Sample Climate Fund",
    description: "Invests in industrial decarbonisation",
    investmentThesis: "Backs practical emissions reduction",
    sectorFocus: ["Energy"],
    subSectors: ["Industrial Heat"],
    hqLocation: "London",
    regionalFocus: ["United Kingdom", "Europe"],
    investorType: ["Venture Capital"],
  };

  const startupContext = buildStartupContext(startup, round, { contextCharLimit: 2500 });
  const investorContext = buildInvestorContext(investor, { contextCharLimit: 2500 });
  const startupDetails = buildStartupContextDetails(startup, round, { contextCharLimit: 32 });
  const investorDetails = buildInvestorContextDetails(investor, { contextCharLimit: 32 });

  expectEqual(
    startupContext,
    "Startup: Sample Climate Systems. Description: Builds heat recovery equipment. Solution: Reuses industrial waste heat. Climate Problem: Industrial heat loss. Business Model: Equipment sales. Target Market: UK manufacturers. Competitors: Conventional boilers. Pitch: Turn waste heat into useful energy. Traction: Two paid pilots. Unfair Advantage: Compact retrofit design. Location: United Kingdom. Sectors: Energy, Industrial. Preferred Investor Types: Venture Capital",
    "Startup semantic context changed.",
  );
  expectEqual(
    investorContext,
    "Organisation: Sample Climate Fund. Description: Invests in industrial decarbonisation. Thesis: Backs practical emissions reduction. Sectors: Energy. Sub-sectors: Industrial Heat. HQ: London. Regional Focus: United Kingdom, Europe. Type: Venture Capital",
    "Investor semantic context changed.",
  );
  expectEqual(
    buildStartupContext({ id: "empty-startup" }, { id: "empty-round" }, { contextCharLimit: 2500 }),
    "",
    "Empty startup and round fields should produce empty context.",
  );
  expectEqual(
    buildInvestorContext({ id: "empty-investor" }, { contextCharLimit: 2500 }),
    "",
    "Empty investor fields should produce empty context.",
  );
  expectEqual(
    buildStartupContext(startup, round, { contextCharLimit: 32 }),
    startupContext.slice(0, 32),
    "Startup context limit changed.",
  );
  expectEqual(
    buildInvestorContext(investor, { contextCharLimit: 32 }),
    investorContext.slice(0, 32),
    "Investor context limit changed.",
  );
  expectArrayEqual(
    startupDetails.includedFields,
    [
      "startup.name",
      "startup.description",
      "startup.solutionDescription",
      "startup.climateProblem",
      "startup.businessModel",
      "startup.targetMarket",
      "startup.competitors",
      "round.tweetPitch",
      "round.tractionSummary",
      "round.unfairAdvantage",
      "round.roundGeography",
      "round.roundSectors",
      "round.preferredInvestorTypes",
    ],
    "Startup context field coverage changed.",
  );
  expectArrayEqual(
    investorDetails.includedFields,
    [
      "investor.organisation",
      "investor.description",
      "investor.investmentThesis",
      "investor.sectorFocus",
      "investor.subSectors",
      "investor.hqLocation",
      "investor.regionalFocus",
      "investor.investorType",
    ],
    "Investor context field coverage changed.",
  );
  expectEqual(String(startupDetails.truncated), "true", "Startup truncation flag changed.");
  expectEqual(String(investorDetails.truncated), "true", "Investor truncation flag changed.");
  expectEqual(
    String(startupDetails.sourceLength),
    String(startupContext.length),
    "Startup source length changed.",
  );
  expectEqual(
    String(investorDetails.sourceLength),
    String(investorContext.length),
    "Investor source length changed.",
  );

  const emptyStartupDetails = buildStartupContextDetails(
    { id: "empty-startup" },
    { id: "empty-round" },
    { contextCharLimit: 2500 },
  );
  const emptyInvestorDetails = buildInvestorContextDetails(
    { id: "empty-investor" },
    { contextCharLimit: 2500 },
  );
  expectEqual(String(emptyStartupDetails.missingFields.length), "13", "Startup missing-field count changed.");
  expectEqual(String(emptyInvestorDetails.missingFields.length), "8", "Investor missing-field count changed.");

  console.log("Semantic context check passed.");
  console.log("Checked current field order, coverage metadata, empty inputs, and character limits.");
}

main();
