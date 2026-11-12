import type { Investor, AirtableFundingRound, AirtableStartup } from './airtable';
import OpenAI from 'openai';

export interface MatchResult {
  investor: Investor;
  scoreBreakdown: {
    stageMatch: number;
    ticketSizeMatch: number;
    sectorOverlap: number;
    geographyMatch: number;
    instrumentMatch: number;
    semanticScore: number;
    totalScore: number;
  };
  matchReasons: string[];
  aiInsight?: string;
}

interface FeedbackEntry {
  investorName: string;
  startupName: string;
  reason: string;
  rating: string;
}

interface AIResult {
  score: number;
  exclusion_found: boolean;
  insight: string;
}

export interface MatchingConfig {
  weights: {
    stage: number;
    ticketSize: number;
    sectorOverlap: number;
    geography: number;
    instruments: number;
    semantic: number;
  };
  exclusionCap: number;
  aiCandidateCount: number;
  aiBatchSize: number;
  aiModel: string;
  aiMaxTokens: number;
  contextCharLimit: number;
  feedbackCount: number;
  stageDistancePenalties: {
    direct: number;
    oneAway: number;
    twoAway: number;
    threePlus: number;
  };
  ticketSizeThresholds: {
    hardExcludeMinRatio: number;
    hardExcludeMaxRatio: number;
    partialCap: number;
  };
  sectorMatchWeights: {
    direct: number;
    partial: number;
    subSector: number;
  };
  investorTypePreference: {
    matchBoost: number;
    nonMatchPenalty: number;
  };
  defaultScores: {
    stageIncomplete: number;
    ticketIncomplete: number;
    noSectors: number;
    noInvestorSectors: number;
    noGeo: number;
    noInvestorGeo: number;
    noInstruments: number;
    noInvestorInstruments: number;
    aiFailure: number;
  };
  stageCompatibility: Record<string, string[]>;
  geoCompatibility: Record<string, string[]>;
  aiSystemPrompt: string;
}

const STAGE_ORDER = ['Pre-seed', 'Seed', 'Series A', 'Series B', 'Post-Series B', 'Growth'];

function computeStageMatch(roundStage: string | undefined, investorStages: string[] | undefined, config: MatchingConfig): { score: number; reasons: string[] } {
  const reasons: string[] = [];

  if (!roundStage || !investorStages || investorStages.length === 0) {
    return { score: config.defaultScores.stageIncomplete, reasons: ['Stage data incomplete'] };
  }

  const lowerStages = investorStages.map(s => s.toLowerCase());
  if (lowerStages.some(s => s === 'all' || s === 'flexible' || s === 'agnostic' || s.includes('agnostic'))) {
    reasons.push(`Investor is stage-agnostic`);
    return { score: 90, reasons };
  }

  const compatible = config.stageCompatibility[roundStage];
  if (compatible) {
    const hasMatch = investorStages.some(s => compatible.includes(s));
    if (hasMatch) {
      reasons.push(`Stage alignment: ${roundStage}`);
      return { score: config.stageDistancePenalties.direct, reasons };
    }
  }

  const roundIdx = STAGE_ORDER.indexOf(roundStage);
  if (roundIdx === -1) {
    return { score: config.defaultScores.stageIncomplete, reasons: ['Unknown round stage'] };
  }

  let minDistance = Infinity;
  for (const s of investorStages) {
    const idx = STAGE_ORDER.indexOf(s);
    if (idx !== -1) {
      minDistance = Math.min(minDistance, Math.abs(roundIdx - idx));
    }
  }

  if (minDistance === Infinity) {
    return { score: config.defaultScores.stageIncomplete, reasons: ['Could not determine stage distance'] };
  }

  if (minDistance === 1) {
    reasons.push(`Investor is 1 stage away from ${roundStage}`);
    return { score: config.stageDistancePenalties.oneAway, reasons };
  }
  if (minDistance === 2) {
    reasons.push(`Investor is 2 stages away from ${roundStage}`);
    return { score: config.stageDistancePenalties.twoAway, reasons };
  }

  reasons.push(`Investor is ${minDistance}+ stages away from ${roundStage}`);
  return { score: config.stageDistancePenalties.threePlus, reasons };
}

