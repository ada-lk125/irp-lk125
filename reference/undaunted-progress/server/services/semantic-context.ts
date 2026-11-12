import type {
  AirtableFundingRound,
  AirtableStartup,
  Investor,
} from "./airtable";

export interface SemanticContextConfig {
  contextCharLimit: number;
}

export interface SemanticContextDetails {
  text: string;
  includedFields: string[];
  missingFields: string[];
  sourceLength: number;
  truncated: boolean;
}

interface ContextPart {
  field: string;
  label: string;
  value: string | undefined;
}

function renderContext(
  parts: ContextPart[],
  config: SemanticContextConfig,
): SemanticContextDetails {
  const includedParts = parts.filter(part => part.value);
  const sourceText = includedParts
    .map(part => `${part.label}: ${part.value}`)
    .join(". ");

  return {
    text: sourceText.slice(0, config.contextCharLimit),
    includedFields: includedParts.map(part => part.field),
    missingFields: parts.filter(part => !part.value).map(part => part.field),
    sourceLength: sourceText.length,
    truncated: sourceText.length > config.contextCharLimit,
  };
}

export function buildStartupContextDetails(
  startup: AirtableStartup,
  round: AirtableFundingRound,
  config: SemanticContextConfig,
): SemanticContextDetails {
  return renderContext(
    [
      { field: "startup.name", label: "Startup", value: startup.name },
      { field: "startup.description", label: "Description", value: startup.description },
      { field: "startup.solutionDescription", label: "Solution", value: startup.solutionDescription },
      { field: "startup.climateProblem", label: "Climate Problem", value: startup.climateProblem },
      { field: "startup.businessModel", label: "Business Model", value: startup.businessModel },
      { field: "startup.targetMarket", label: "Target Market", value: startup.targetMarket },
      { field: "startup.competitors", label: "Competitors", value: startup.competitors },
      { field: "round.tweetPitch", label: "Pitch", value: round.tweetPitch },
      { field: "round.tractionSummary", label: "Traction", value: round.tractionSummary },
      { field: "round.unfairAdvantage", label: "Unfair Advantage", value: round.unfairAdvantage },
      { field: "round.roundGeography", label: "Location", value: round.roundGeography },
      {
        field: "round.roundSectors",
        label: "Sectors",
        value: round.roundSectors?.length ? round.roundSectors.join(", ") : undefined,
      },
      {
        field: "round.preferredInvestorTypes",
        label: "Preferred Investor Types",
        value: round.preferredInvestorTypes?.length
          ? round.preferredInvestorTypes.join(", ")
          : undefined,
      },
    ],
    config,
  );
}

export function buildInvestorContextDetails(
  investor: Investor,
  config: SemanticContextConfig,
): SemanticContextDetails {
  return renderContext(
    [
      { field: "investor.organisation", label: "Organisation", value: investor.organisation },
      { field: "investor.description", label: "Description", value: investor.description },
      { field: "investor.investmentThesis", label: "Thesis", value: investor.investmentThesis },
      {
        field: "investor.sectorFocus",
        label: "Sectors",
        value: investor.sectorFocus?.length ? investor.sectorFocus.join(", ") : undefined,
      },
      {
        field: "investor.subSectors",
        label: "Sub-sectors",
        value: investor.subSectors?.length ? investor.subSectors.join(", ") : undefined,
      },
      { field: "investor.hqLocation", label: "HQ", value: investor.hqLocation },
      {
        field: "investor.regionalFocus",
        label: "Regional Focus",
        value: investor.regionalFocus?.length ? investor.regionalFocus.join(", ") : undefined,
      },
      {
        field: "investor.investorType",
        label: "Type",
        value: investor.investorType?.length ? investor.investorType.join(", ") : undefined,
      },
    ],
    config,
  );
}

export function buildStartupContext(
  startup: AirtableStartup,
  round: AirtableFundingRound,
  config: SemanticContextConfig,
): string {
  return buildStartupContextDetails(startup, round, config).text;
}

export function buildInvestorContext(
  investor: Investor,
  config: SemanticContextConfig,
): string {
  return buildInvestorContextDetails(investor, config).text;
}
