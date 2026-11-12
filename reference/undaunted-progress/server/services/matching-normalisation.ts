const STAGE_ALIASES = new Map<string, string>([
  ["pre seed", "Pre-seed"],
  ["seed", "Seed"],
  ["series a", "Series A"],
  ["series b", "Series B"],
  ["post series b", "Post-Series B"],
  ["series c", "Post-Series B"],
  ["series c plus", "Post-Series B"],
  ["growth", "Growth"],
  ["growth stage", "Growth"],
  ["all", "All"],
  ["all stages", "All"],
  ["flexible", "Flexible"],
  ["agnostic", "Agnostic"],
  ["stage agnostic", "Agnostic"],
]);

const INSTRUMENT_ALIASES = new Map<string, string>([
  ["equity", "Equity"],
  ["equity angel", "Equity"],
  ["equity vc", "Equity"],
  ["equity cvc", "Equity"],
  ["equity investment", "Equity"],
  ["venture capital", "Equity"],
  ["convertible", "Convertible Note"],
  ["convertible loan", "Convertible Note"],
  ["convertible note", "Convertible Note"],
  ["safe", "SAFE"],
  ["safe note", "SAFE"],
  ["simple agreement for future equity", "SAFE"],
  ["revenue based finance", "Revenue-Based Financing"],
  ["revenue based financing", "Revenue-Based Financing"],
  ["debt", "Debt"],
  ["loan", "Debt"],
  ["venture debt", "Debt"],
  ["grant", "Grant"],
  ["grants", "Grant"],
  ["grant funding", "Grant"],
]);

const GEOGRAPHY_ALIASES = new Map<string, string>([
  ["uk", "United Kingdom"],
  ["u k", "United Kingdom"],
  ["gb", "United Kingdom"],
  ["great britain", "United Kingdom"],
  ["britain", "United Kingdom"],
  ["england", "United Kingdom"],
  ["united kingdom", "United Kingdom"],
  ["europe", "Europe"],
  ["eu", "Europe"],
  ["europe excl uk", "Europe (excl. UK)"],
  ["europe excluding uk", "Europe (excl. UK)"],
  ["europe ex uk", "Europe (excl. UK)"],
  ["north america", "North America"],
  ["usa", "North America"],
  ["us", "North America"],
  ["u s", "North America"],
  ["united states", "North America"],
  ["united states of america", "North America"],
  ["canada", "North America"],
  ["africa", "Africa"],
  ["asia", "Asia"],
  ["global", "Global"],
  ["worldwide", "Worldwide"],
  ["international", "Global"],
]);

function comparisonKey(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\+/g, " plus ")
    .replace(/[()[\]{}]/g, " ")
    .replace(/[-_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normaliseList(
  values: string[] | undefined,
  normaliseValue: (value: string) => string | undefined,
): string[] | undefined {
  if (!values) return undefined;

  const normalised = values
    .map(normaliseValue)
    .filter((value): value is string => Boolean(value));

  return Array.from(new Set(normalised));
}

export function normaliseFundingStage(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  return STAGE_ALIASES.get(comparisonKey(value)) ?? value.trim().replace(/\s+/g, " ");
}

export function normaliseFundingStages(values: string[] | undefined): string[] | undefined {
  return normaliseList(values, normaliseFundingStage);
}

export function normaliseInvestmentInstrument(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  return INSTRUMENT_ALIASES.get(comparisonKey(value)) ?? value.trim().replace(/\s+/g, " ");
}

export function normaliseInvestmentInstruments(values: string[] | undefined): string[] | undefined {
  return normaliseList(values, normaliseInvestmentInstrument);
}

export function normaliseGeography(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  return GEOGRAPHY_ALIASES.get(comparisonKey(value)) ?? value.trim().replace(/\s+/g, " ");
}

export function normaliseGeographies(values: string[] | undefined): string[] | undefined {
  return normaliseList(values, normaliseGeography);
}