function computeTicketSizeMatch(
  invMin: number | undefined,
  invMax: number | undefined,
  amountRaising: number | undefined,
  roundMinTicket: number | undefined,
  config: MatchingConfig
): { score: number; reasons: string[] } {
  const reasons: string[] = [];

  if ((!invMin && !invMax) || !amountRaising) {
    return { score: config.defaultScores.ticketIncomplete, reasons: ['Ticket size data incomplete'] };
  }

  const iMin = invMin || 0;
  const iMax = invMax || Infinity;
  const rMin = roundMinTicket || 0;

  if (iMin <= amountRaising && iMax >= rMin) {
    reasons.push(`Ticket size fits: £${iMin.toLocaleString()}-£${iMax === Infinity ? '∞' : iMax.toLocaleString()}`);
    return { score: 100, reasons };
  }

  if (iMax < rMin * config.ticketSizeThresholds.hardExcludeMinRatio) {
    reasons.push('Investor max ticket too small');
    return { score: 0, reasons };
  }

  if (iMin > amountRaising * config.ticketSizeThresholds.hardExcludeMaxRatio) {
    reasons.push('Investor min ticket too large');
    return { score: 0, reasons };
  }

  if (rMin > 0 && iMax < rMin) {
    const ratio = iMax / rMin;
    const score = Math.round(ratio * config.ticketSizeThresholds.partialCap);
    reasons.push(`Partial ticket overlap (investor max below round minimum)`);
    return { score: Math.min(score, config.ticketSizeThresholds.partialCap), reasons };
  }

  if (iMin > amountRaising) {
    const ratio = amountRaising / iMin;
    const score = Math.round(ratio * config.ticketSizeThresholds.partialCap);
    reasons.push(`Partial ticket overlap (investor min above raise amount)`);
    return { score: Math.min(score, config.ticketSizeThresholds.partialCap), reasons };
  }

  return { score: 50, reasons: ['Ticket size partially compatible'] };
}

function computeSectorOverlap(
  roundSectors: string[] | undefined,
  investorSectors: string[] | undefined,
  investorSubSectors: string[] | undefined,
  config: MatchingConfig
): { score: number; reasons: string[] } {
  const reasons: string[] = [];

  if (!roundSectors || roundSectors.length === 0) {
    return { score: config.defaultScores.noSectors, reasons: ['No round sectors specified'] };
  }

  if (!investorSectors || investorSectors.length === 0) {
    return { score: config.defaultScores.noInvestorSectors, reasons: ['No investor sector data'] };
  }

  let totalOverlap = 0;
  const matchedSectors: string[] = [];

  for (const rs of roundSectors) {
    const rsLower = rs.toLowerCase();
    let bestMatch = 0;

    for (const is of investorSectors) {
      const isLower = is.toLowerCase();
      if (rsLower === isLower) {
        bestMatch = Math.max(bestMatch, config.sectorMatchWeights.direct);
      } else if (rsLower.includes(isLower) || isLower.includes(rsLower)) {
        bestMatch = Math.max(bestMatch, config.sectorMatchWeights.partial);
      }
    }

    if (investorSubSectors && bestMatch < config.sectorMatchWeights.direct) {
      for (const sub of investorSubSectors) {
        const subLower = sub.toLowerCase();
        if (rsLower.includes(subLower) || subLower.includes(rsLower)) {
          bestMatch = Math.max(bestMatch, config.sectorMatchWeights.subSector);
        }
      }
    }

    if (bestMatch > 0) {
      matchedSectors.push(rs);
    }
    totalOverlap += bestMatch;
  }

  const score = Math.min(100, Math.round((totalOverlap / roundSectors.length) * 100));

  if (matchedSectors.length > 0) {
    reasons.push(`Sector overlap: ${matchedSectors.join(', ')}`);
  }

  return { score, reasons };
}

