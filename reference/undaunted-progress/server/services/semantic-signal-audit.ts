import type {
  AirtableFundingRound,
  AirtableStartup,
  Investor,
} from "./airtable";
import {
  buildInvestorContextDetails,
  buildStartupContextDetails,
} from "./semantic-context";
import type { MatchingConfig } from "./matching";

export const SEMANTIC_SIGNAL_AUDIT_SCHEMA_VERSION = "semantic-signal-audit-v1";

interface ContextCoverageSummary {
  includedFieldCount: number;
  missingFields: string[];
  sourceLength: number;
  truncated: boolean;
}

export interface SemanticSignalAudit {
  schemaVersion: typeof SEMANTIC_SIGNAL_AUDIT_SCHEMA_VERSION;
  contextCharLimit: number;
  startup: ContextCoverageSummary;
  investors: {
    candidateCount: number;
    emptyContextCount: number;
    truncatedContextCount: number;
    meanSourceLength: number;
    missingFieldCounts: Record<string, number>;
  };
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requireOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  label: string,
) {
  const unexpectedKeys = Object.keys(value).filter(key => !allowedKeys.includes(key));
  if (unexpectedKeys.length > 0) {
    throw new Error(`${label} contains unexpected fields: ${unexpectedKeys.join(", ")}.`);
  }
}

function requireCount(value: unknown, label: string, maximum?: number): number {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
  const count = Number(value);
  if (maximum !== undefined && count > maximum) {
    throw new Error(`${label} must not exceed ${maximum}.`);
  }
  return count;
}

export function validateSemanticSignalAudit(rawAudit: unknown): SemanticSignalAudit {
  const audit = requireObject(rawAudit, "semantic signal audit");
  requireOnlyKeys(
    audit,
    ["schemaVersion", "contextCharLimit", "startup", "investors"],
    "semantic signal audit",
  );
  if (audit.schemaVersion !== SEMANTIC_SIGNAL_AUDIT_SCHEMA_VERSION) {
    throw new Error(
      `semantic signal audit schemaVersion must be ${SEMANTIC_SIGNAL_AUDIT_SCHEMA_VERSION}.`,
    );
  }
  if (!Number.isInteger(audit.contextCharLimit) || Number(audit.contextCharLimit) <= 0) {
    throw new Error("semantic signal audit contextCharLimit must be a positive integer.");
  }

  const startup = requireObject(audit.startup, "semantic signal audit.startup");
  requireOnlyKeys(
    startup,
    ["includedFieldCount", "missingFields", "sourceLength", "truncated"],
    "semantic signal audit.startup",
  );
  const includedFieldCount = requireCount(
    startup.includedFieldCount,
    "semantic signal audit.startup.includedFieldCount",
  );
  if (!Array.isArray(startup.missingFields)
    || startup.missingFields.some(field => typeof field !== "string" || field.length === 0)) {
    throw new Error("semantic signal audit.startup.missingFields must contain field names.");
  }
  const missingFields = startup.missingFields as string[];
  if (new Set(missingFields).size !== missingFields.length) {
    throw new Error("semantic signal audit.startup.missingFields must not contain duplicates.");
  }
  const sourceLength = requireCount(
    startup.sourceLength,
    "semantic signal audit.startup.sourceLength",
  );
  if (typeof startup.truncated !== "boolean") {
    throw new Error("semantic signal audit.startup.truncated must be boolean.");
  }

  const investors = requireObject(audit.investors, "semantic signal audit.investors");
  requireOnlyKeys(
    investors,
    [
      "candidateCount",
      "emptyContextCount",
      "truncatedContextCount",
      "meanSourceLength",
      "missingFieldCounts",
    ],
    "semantic signal audit.investors",
  );
  const candidateCount = requireCount(
    investors.candidateCount,
    "semantic signal audit.investors.candidateCount",
  );
  if (candidateCount === 0) {
    throw new Error("semantic signal audit.investors.candidateCount must be positive.");
  }
  const emptyContextCount = requireCount(
    investors.emptyContextCount,
    "semantic signal audit.investors.emptyContextCount",
    candidateCount,
  );
  const truncatedContextCount = requireCount(
    investors.truncatedContextCount,
    "semantic signal audit.investors.truncatedContextCount",
    candidateCount,
  );
  if (typeof investors.meanSourceLength !== "number"
    || !Number.isFinite(investors.meanSourceLength)
    || investors.meanSourceLength < 0) {
    throw new Error("semantic signal audit.investors.meanSourceLength must be non-negative.");
  }
  const missingFieldCounts = requireObject(
    investors.missingFieldCounts,
    "semantic signal audit.investors.missingFieldCounts",
  );
  const safeMissingFieldCounts: Record<string, number> = {};
  for (const [field, count] of Object.entries(missingFieldCounts)) {
    if (field.length === 0) {
      throw new Error("semantic signal audit missing field names must not be empty.");
    }
    safeMissingFieldCounts[field] = requireCount(
      count,
      `semantic signal audit.investors.missingFieldCounts.${field}`,
      candidateCount,
    );
  }

  return {
    schemaVersion: SEMANTIC_SIGNAL_AUDIT_SCHEMA_VERSION,
    contextCharLimit: Number(audit.contextCharLimit),
    startup: {
      includedFieldCount,
      missingFields: [...missingFields],
      sourceLength,
      truncated: startup.truncated,
    },
    investors: {
      candidateCount,
      emptyContextCount,
      truncatedContextCount,
      meanSourceLength: investors.meanSourceLength,
      missingFieldCounts: safeMissingFieldCounts,
    },
  };
}

