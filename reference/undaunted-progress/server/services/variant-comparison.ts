import { BASELINE_EXPORT_SCHEMA_VERSION } from "./baseline-export";

export type VariantComparisonInput = {
  queryId: string;
  startupId: string;
  fundingRoundId: string;
  matchCount: number;
  topInvestorIds: string[];
};

export type VariantComparisonReadiness = {
  ok: boolean;
  topK: number;
  baseline: VariantComparisonInput;
  variant: VariantComparisonInput;
  sharedTopKCount: number;
  baselineOnlyTopKCount: number;
  variantOnlyTopKCount: number;
  errors: string[];
};

type ComparisonOptions = {
  topK?: number;
  requireFullTopK?: boolean;
};

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

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function duplicateValues(values: string[]): string[] {
  return Array.from(
    new Set(values.filter((value, index) => values.indexOf(value) !== index)),
  );
}

function readExportInput(raw: Record<string, unknown>, label: string) {
  const input = requireObject(raw.input, `${label}.input`);
  const fundingRound = requireObject(
    input.fundingRound,
    `${label}.input.fundingRound`,
  );
  const startup = requireObject(input.startup, `${label}.input.startup`);
  return {
    queryId: requireString(input.queryId, `${label}.input.queryId`),
    startupId: requireString(startup.id, `${label}.input.startup.id`),
    fundingRoundStartupId: requireString(
      fundingRound.startupId,
      `${label}.input.fundingRound.startupId`,
    ),
    fundingRoundId: requireString(
      fundingRound.id,
      `${label}.input.fundingRound.id`,
    ),
  };
}

function readInvestorIds(raw: Record<string, unknown>, label: string): string[] {
  if (!Array.isArray(raw.matches)) {
    throw new Error(`${label}.matches must be an array.`);
  }
  return raw.matches.map((match, index) => {
    const matchObject = requireObject(match, `${label}.matches[${index}]`);
    const investor = requireObject(
      matchObject.investor,
      `${label}.matches[${index}].investor`,
    );
    return requireString(investor.id, `${label}.matches[${index}].investor.id`);
  });
}

function readExportSummary(
  rawExport: unknown,
  label: string,
  topK: number,
): VariantComparisonInput {
  const raw = requireObject(rawExport, label);
  const run = requireObject(raw.run, `${label}.run`);
  const schemaVersion = optionalString(run.schemaVersion);
  if (schemaVersion !== BASELINE_EXPORT_SCHEMA_VERSION) {
    throw new Error(
      `${label}.run.schemaVersion must be ${BASELINE_EXPORT_SCHEMA_VERSION}.`,
    );
  }

  const input = readExportInput(raw, label);
  if (input.fundingRoundStartupId !== input.startupId) {
    throw new Error(
      `${label}.input.fundingRound.startupId must match ${label}.input.startup.id.`,
    );
  }

  const investorIds = readInvestorIds(raw, label);
  const duplicates = duplicateValues(investorIds);
  if (duplicates.length > 0) {
    throw new Error(`${label} contains duplicate investor ids.`);
  }

  return {
    queryId: input.queryId,
    startupId: input.startupId,
    fundingRoundId: input.fundingRoundId,
    matchCount: investorIds.length,
    topInvestorIds: investorIds.slice(0, topK),
  };
}

export function checkVariantComparisonReadiness(
  baselineExport: unknown,
  variantExport: unknown,
  options: ComparisonOptions = {},
): VariantComparisonReadiness {
  const topK = options.topK ?? 10;
  if (!Number.isInteger(topK) || topK <= 0) {
    throw new Error("topK must be a positive integer.");
  }

  const baseline = readExportSummary(baselineExport, "baseline", topK);
  const variant = readExportSummary(variantExport, "variant", topK);
  const errors: string[] = [];

  if (baseline.queryId !== variant.queryId) {
    errors.push("baseline and variant queryId values must match.");
  }
  if (baseline.startupId !== variant.startupId) {
    errors.push("baseline and variant startup ids must match.");
  }
  if (baseline.fundingRoundId !== variant.fundingRoundId) {
    errors.push("baseline and variant funding round ids must match.");
  }
  if (options.requireFullTopK) {
    if (baseline.topInvestorIds.length < topK) {
      errors.push(`baseline export must contain at least ${topK} matches.`);
    }
    if (variant.topInvestorIds.length < topK) {
      errors.push(`variant export must contain at least ${topK} matches.`);
    }
  }

  const variantTopK = new Set(variant.topInvestorIds);
  const baselineTopK = new Set(baseline.topInvestorIds);
  const sharedTopKCount = baseline.topInvestorIds.filter((id) =>
    variantTopK.has(id),
  ).length;
  const baselineOnlyTopKCount = baseline.topInvestorIds.filter(
    (id) => !variantTopK.has(id),
  ).length;
  const variantOnlyTopKCount = variant.topInvestorIds.filter(
    (id) => !baselineTopK.has(id),
  ).length;

  return {
    ok: errors.length === 0,
    topK,
    baseline,
    variant,
    sharedTopKCount,
    baselineOnlyTopKCount,
    variantOnlyTopKCount,
    errors,
  };
}