function computeGeographyMatch(
  roundGeography: string | undefined,
  investorRegions: string[] | undefined,
  config: MatchingConfig
): { score: number; reasons: string[] } {
  const reasons: string[] = [];

  if (!roundGeography) {
    return { score: config.defaultScores.noGeo, reasons: ['No round geography specified'] };
  }

  if (!investorRegions || investorRegions.length === 0) {
    return { score: config.defaultScores.noInvestorGeo, reasons: ['No investor regional data'] };
  }

  const compatible = config.geoCompatibility[roundGeography];
  if (compatible) {
    const hasMatch = investorRegions.some(r => compatible.includes(r));
    if (hasMatch) {
      reasons.push(`Geography match: ${roundGeography}`);
      return { score: 100, reasons };
    }
  } else {
    const hasDirectMatch = investorRegions.some(r =>
      r.toLowerCase() === roundGeography.toLowerCase() ||
      r.toLowerCase() === 'global' ||
      r.toLowerCase() === 'worldwide'
    );
    if (hasDirectMatch) {
      reasons.push(`Geography match: ${roundGeography}`);
      return { score: 100, reasons };
    }
  }

  reasons.push(`No geographic alignment for ${roundGeography}`);
  return { score: 10, reasons };
}

function computeInstrumentMatch(
  roundInstruments: string[] | undefined,
  investorInstruments: string[] | undefined,
  config: MatchingConfig
): { score: number; reasons: string[] } {
  const reasons: string[] = [];

  if (!roundInstruments || roundInstruments.length === 0) {
    return { score: config.defaultScores.noInstruments, reasons: ['No round instruments specified'] };
  }

  if (!investorInstruments || investorInstruments.length === 0) {
    return { score: config.defaultScores.noInvestorInstruments, reasons: ['No investor instrument data'] };
  }

  const roundLower = roundInstruments.map(i => i.toLowerCase());
  const invLower = investorInstruments.map(i => i.toLowerCase());

  const overlap = roundLower.filter(r => invLower.includes(r));
  const score = Math.round((overlap.length / roundLower.length) * 100);

  if (overlap.length > 0) {
    reasons.push(`Instrument match: ${overlap.join(', ')}`);
  }

  return { score, reasons };
}

function buildStartupContext(startup: AirtableStartup, round: AirtableFundingRound, config: MatchingConfig): string {
  const parts: string[] = [];
  if (startup.name) parts.push(`Startup: ${startup.name}`);
  if (startup.description) parts.push(`Description: ${startup.description}`);
  if (startup.solutionDescription) parts.push(`Solution: ${startup.solutionDescription}`);
  if (startup.climateProblem) parts.push(`Climate Problem: ${startup.climateProblem}`);
  if (startup.businessModel) parts.push(`Business Model: ${startup.businessModel}`);
  if (startup.targetMarket) parts.push(`Target Market: ${startup.targetMarket}`);
  if (startup.competitors) parts.push(`Competitors: ${startup.competitors}`);
  if (round.tweetPitch) parts.push(`Pitch: ${round.tweetPitch}`);
  if (round.tractionSummary) parts.push(`Traction: ${round.tractionSummary}`);
  if (round.unfairAdvantage) parts.push(`Unfair Advantage: ${round.unfairAdvantage}`);
  if (round.roundGeography) parts.push(`Location: ${round.roundGeography}`);
  if (round.roundSectors?.length) parts.push(`Sectors: ${round.roundSectors.join(', ')}`);
  if (round.preferredInvestorTypes?.length) parts.push(`Preferred Investor Types: ${round.preferredInvestorTypes.join(', ')}`);
  return parts.join('. ').slice(0, config.contextCharLimit);
}

