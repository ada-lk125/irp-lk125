// Alignment between the Airtable application "Climate Sector" taxonomy and the
// investor matching taxonomy used by the Investors table "Sector Focus" field.
//
// Funding round sectors are stored unchanged. This map is applied only before
// the matcher compares startup sectors with investor sectors.

export const APPLICATION_SECTOR_TO_INVESTOR_FOCUS: Record<string, string> = {
  "Sustainable & Renewable Energy": "Power & Renewables",
  "Transport & Mobility": "Transport & Mobility",
  "Built Environment": "Built Environment",
  "Food & Agriculture": "Food & Agriculture",
  "Water & Oceans": "Water & Oceans",
  "Protecting Water": "Water & Oceans",
  "Circular Economy": "Circular Economy",
  "Low Carbon Manufacturing": "Industry, Materials & Manufacturing",
  "Sustainable Materials": "Industry, Materials & Manufacturing",
  "Carbon Capture & Removal": "Carbon Economy",
  "Climate Risk, Data & Finance": "Sustainable Finance",
  "Sustainable Fashion": "Sustainable Fashion",

  // Legacy labels remain as aliases so older profile choices still reach the
  // investor taxonomy used by the matcher.
  "Energy Storage": "Power & Renewables",
  "Circular Economy & Waste": "Circular Economy",
  "Sustainable Agriculture & Food": "Food & Agriculture",
  "Sustainable Transport & Mobility": "Transport & Mobility",
  "Green Buildings & Construction": "Built Environment",
  "Climate Finance & Carbon Markets": "Sustainable Finance",
};

export function mapSectorsToInvestorTaxonomy(
  sectors: string[] | undefined | null,
): string[] {
  if (!sectors || sectors.length === 0) return [];
  const mapped = new Set<string>();
  for (const sector of sectors) {
    const trimmed = (sector || "").trim();
    if (!trimmed) continue;
    mapped.add(APPLICATION_SECTOR_TO_INVESTOR_FOCUS[trimmed] ?? trimmed);
  }
  return Array.from(mapped);
}
