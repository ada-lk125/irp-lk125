import {
  BLIND_LABELLING_COLUMNS,
  BLIND_MULTI_VALUE_SEPARATOR,
  BLIND_TOP_K,
  type BlindLabellingRow,
} from "./blind-labelling";
import { sanitiseBlindRow } from "./blind-labelling-csv";
import { normaliseInvestorTicketRange } from "./airtable";

type JsonObject = Record<string, unknown>;

function requireObject(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as JsonObject;
}

function requireString(object: JsonObject, key: string, label: string): string {
  const value = object[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label}.${key} must be a non-empty string.`);
  }
  return value.trim();
}

function optionalString(
  object: JsonObject,
  key: string,
  label: string,
): string {
  const value = object[key];
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") {
    throw new Error(`${label}.${key} must be a string when present.`);
  }
  return value.trim();
}

function optionalNumber(
  object: JsonObject,
  key: string,
  label: string,
): string {
  const value = object[key];
  if (value === undefined || value === null) return "";
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label}.${key} must be a finite number when present.`);
  }
  return String(value);
}

function optionalStringList(
  object: JsonObject,
  key: string,
  label: string,
): string {
  const value = object[key];
  if (value === undefined || value === null) return "";
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(
      `${label}.${key} must be an array of strings when present.`,
    );
  }
  return value
    .map((item) => item.trim())
    .filter(Boolean)
    .join(BLIND_MULTI_VALUE_SEPARATOR);
}

function blankJudgements() {
  return {
    relevance_label: "",
    relevance_value: "",
    judgement_note: "",
    error_category: "",
    uncertainty_note: "",
    review_status: "",
  } as const;
}

function assertExactColumns(row: BlindLabellingRow) {
  const columns = Object.keys(row);
  if (columns.join(",") !== BLIND_LABELLING_COLUMNS.join(",")) {
    throw new Error("Blind row columns do not match the fixed contract order.");
  }
}

export function projectBlindLabellingRows(
  scoredExport: unknown,
): BlindLabellingRow[] {
  const exportBody = requireObject(scoredExport, "export");
  const input = requireObject(exportBody.input, "export.input");
  const startup = requireObject(input.startup, "export.input.startup");
  const fundingRound = requireObject(
    input.fundingRound,
    "export.input.fundingRound",
  );
  if (!Array.isArray(exportBody.matches)) {
    throw new Error("export.matches must be an array.");
  }

  const queryId = requireString(input, "queryId", "export.input");
  const startupId = requireString(startup, "id", "export.input.startup");
  const startupName = optionalString(startup, "name", "export.input.startup");
  const fundingRoundId = requireString(
    fundingRound,
    "id",
    "export.input.fundingRound",
  );
  const fundingRoundStartupId = requireString(
    fundingRound,
    "startupId",
    "export.input.fundingRound",
  );
  if (fundingRoundStartupId !== startupId) {
    throw new Error("Funding round startupId does not match startup id.");
  }

  const seenPairs = new Set<string>();
  return exportBody.matches.slice(0, BLIND_TOP_K).map((rawMatch, index) => {
    const match = requireObject(rawMatch, `export.matches[${index}]`);
    const investor = requireObject(
      match.investor,
      `export.matches[${index}].investor`,
    );
    const investorLabel = `export.matches[${index}].investor`;
    const investorId = requireString(investor, "id", investorLabel);
    const investorOrganisation = optionalString(
      investor,
      "organisation",
      investorLabel,
    );
    const ticketRange = normaliseInvestorTicketRange(
      typeof investor.minTicketSize === "number"
        ? investor.minTicketSize
        : undefined,
      typeof investor.maxTicketSize === "number"
        ? investor.maxTicketSize
        : undefined,
    );
    const pairId = `${queryId}\u0000${investorId}`;
    if (seenPairs.has(pairId)) {
      throw new Error(
        `Duplicate queryId + investorId pair: ${queryId} + ${investorId}.`,
      );
    }
    seenPairs.add(pairId);

    const row: BlindLabellingRow = {
      queryId,
      startupId,
      fundingRoundId,
      investorId,
      startupDescription: requireString(
        startup,
        "description",
        "export.input.startup",
      ),
      climateProblem: optionalString(
        startup,
        "climateProblem",
        "export.input.startup",
      ),
      solutionDescription: optionalString(
        startup,
        "solutionDescription",
        "export.input.startup",
      ),
      businessModel: optionalString(
        startup,
        "businessModel",
        "export.input.startup",
      ),
      targetMarket: optionalString(
        startup,
        "targetMarket",
        "export.input.startup",
      ),
      roundStage: requireString(
        fundingRound,
        "roundStage",
        "export.input.fundingRound",
      ),
      amountRaisingGbp: optionalNumber(
        fundingRound,
        "amountRaising",
        "export.input.fundingRound",
      ),
      minimumTicketSizeGbp: optionalNumber(
        fundingRound,
        "minTicketSize",
        "export.input.fundingRound",
      ),
      investmentTypes: optionalStringList(
        fundingRound,
        "investmentTypes",
        "export.input.fundingRound",
      ),
      roundGeography: optionalString(
        fundingRound,
        "roundGeography",
        "export.input.fundingRound",
      ),
      roundSectors: optionalStringList(
        fundingRound,
        "roundSectors",
        "export.input.fundingRound",
      ),
      preferredInvestorTypes: optionalStringList(
        fundingRound,
        "preferredInvestorTypes",
        "export.input.fundingRound",
      ),
      tweetPitch: optionalString(
        fundingRound,
        "tweetPitch",
        "export.input.fundingRound",
      ),
      tractionSummary: optionalString(
        fundingRound,
        "tractionSummary",
        "export.input.fundingRound",
      ),
      unfairAdvantage: optionalString(
        fundingRound,
        "unfairAdvantage",
        "export.input.fundingRound",
      ),
      investorType: optionalStringList(investor, "investorType", investorLabel),
      investmentStage: optionalStringList(
        investor,
        "investmentStage",
        investorLabel,
      ),
      sectorFocus: optionalStringList(investor, "sectorFocus", investorLabel),
      subSectors: optionalStringList(investor, "subSectors", investorLabel),
      regionalFocus: optionalStringList(
        investor,
        "regionalFocus",
        investorLabel,
      ),
      hqLocation: optionalString(investor, "hqLocation", investorLabel),
      investorMinimumTicketSizeGbp:
        ticketRange.minTicketSize === undefined
          ? ""
          : String(ticketRange.minTicketSize),
      investorMaximumTicketSizeGbp:
        ticketRange.maxTicketSize === undefined
          ? ""
          : String(ticketRange.maxTicketSize),
      investmentInstruments: optionalStringList(
        investor,
        "investmentInstruments",
        investorLabel,
      ),
      investmentThesis: optionalString(
        investor,
        "investmentThesis",
        investorLabel,
      ),
      investorDescription: optionalString(
        investor,
        "description",
        investorLabel,
      ),
      ...blankJudgements(),
    };
    const sanitisedRow = sanitiseBlindRow(row, [
      startupName,
      optionalString(fundingRound, "startupName", "export.input.fundingRound"),
      investorOrganisation,
    ]);
    assertExactColumns(sanitisedRow);
    return sanitisedRow;
  });
}