function buildInvestorContext(investor: Investor, config: MatchingConfig): string {
  const parts: string[] = [];
  if (investor.organisation) parts.push(`Organisation: ${investor.organisation}`);
  if (investor.description) parts.push(`Description: ${investor.description}`);
  if (investor.investmentThesis) parts.push(`Thesis: ${investor.investmentThesis}`);
  if (investor.sectorFocus?.length) parts.push(`Sectors: ${investor.sectorFocus.join(', ')}`);
  if (investor.subSectors?.length) parts.push(`Sub-sectors: ${investor.subSectors.join(', ')}`);
  if (investor.hqLocation) parts.push(`HQ: ${investor.hqLocation}`);
  if (investor.regionalFocus?.length) parts.push(`Regional Focus: ${investor.regionalFocus.join(', ')}`);
  if (investor.investorType?.length) parts.push(`Type: ${investor.investorType.join(', ')}`);
  return parts.join('. ').slice(0, config.contextCharLimit);
}

function buildFeedbackContext(feedbackEntries: FeedbackEntry[], config: MatchingConfig): string {
  const negatives = feedbackEntries.filter(f => f.rating === 'down' && f.reason).slice(0, config.feedbackCount);
  const positives = feedbackEntries.filter(f => f.rating === 'up' && f.reason).slice(0, config.feedbackCount);

  const parts: string[] = [];

  if (negatives.length > 0) {
    const negLines = negatives.map(
      f => `- Investor "${f.investorName}" was rejected for startup "${f.startupName}". Reason: "${f.reason}"`
    );
    parts.push(`\n\nLEARNING FROM NEGATIVE FEEDBACK:\nThe following investor-startup matches were previously rejected by human reviewers. If the current match has similar characteristics to a previously rejected match, score it lower and mention it in your insight.\n${negLines.join('\n')}`);
  }

  if (positives.length > 0) {
    const posLines = positives.map(
      f => `- Investor "${f.investorName}" was upvoted for startup "${f.startupName}". Reason: "${f.reason}"`
    );
    parts.push(`\n\nLEARNING FROM POSITIVE FEEDBACK:\nThe following investor-startup matches were previously approved by human reviewers. If the current match has similar characteristics to a previously upvoted match, score it higher and mention the similarity in your insight.\n${posLines.join('\n')}`);
  }

  return parts.join('');
}

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  return openaiClient;
}

async function getAIScore(
  startupCtx: string,
  investorCtx: string,
  feedbackContext: string,
  config: MatchingConfig
): Promise<AIResult> {
  if (!startupCtx.trim() || !investorCtx.trim()) {
    return { score: config.defaultScores.aiFailure, exclusion_found: false, insight: 'Insufficient data for semantic analysis' };
  }

  const systemPrompt = `${config.aiSystemPrompt}${feedbackContext}`;
  const userPrompt = `STARTUP:\n${startupCtx}\n\nINVESTOR:\n${investorCtx}`;

  const delays = [0, 1000, 2000];

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (delays[attempt] > 0) {
        await new Promise(resolve => setTimeout(resolve, delays[attempt]));
      }

      const openai = getOpenAI();
      const response = await openai.chat.completions.create({
        model: config.aiModel,
        response_format: { type: 'json_object' },
        max_completion_tokens: config.aiMaxTokens,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });

      const content = response.choices?.[0]?.message?.content;
      if (!content) {
        continue;
      }

      const parsed = JSON.parse(content);
      return {
        score: typeof parsed.score === 'number' ? Math.max(0, Math.min(100, parsed.score)) : config.defaultScores.aiFailure,
        exclusion_found: !!parsed.exclusion_found,
        insight: typeof parsed.insight === 'string' ? parsed.insight : 'No insight provided',
      };
    } catch (e) {
      console.error(`AI scoring attempt ${attempt + 1} failed:`, e);
    }
  }

  return { score: config.defaultScores.aiFailure, exclusion_found: false, insight: 'Unable to perform semantic analysis' };
}

