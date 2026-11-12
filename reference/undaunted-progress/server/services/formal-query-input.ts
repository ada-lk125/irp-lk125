import type { AirtableRecord } from "./airtable";

export const FORMAL_QUERY_SELECTION_SCHEMA_VERSION =
  "formal-query-selection-v1";
export const FORMAL_QUERY_SOURCE_SCHEMA_VERSION = "formal-query-source-v1";
export const FORMAL_QUERY_COUNT = 3;

export type FormalQuerySelection = {
  queryId: string;
  startupId: string;
  fundingRoundId: string;
};

export type FormalBaselineInput = FormalQuerySelection & {
  startupName: string;
  description: string;
  climateProblem?: string;
  solutionDescription?: string;
  businessModel?: string;
  targetMarket?: string;
  competitors?: string;
  roundStage: string;
  amountRaising?: number;
  minTicketSize?: number;
  investmentTypes?: string[];
  roundGeography?: string;
  roundSectors?: string[];
  tweetPitch?: string;
  tractionSummary?: string;
  unfairAdvantage?: string;
  preferredInvestorTypes?: string[];
};

export const FORMAL_STARTUP_EVIDENCE_FIELDS = [
  "climateProblem",
  "solutionDescription",
  "businessModel",
  "targetMarket",
] as const;

export type FormalStartupEvidenceField =
  (typeof FORMAL_STARTUP_EVIDENCE_FIELDS)[number];

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value.trim();
}

function duplicateValues(values: string[]): string[] {
  return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];
}

function hasFieldValue(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.some(hasFieldValue);
  return value !== undefined && value !== null;
}

function optionalSourceString(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string when present.`);
  }
  return value.trim();
}

function optionalSourceNumber(value: unknown, label: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative finite number when present.`);
  }
  return value;
}

