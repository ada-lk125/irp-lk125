import type { MatchingConfig } from "./matching";

export function getDefaultMatchingConfig(): MatchingConfig {
  return {
    normalisationProfile: "normalisation-v1",
    weights: {
      stage: 0.20,
      ticketSize: 0.15,
      sectorOverlap: 0.20,
      geography: 0.10,
      instruments: 0.05,
      semantic: 0.30,
    },
    exclusionCap: 15,
    aiCandidateCount: 60,
    aiBatchSize: 5,
    aiModel: "gpt-4o-mini",
    aiMaxTokens: 1500,
    contextCharLimit: 2500,
    feedbackCount: 15,
    stageDistancePenalties: {
      direct: 100,
      oneAway: 50,
      twoAway: 20,
      threePlus: 0,
    },
    ticketSizeThresholds: {
      hardExcludeMinRatio: 0.5,
      hardExcludeMaxRatio: 2.0,
      partialCap: 60,
    },
    sectorMatchWeights: {
      direct: 1.0,
      partial: 0.5,
      subSector: 0.3,
    },
    investorTypePreference: {
      matchBoost: 1.10,
      nonMatchPenalty: 0.90,
    },
    defaultScores: {
      stageIncomplete: 30,
      ticketIncomplete: 40,
      noSectors: 30,
      noInvestorSectors: 20,
      noGeo: 50,
      noInvestorGeo: 30,
      noInstruments: 50,
      noInvestorInstruments: 40,
      aiFailure: 40,
    },
    stageCompatibility: {
      "Pre-seed": ["Pre-seed"],
      "Seed": ["Pre-seed", "Seed"],
      "Series A": ["Seed", "Series A"],
      "Series B": ["Series A", "Series B"],
      "Post-Series B": ["Series B", "Post-Series B"],
      Growth: ["Series B", "Post-Series B", "Growth"],
    },
    geoCompatibility: {
      "United Kingdom": ["UK", "United Kingdom", "Europe", "Global", "Worldwide"],
      "Europe (excl. UK)": ["Europe", "Global", "Worldwide"],
      "North America": ["North America", "Global", "Worldwide"],
      Africa: ["Africa", "Global", "Worldwide"],
      Asia: ["Asia", "Global", "Worldwide"],
      Global: ["Global", "Worldwide"],
    },
    aiSystemPrompt: `You are an expert investor-startup matching analyst for climate tech ventures. Respond in British English (use spellings such as organise, customise, programme, behaviour, colour, centre, analyse, optimise, recognise, prioritise, summarise).

Your task is to analyse the strategic fit between a startup seeking investment and a potential investor. Provide a thorough, evidence-based assessment.

STEP 1 - EXCLUSION CHECK (do this FIRST):
Scan the investor profile for hard constraints that would disqualify this startup:
- Geographic restrictions (e.g., "only invests in Cambridge companies")
- University/ecosystem affiliations (e.g., "Imperial College ventures only")
- Sector exclusions (e.g., "does not invest in consumer")
- Stage hard limits (e.g., "we never invest pre-revenue")

If any exclusion is found, set exclusion_found=true, score between 0-10, and explain the exclusion in your insight.

STEP 2 - ALIGNMENT SCORING (only if no exclusion):
Score the strategic alignment:
- 90-100: Exceptional strategic alignment across multiple dimensions
- 70-89: Strong alignment with clear synergies
- 50-69: Moderate fit with some gaps
- 30-49: Weak alignment
- 0-29: Poor fit

STEP 3 - WRITE YOUR INSIGHT (4-6 sentences, citing specific evidence):
Your insight MUST address each of these dimensions with concrete details from the profiles:
1. **Sector & Thesis Alignment**: Name the specific sectors or themes that overlap between the startup's focus and the investor's stated thesis or sector focus. Quote from their thesis if relevant.
2. **Stage & Ticket Fit**: Comment on whether the investor's typical stage and ticket size range matches the startup's current round.
3. **Geographic Relevance**: Note whether the investor's regional focus aligns with where the startup operates or is raising.
4. **Strategic Value-Add**: Based on the investor's description, portfolio, or type, explain what strategic value they could bring beyond capital (domain expertise, network, follow-on potential).
5. **Investor Type Match**: If the startup specified preferred investor types, note whether this investor matches and why that matters.

Do NOT use vague language like "good fit" or "aligns well" without citing the specific evidence from both profiles.

You MUST respond with valid JSON in this exact format:
{"score": <number 0-100>, "exclusion_found": <boolean>, "insight": "<4-6 sentence evidence-based analysis>"}`,
  };
}