function computeRuleBasedScore(
  investor: Investor,
  round: AirtableFundingRound,
  config: MatchingConfig
): { scores: Omit<MatchResult['scoreBreakdown'], 'semanticScore' | 'totalScore'>; reasons: string[] } {
  const stage = computeStageMatch(round.roundStage, investor.investmentStage, config);
  const ticket = computeTicketSizeMatch(investor.minTicketSize, investor.maxTicketSize, round.amountRaising, round.minTicketSize, config);
  const sector = computeSectorOverlap(round.roundSectors, investor.sectorFocus, investor.subSectors, config);
  const geo = computeGeographyMatch(round.roundGeography, investor.regionalFocus, config);
  const instruments = computeInstrumentMatch(round.investmentTypes || round.instruments, investor.investmentInstruments, config);

  const allReasons = [
    ...stage.reasons,
    ...ticket.reasons,
    ...sector.reasons,
    ...geo.reasons,
    ...instruments.reasons,
  ].filter(r => !r.includes('incomplete') && !r.includes('No '));

  return {
    scores: {
      stageMatch: stage.score,
      ticketSizeMatch: ticket.score,
      sectorOverlap: sector.score,
      geographyMatch: geo.score,
      instrumentMatch: instruments.score,
    },
    reasons: allReasons,
  };
}

function computeWeightedTotal(scores: MatchResult['scoreBreakdown'], config: MatchingConfig): number {
  return Math.round(
    scores.stageMatch * config.weights.stage +
    scores.ticketSizeMatch * config.weights.ticketSize +
    scores.sectorOverlap * config.weights.sectorOverlap +
    scores.geographyMatch * config.weights.geography +
    scores.instrumentMatch * config.weights.instruments +
    scores.semanticScore * config.weights.semantic
  );
}

export interface MatchProgress {
  phase: "filtering" | "ai-scoring" | "finalizing" | "complete" | "error";
  current: number;
  total: number;
  message: string;
}