function optionalSourceStrings(value: unknown, label: string): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${label} must be an array of strings when present.`);
  }
  const strings = value
    .map((item) => item.trim())
    .filter(Boolean);
  const uniqueStrings = Array.from(new Set(strings));
  return uniqueStrings.length > 0 ? uniqueStrings : undefined;
}

export function validateFormalQuerySelection(raw: unknown): FormalQuerySelection[] {
  const manifest = requireObject(raw, "Selection manifest");
  if (manifest.schemaVersion !== FORMAL_QUERY_SELECTION_SCHEMA_VERSION) {
    throw new Error(
      `Selection manifest schemaVersion must be ${FORMAL_QUERY_SELECTION_SCHEMA_VERSION}.`,
    );
  }
  if (!Array.isArray(manifest.queries) || manifest.queries.length !== FORMAL_QUERY_COUNT) {
    throw new Error(`Selection manifest must contain exactly ${FORMAL_QUERY_COUNT} queries.`);
  }

  const queries = manifest.queries.map((rawQuery, index) => {
    const query = requireObject(rawQuery, `queries[${index}]`);
    return {
      queryId: requireString(query.queryId, `queries[${index}].queryId`),
      startupId: requireString(query.startupId, `queries[${index}].startupId`),
      fundingRoundId: requireString(
        query.fundingRoundId,
        `queries[${index}].fundingRoundId`,
      ),
    };
  });

  const duplicateQueryIds = duplicateValues(queries.map((query) => query.queryId));
  if (duplicateQueryIds.length > 0) {
    throw new Error(`Selection contains duplicate queryId values: ${duplicateQueryIds.join(", ")}.`);
  }
  const duplicateRoundIds = duplicateValues(
    queries.map((query) => query.fundingRoundId),
  );
  if (duplicateRoundIds.length > 0) {
    throw new Error(
      `Selection contains duplicate fundingRoundId values: ${duplicateRoundIds.join(", ")}.`,
    );
  }

  return queries;
}

export function validateFormalQuerySourceSnapshot(
  raw: unknown,
  selections: readonly FormalQuerySelection[],
): FormalBaselineInput[] {
  const source = requireObject(raw, "Formal query source snapshot");
  if (source.schemaVersion !== FORMAL_QUERY_SOURCE_SCHEMA_VERSION) {
    throw new Error(
      `Formal query source snapshot schemaVersion must be ${FORMAL_QUERY_SOURCE_SCHEMA_VERSION}.`,
    );
  }
  if (!Array.isArray(source.inputs) || source.inputs.length !== selections.length) {
    throw new Error(
      `Formal query source snapshot must contain exactly ${selections.length} inputs.`,
    );
  }

  const parsedInputs = source.inputs.map((rawInput, index) => {
    const input = requireObject(rawInput, `inputs[${index}]`);
    return {
      queryId: requireString(input.queryId, `inputs[${index}].queryId`),
      startupId: requireString(input.startupId, `inputs[${index}].startupId`),
      fundingRoundId: requireString(
        input.fundingRoundId,
        `inputs[${index}].fundingRoundId`,
      ),
      startupName: requireString(input.startupName, `inputs[${index}].startupName`),
      description: requireString(input.description, `inputs[${index}].description`),
      climateProblem: optionalSourceString(
        input.climateProblem,
        `inputs[${index}].climateProblem`,
      ),
      solutionDescription: optionalSourceString(
        input.solutionDescription,
        `inputs[${index}].solutionDescription`,
      ),
      businessModel: optionalSourceString(
        input.businessModel,
        `inputs[${index}].businessModel`,
      ),
      targetMarket: optionalSourceString(
        input.targetMarket,
        `inputs[${index}].targetMarket`,
      ),
      competitors: optionalSourceString(
        input.competitors,
        `inputs[${index}].competitors`,
      ),
      roundStage: requireString(input.roundStage, `inputs[${index}].roundStage`),
      amountRaising: optionalSourceNumber(
        input.amountRaising,
        `inputs[${index}].amountRaising`,
      ),
      minTicketSize: optionalSourceNumber(
        input.minTicketSize,
        `inputs[${index}].minTicketSize`,
      ),
      investmentTypes: optionalSourceStrings(
        input.investmentTypes,
        `inputs[${index}].investmentTypes`,
      ),
      roundGeography: optionalSourceString(
        input.roundGeography,
        `inputs[${index}].roundGeography`,
      ),
      roundSectors: optionalSourceStrings(
        input.roundSectors,
        `inputs[${index}].roundSectors`,
      ),
      tweetPitch: optionalSourceString(
        input.tweetPitch,
        `inputs[${index}].tweetPitch`,
      ),
      tractionSummary: optionalSourceString(
        input.tractionSummary,
        `inputs[${index}].tractionSummary`,
      ),
      unfairAdvantage: optionalSourceString(
        input.unfairAdvantage,
        `inputs[${index}].unfairAdvantage`,
      ),
      preferredInvestorTypes: optionalSourceStrings(
        input.preferredInvestorTypes,
        `inputs[${index}].preferredInvestorTypes`,
      ),
    } satisfies FormalBaselineInput;
  });

  const duplicateQueryIds = duplicateValues(parsedInputs.map((input) => input.queryId));
  if (duplicateQueryIds.length > 0) {
    throw new Error(
      `Formal query source snapshot contains duplicate queryId values: ${duplicateQueryIds.join(", ")}.`,
    );
  }

  const inputsByQueryId = new Map(parsedInputs.map((input) => [input.queryId, input]));
  return selections.map((selection) => {
    const input = inputsByQueryId.get(selection.queryId);
    if (!input) {
      throw new Error(`Formal query source snapshot is missing ${selection.queryId}.`);
    }
    if (input.startupId !== selection.startupId) {
      throw new Error(`${selection.queryId} startupId does not match the selection manifest.`);
    }
    if (input.fundingRoundId !== selection.fundingRoundId) {
      throw new Error(
        `${selection.queryId} fundingRoundId does not match the selection manifest.`,
      );
    }
    return input;
  });
}

export function populatedFormalStartupEvidenceFields(
  input: Pick<FormalBaselineInput, FormalStartupEvidenceField>,
): FormalStartupEvidenceField[] {
  return FORMAL_STARTUP_EVIDENCE_FIELDS.filter((field) => {
    const value = input[field];
    return typeof value === "string" && value.trim().length > 0;
  });
}

export function assertFormalStartupEvidenceSufficiency(
  inputs: readonly FormalBaselineInput[],
  minimumFieldCount: number,
): void {
  if (
    !Number.isInteger(minimumFieldCount) ||
    minimumFieldCount < 1 ||
    minimumFieldCount > FORMAL_STARTUP_EVIDENCE_FIELDS.length
  ) {
    throw new Error(
      `minimumFieldCount must be an integer from 1 to ${FORMAL_STARTUP_EVIDENCE_FIELDS.length}.`,
    );
  }

  const insufficient = inputs.flatMap((input) => {
    const populated = populatedFormalStartupEvidenceFields(input);
    if (populated.length >= minimumFieldCount) return [];
    const missing = FORMAL_STARTUP_EVIDENCE_FIELDS.filter(
      (field) => !populated.includes(field),
    );
    return [
      `${input.queryId} has ${populated.length}/${FORMAL_STARTUP_EVIDENCE_FIELDS.length} populated startup evidence fields; needs at least ${minimumFieldCount}. Missing: ${missing.join(", ")}.`,
    ];
  });

  if (insufficient.length > 0) {
    throw new Error(
      `Formal startup evidence is insufficient:\n${insufficient
        .map((message) => `- ${message}`)
        .join("\n")}`,
    );
  }
}

function firstField(fields: Record<string, unknown>, names: string[]): unknown {
  for (const name of names) {
    const value = fields[name];
    if (hasFieldValue(value)) return value;
  }
  return undefined;
}

function requiredFieldString(
  fields: Record<string, unknown>,
  names: string[],
  label: string,
): string {
  return requireString(firstField(fields, names), label);
}

function optionalFieldString(
  fields: Record<string, unknown>,
  names: string[],
): string | undefined {
  const value = firstField(fields, names);
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function optionalFieldNumber(
  fields: Record<string, unknown>,
  names: string[],
): number | undefined {
  const value = firstField(fields, names);
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function optionalFieldStrings(
  fields: Record<string, unknown>,
  names: string[],
): string[] | undefined {
  const value = firstField(fields, names);
  if (typeof value === "string" && value.trim().length > 0) return [value.trim()];
  if (!Array.isArray(value)) return undefined;
  const strings = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  const uniqueStrings = [...new Set(strings)];
  return uniqueStrings.length > 0 ? uniqueStrings : undefined;
}

export function buildFormalBaselineInput(args: {
  selection: FormalQuerySelection;
  startupRecord: AirtableRecord;
  fundingRoundRecord: AirtableRecord;
}): FormalBaselineInput {
  const { selection, startupRecord, fundingRoundRecord } = args;
  if (startupRecord.id !== selection.startupId) {
    throw new Error(`Fetched Company id does not match selection startupId ${selection.startupId}.`);
  }
  if (fundingRoundRecord.id !== selection.fundingRoundId) {
    throw new Error(
      `Fetched Funding Round id does not match selection fundingRoundId ${selection.fundingRoundId}.`,
    );
  }

  const linkedStartupIds = optionalFieldStrings(fundingRoundRecord.fields, [
    "Startup",
    "Companies",
  ]);
  if (!linkedStartupIds?.includes(selection.startupId)) {
    throw new Error(
      `Funding Round ${selection.fundingRoundId} is not linked to Company ${selection.startupId}.`,
    );
  }

  const startupName = requiredFieldString(
    startupRecord.fields,
    ["Name", "Company Name", "Startup Name", "Organisation", "Company"],
    `Company ${selection.startupId} name`,
  );

  return {
    queryId: selection.queryId,
    startupId: selection.startupId,
    fundingRoundId: selection.fundingRoundId,
    startupName,
    description: requiredFieldString(
      startupRecord.fields,
      [
        "Description",
        "Description ",
        "Company Description",
        "Overview",
        "One Sentence Description",
        "Full Description",
        "One Liner Description",
      ],
      `Company ${selection.startupId} description`,
    ),
    climateProblem: optionalFieldString(startupRecord.fields, [
      "Climate Problem",
      "Climate Problem Tackled",
    ]),
    solutionDescription: optionalFieldString(startupRecord.fields, [
      "Solution Description",
      "Solution",
    ]),
    businessModel: optionalFieldString(startupRecord.fields, ["Business Model"]),
    targetMarket: optionalFieldString(startupRecord.fields, [
      "Target Market",
      "Target Market Description",
    ]),
    competitors: optionalFieldString(startupRecord.fields, [
      "Competitors",
      "Competitors and Differentiation",
    ]),
    roundStage: requiredFieldString(
      fundingRoundRecord.fields,
      ["Round Stage", "Fundraising Stage", "Stage"],
      `Funding Round ${selection.fundingRoundId} stage`,
    ),
    amountRaising: optionalFieldNumber(fundingRoundRecord.fields, [
      "Amount Raising",
      "Amount Raising (£)",
      "Target Raise Amount",
      "Target Raise Amount £",
    ]),
    minTicketSize: optionalFieldNumber(fundingRoundRecord.fields, [
      "Min Ticket Size",
      "Minimum Ticket Size GBP",
      "Minimum Ticket Size",
    ]),
    investmentTypes: optionalFieldStrings(fundingRoundRecord.fields, [
      "Investment Types",
      "Type of Investment Considered",
      "Funding Instrument",
    ]),
    roundGeography: optionalFieldString(fundingRoundRecord.fields, ["Round Geography"]),
    roundSectors:
      optionalFieldStrings(fundingRoundRecord.fields, [
        "Round Sectors",
        "Round Sectors (Snapshot)",
      ]) ?? optionalFieldStrings(startupRecord.fields, ["Sector", "Sub-Sector"]),
    tweetPitch: optionalFieldString(fundingRoundRecord.fields, ["Tweet Pitch"]),
    tractionSummary: optionalFieldString(fundingRoundRecord.fields, ["Traction Summary"]),
    unfairAdvantage: optionalFieldString(fundingRoundRecord.fields, ["Unfair Advantage"]),
    preferredInvestorTypes: optionalFieldStrings(fundingRoundRecord.fields, [
      "Preferred Investor Types",
      "Target Investor Type",
    ]),
  };
}