function requireCandidatePool(investors: readonly Investor[]) {
  if (investors.length === 0) {
    throw new Error("investors must contain at least one candidate.");
  }

  const investorIds = investors.map((investor, index) => {
    const investorId = investor.id?.trim();
    if (!investorId) {
      throw new Error(`investors[${index}].id must be a non-empty identifier.`);
    }
    return investorId;
  });
  if (new Set(investorIds).size !== investorIds.length) {
    throw new Error("investors must not contain duplicate candidates.");
  }
}

export function buildSemanticSignalAudit(args: {
  startup: AirtableStartup;
  fundingRound: AirtableFundingRound;
  investors: readonly Investor[];
  config: Pick<MatchingConfig, "contextCharLimit">;
}): SemanticSignalAudit {
  requireCandidatePool(args.investors);
  if (!Number.isInteger(args.config.contextCharLimit) || args.config.contextCharLimit <= 0) {
    throw new Error("contextCharLimit must be a positive integer.");
  }

  const contextConfig = { contextCharLimit: args.config.contextCharLimit };
  const startup = buildStartupContextDetails(
    args.startup,
    args.fundingRound,
    contextConfig,
  );
  const investorContexts = args.investors.map(investor =>
    buildInvestorContextDetails(investor, contextConfig),
  );
  const missingFieldCounts: Record<string, number> = {};

  for (const context of investorContexts) {
    for (const field of context.missingFields) {
      missingFieldCounts[field] = (missingFieldCounts[field] ?? 0) + 1;
    }
  }

  const totalSourceLength = investorContexts.reduce(
    (total, context) => total + context.sourceLength,
    0,
  );

  return validateSemanticSignalAudit({
    schemaVersion: SEMANTIC_SIGNAL_AUDIT_SCHEMA_VERSION,
    contextCharLimit: args.config.contextCharLimit,
    startup: {
      includedFieldCount: startup.includedFields.length,
      missingFields: startup.missingFields,
      sourceLength: startup.sourceLength,
      truncated: startup.truncated,
    },
    investors: {
      candidateCount: investorContexts.length,
      emptyContextCount: investorContexts.filter(context => context.sourceLength === 0).length,
      truncatedContextCount: investorContexts.filter(context => context.truncated).length,
      meanSourceLength: Number((totalSourceLength / investorContexts.length).toFixed(2)),
      missingFieldCounts,
    },
  });
}