export async function runMatching(
  fundingRound: AirtableFundingRound,
  startup: AirtableStartup,
  investors: Investor[],
  feedbackEntries?: FeedbackEntry[],
  topN?: number,
  config?: MatchingConfig,
  onProgress?: (progress: MatchProgress) => void
): Promise<MatchResult[]> {
  if (!config) {
    const { getDefaultMatchingConfig } = await import('../storage');
    config = getDefaultMatchingConfig() as MatchingConfig;
  }

  const ruleResults: Array<{
    investor: Investor;
    scores: Omit<MatchResult['scoreBreakdown'], 'semanticScore' | 'totalScore'>;
    reasons: string[];
    ruleScore: number;
    typeMultiplier: number;
  }> = [];

  onProgress?.({ phase: "filtering", current: 0, total: investors.length, message: `Filtering ${investors.length} investors...` });

  const preferredTypes = fundingRound.preferredInvestorTypes;
  const hasTypePreference = preferredTypes && preferredTypes.length > 0;

  for (const investor of investors) {
    const { scores, reasons } = computeRuleBasedScore(investor, fundingRound, config);
    let typeMultiplier = 1;

    if (hasTypePreference) {
      const invTypes = Array.isArray(investor.investorType) ? investor.investorType : investor.investorType ? [investor.investorType] : [];
      const invTypesLower = invTypes.map((t: string) => t.toLowerCase().trim());
      const prefLower = preferredTypes!.map(t => t.toLowerCase().trim());
      const typeMatch = invTypesLower.some((t: string) => prefLower.some(p => t.includes(p) || p.includes(t)));
      if (typeMatch) {
        typeMultiplier = config.investorTypePreference.matchBoost;
        reasons.push(`Matches preferred investor type`);
      } else {
        typeMultiplier = config.investorTypePreference.nonMatchPenalty;
      }
    }

    const ruleScore = (
      scores.stageMatch * config.weights.stage +
      scores.ticketSizeMatch * config.weights.ticketSize +
      scores.sectorOverlap * config.weights.sectorOverlap +
      scores.geographyMatch * config.weights.geography +
      scores.instrumentMatch * config.weights.instruments
    ) * typeMultiplier;

    ruleResults.push({ investor, scores, reasons, ruleScore, typeMultiplier });
  }

  ruleResults.sort((a, b) => b.ruleScore - a.ruleScore);
  onProgress?.({ phase: "filtering", current: investors.length, total: investors.length, message: `Filtered to top candidates` });

  let aiCandidateCount: number;
  if (topN) {
    aiCandidateCount = Math.min(topN * 3, 50);
  } else {
    aiCandidateCount = config.aiCandidateCount;
  }

  const aiCandidates = ruleResults.slice(0, Math.min(aiCandidateCount, ruleResults.length));
  const remainingCandidates = ruleResults.slice(aiCandidates.length);

  const startupCtx = buildStartupContext(startup, fundingRound, config);
  const feedbackContext = feedbackEntries ? buildFeedbackContext(feedbackEntries, config) : '';

  const aiResults: Map<number, AIResult> = new Map();
  const totalBatches = Math.ceil(aiCandidates.length / config.aiBatchSize);

  for (let i = 0; i < aiCandidates.length; i += config.aiBatchSize) {
    const batchNum = Math.floor(i / config.aiBatchSize) + 1;
    onProgress?.({ phase: "ai-scoring", current: batchNum - 1, total: totalBatches, message: `AI scoring batch ${batchNum} of ${totalBatches}...` });

    const batch = aiCandidates.slice(i, i + config.aiBatchSize);
    const promises = batch.map(async (candidate, batchIdx) => {
      const investorCtx = buildInvestorContext(candidate.investor, config!);
      const result = await getAIScore(startupCtx, investorCtx, feedbackContext, config!);
      aiResults.set(i + batchIdx, result);
    });
    await Promise.all(promises);
  }

  onProgress?.({ phase: "finalizing", current: totalBatches, total: totalBatches, message: "Finalising results..." });

  const matchResults: MatchResult[] = [];

  for (let i = 0; i < aiCandidates.length; i++) {
    const candidate = aiCandidates[i];
    const aiResult = aiResults.get(i) || { score: config.defaultScores.aiFailure, exclusion_found: false, insight: 'Unable to perform semantic analysis' };

    const scoreBreakdown: MatchResult['scoreBreakdown'] = {
      ...candidate.scores,
      semanticScore: aiResult.score,
      totalScore: 0,
    };

    scoreBreakdown.totalScore = Math.round(computeWeightedTotal(scoreBreakdown, config) * candidate.typeMultiplier);

    let insight = aiResult.insight;
    if (aiResult.exclusion_found) {
      insight = `[EXCLUSION] ${insight}`;
      scoreBreakdown.totalScore = Math.min(scoreBreakdown.totalScore, config.exclusionCap);
    }

    matchResults.push({
      investor: candidate.investor,
      scoreBreakdown,
      matchReasons: candidate.reasons,
      aiInsight: insight,
    });
  }

  for (const candidate of remainingCandidates) {
    const scoreBreakdown: MatchResult['scoreBreakdown'] = {
      ...candidate.scores,
      semanticScore: 0,
      totalScore: 0,
    };
    scoreBreakdown.totalScore = Math.round(computeWeightedTotal(scoreBreakdown, config) * candidate.typeMultiplier);

    matchResults.push({
      investor: candidate.investor,
      scoreBreakdown,
      matchReasons: candidate.reasons,
    });
  }

  matchResults.sort((a, b) => b.scoreBreakdown.totalScore - a.scoreBreakdown.totalScore);

  return matchResults;
}
