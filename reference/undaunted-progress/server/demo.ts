import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildBaselineMatcherInput,
  validateBaselineExportInput,
  type BaselineExportInput,
} from "./services/baseline-export";
import type { Investor } from "./services/airtable";
import { getDefaultMatchingConfig } from "./services/matching-config";
import {
  normaliseFundingStage,
  normaliseGeography,
  normaliseInvestmentInstruments,
} from "./services/matching-normalisation";
import { runMatching, type MatchResult } from "./services/matching";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clientRoot = path.join(projectRoot, "client");
const investorFixturePath = path.join(
  projectRoot,
  "docs/irp/fixtures/baseline-investors.sample.json",
);
const evidenceSummaryPath = path.join(
  projectRoot,
  "docs/irp/evidence-summary.json",
);
const maximumRequestBytes = 128 * 1024;

const staticFiles = new Map([
  ["/", { path: "index.html", contentType: "text/html; charset=utf-8" }],
  ["/app.js", { path: "app.js", contentType: "text/javascript; charset=utf-8" }],
  ["/styles.css", { path: "styles.css", contentType: "text/css; charset=utf-8" }],
]);

interface DemoInput {
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
  investmentTypes: string[];
  roundGeography: string;
  roundSectors: string[];
  tweetPitch?: string;
  tractionSummary?: string;
  unfairAdvantage?: string;
  preferredInvestorTypes: string[];
}

interface DemoMatch {
  investorId: string;
  organisation: string;
  rank: number;
  totalScore: number;
  scoreBreakdown: MatchResult["scoreBreakdown"];
  matchReasons: string[];
  semanticInsight?: string;
}

let investorFixturePromise: Promise<Investor[]> | undefined;
let evidenceSummaryPromise: Promise<PublicEvidenceSummary> | undefined;

interface PublicEvidenceSummary {
  schemaVersion: "irp-evidence-summary-v3";
  asOf: string;
  evidenceStatus:
    | "awaiting-expert-case-study"
    | "model-assisted-pilot-evaluated"
    | "model-assisted-authoritative-snapshot-evaluated"
    | "expert-case-study-evaluated";
  baseline: {
    queryCount: number;
    labelCount: number;
    macro: {
      precisionAt5: number;
      precisionAt10: number;
      mrr: number;
      ndcgAt10: number;
    };
  };
  comparisonPilot: {
    candidateCount: number;
    semanticModes: {
      label: string;
      top10OverlapByQuery: number[];
    }[];
  };
  finalEvaluation: {
    protocol: "paired-expert-case-study" | "paired-model-assisted-case-study";
    minimumCaseCount: number;
    maximumCaseCount: number;
    completedCaseCount: number;
    topK: number;
    targetReviewerCount: number;
    completedReviewerCount: number;
    investorSnapshotStatus: string;
    reviewStatus: string;
    evidenceLevel:
      | "model-assisted-local-pilot"
      | "model-assisted-authoritative-snapshot"
      | "formal-platform-comparison";
    pooledLabelCount: number;
    metrics: {
      legacy: { precisionAt5: number; precisionAt10: number };
      normalisationV1: { precisionAt5: number; precisionAt10: number };
      delta: { precisionAt5: number; precisionAt10: number };
    };
  };
  claim: string;
}

function sendJson(
  response: ServerResponse,
  statusCode: number,
  body: unknown,
) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(`${JSON.stringify(body)}\n`);
}

function requireText(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} is required.`);
  }
  return value.trim();
}

function optionalText(
  value: unknown,
  field: string,
  maximumLength?: number,
): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new Error(`${field} must be text.`);
  const parsed = value.trim();
  if (!parsed) return undefined;
  if (maximumLength !== undefined && parsed.length > maximumLength) {
    throw new Error(`${field} must be at most ${maximumLength} characters.`);
  }
  return parsed;
}

function optionalPositiveNumber(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${field} must be a positive number.`);
  }
  return parsed;
}

function stringList(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be a list.`);
  }
  const values = value.map((item) => requireText(item, field));
  return Array.from(new Set(values));
}

function parseDemoInput(raw: unknown): DemoInput {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Request body must be an object.");
  }
  const input = raw as Record<string, unknown>;
  return {
    startupName: requireText(input.startupName, "startupName"),
    description: requireText(input.description, "description"),
    climateProblem: optionalText(input.climateProblem, "climateProblem"),
    solutionDescription: optionalText(
      input.solutionDescription,
      "solutionDescription",
    ),
    businessModel: optionalText(input.businessModel, "businessModel"),
    targetMarket: optionalText(input.targetMarket, "targetMarket"),
    competitors: optionalText(input.competitors, "competitors"),
    roundStage: requireText(input.roundStage, "roundStage"),
    amountRaising: optionalPositiveNumber(input.amountRaising, "amountRaising"),
    minTicketSize: optionalPositiveNumber(input.minTicketSize, "minTicketSize"),
    investmentTypes: stringList(input.investmentTypes, "investmentTypes"),
    roundGeography: requireText(input.roundGeography, "roundGeography"),
    roundSectors: stringList(input.roundSectors, "roundSectors"),
    tweetPitch: optionalText(input.tweetPitch, "tweetPitch", 280),
    tractionSummary: optionalText(input.tractionSummary, "tractionSummary"),
    unfairAdvantage: optionalText(input.unfairAdvantage, "unfairAdvantage"),
    preferredInvestorTypes: stringList(
      input.preferredInvestorTypes,
      "preferredInvestorTypes",
    ),
  };
}

async function readRequestJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maximumRequestBytes) {
      throw new Error("Request body is too large.");
    }
    chunks.push(buffer);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text.trim()) throw new Error("Request body is required.");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("Request body must contain valid JSON.");
  }
}

async function loadInvestorFixture(): Promise<Investor[]> {
  investorFixturePromise ??= readFile(investorFixturePath, "utf8").then((text) => {
    const investors = JSON.parse(text) as unknown;
    if (!Array.isArray(investors) || investors.length === 0) {
      throw new Error("The fictional investor fixture is unavailable.");
    }
    return investors as Investor[];
  });
  return investorFixturePromise;
}

function requireNonNegativeInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative integer.`);
  }
  return value;
}

function requireMetric(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${field} must be between 0 and 1.`);
  }
  return value;
}

function requireSignedMetric(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < -1 || value > 1) {
    throw new Error(`${field} must be between -1 and 1.`);
  }
  return value;
}

function parseEvidenceSummary(raw: unknown): PublicEvidenceSummary {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Evidence summary must be an object.");
  }
  const summary = raw as Record<string, unknown>;
  if (summary.schemaVersion !== "irp-evidence-summary-v3") {
    throw new Error("Evidence summary schemaVersion is not recognised.");
  }
  if (
    summary.evidenceStatus !== "awaiting-expert-case-study"
    && summary.evidenceStatus !== "model-assisted-pilot-evaluated"
    && summary.evidenceStatus !== "model-assisted-authoritative-snapshot-evaluated"
    && summary.evidenceStatus !== "expert-case-study-evaluated"
  ) {
    throw new Error("Evidence summary status is not recognised.");
  }
  const baseline = summary.baseline as Record<string, unknown>;
  const macro = baseline?.macro as Record<string, unknown>;
  const comparisonPilot = summary.comparisonPilot as Record<string, unknown>;
  const finalEvaluation = summary.finalEvaluation as Record<string, unknown>;
  const finalMetrics = finalEvaluation?.metrics as Record<string, unknown>;
  const legacyMetrics = finalMetrics?.legacy as Record<string, unknown>;
  const normalisationMetrics = finalMetrics?.normalisationV1 as Record<string, unknown>;
  const deltaMetrics = finalMetrics?.delta as Record<string, unknown>;
  if (
    !baseline
    || !macro
    || !comparisonPilot
    || !finalEvaluation
    || !finalMetrics
    || !legacyMetrics
    || !normalisationMetrics
    || !deltaMetrics
    || !Array.isArray(comparisonPilot.semanticModes)
  ) {
    throw new Error("Evidence summary is missing a required section.");
  }
  const semanticModes = comparisonPilot.semanticModes.map((value, index) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`semanticModes[${index}] must be an object.`);
    }
    const method = value as Record<string, unknown>;
    const top10OverlapByQuery = method.top10OverlapByQuery;
    if (
      typeof method.label !== "string"
      || !Array.isArray(top10OverlapByQuery)
      || top10OverlapByQuery.length !== 3
    ) {
      throw new Error(`semanticModes[${index}] is invalid.`);
    }
    return {
      label: requireText(method.label, `semanticModes[${index}].label`),
      top10OverlapByQuery: top10OverlapByQuery.map((overlap, queryIndex) => {
        const parsed = requireNonNegativeInteger(
          overlap,
          `semanticModes[${index}].top10OverlapByQuery[${queryIndex}]`,
        );
        if (parsed > 10) throw new Error("Top-10 overlap cannot exceed 10.");
        return parsed;
      }),
    };
  });
  return {
    schemaVersion: "irp-evidence-summary-v3",
    asOf: requireText(summary.asOf, "asOf"),
    evidenceStatus: summary.evidenceStatus,
    baseline: {
      queryCount: requireNonNegativeInteger(
        baseline.queryCount,
        "baseline.queryCount",
      ),
      labelCount: requireNonNegativeInteger(
        baseline.labelCount,
        "baseline.labelCount",
      ),
      macro: {
        precisionAt5: requireMetric(macro.precisionAt5, "macro.precisionAt5"),
        precisionAt10: requireMetric(
          macro.precisionAt10,
          "macro.precisionAt10",
        ),
        mrr: requireMetric(macro.mrr, "macro.mrr"),
        ndcgAt10: requireMetric(macro.ndcgAt10, "macro.ndcgAt10"),
      },
    },
    comparisonPilot: {
      candidateCount: requireNonNegativeInteger(
        comparisonPilot.candidateCount,
        "comparisonPilot.candidateCount",
      ),
      semanticModes,
    },
    finalEvaluation: {
      protocol: (() :
        | "paired-expert-case-study"
        | "paired-model-assisted-case-study" => {
        const value = requireText(
          finalEvaluation.protocol,
          "finalEvaluation.protocol",
        );
        if (
          value !== "paired-expert-case-study"
          && value !== "paired-model-assisted-case-study"
        ) {
          throw new Error("finalEvaluation.protocol is not recognised.");
        }
        return value;
      })(),
      minimumCaseCount: requireNonNegativeInteger(
        finalEvaluation.minimumCaseCount,
        "finalEvaluation.minimumCaseCount",
      ),
      maximumCaseCount: requireNonNegativeInteger(
        finalEvaluation.maximumCaseCount,
        "finalEvaluation.maximumCaseCount",
      ),
      completedCaseCount: requireNonNegativeInteger(
        finalEvaluation.completedCaseCount,
        "finalEvaluation.completedCaseCount",
      ),
      topK: requireNonNegativeInteger(
        finalEvaluation.topK,
        "finalEvaluation.topK",
      ),
      targetReviewerCount: requireNonNegativeInteger(
        finalEvaluation.targetReviewerCount,
        "finalEvaluation.targetReviewerCount",
      ),
      completedReviewerCount: requireNonNegativeInteger(
        finalEvaluation.completedReviewerCount,
        "finalEvaluation.completedReviewerCount",
      ),
      investorSnapshotStatus: requireText(
        finalEvaluation.investorSnapshotStatus,
        "finalEvaluation.investorSnapshotStatus",
      ),
      reviewStatus: requireText(
        finalEvaluation.reviewStatus,
        "finalEvaluation.reviewStatus",
      ),
      evidenceLevel: (() => {
        const value = requireText(
          finalEvaluation.evidenceLevel,
          "finalEvaluation.evidenceLevel",
        );
        if (
          value !== "model-assisted-local-pilot"
          && value !== "model-assisted-authoritative-snapshot"
          && value !== "formal-platform-comparison"
        ) {
          throw new Error("finalEvaluation.evidenceLevel is not recognised.");
        }
        return value;
      })(),
      pooledLabelCount: requireNonNegativeInteger(
        finalEvaluation.pooledLabelCount,
        "finalEvaluation.pooledLabelCount",
      ),
      metrics: {
        legacy: {
          precisionAt5: requireMetric(
            legacyMetrics.precisionAt5,
            "finalEvaluation.metrics.legacy.precisionAt5",
          ),
          precisionAt10: requireMetric(
            legacyMetrics.precisionAt10,
            "finalEvaluation.metrics.legacy.precisionAt10",
          ),
        },
        normalisationV1: {
          precisionAt5: requireMetric(
            normalisationMetrics.precisionAt5,
            "finalEvaluation.metrics.normalisationV1.precisionAt5",
          ),
          precisionAt10: requireMetric(
            normalisationMetrics.precisionAt10,
            "finalEvaluation.metrics.normalisationV1.precisionAt10",
          ),
        },
        delta: {
          precisionAt5: requireSignedMetric(
            deltaMetrics.precisionAt5,
            "finalEvaluation.metrics.delta.precisionAt5",
          ),
          precisionAt10: requireSignedMetric(
            deltaMetrics.precisionAt10,
            "finalEvaluation.metrics.delta.precisionAt10",
          ),
        },
      },
    },
    claim: requireText(summary.claim, "claim"),
  };
}

async function loadEvidenceSummary(): Promise<PublicEvidenceSummary> {
  evidenceSummaryPromise ??= readFile(evidenceSummaryPath, "utf8").then(text =>
    parseEvidenceSummary(JSON.parse(text) as unknown),
  );
  return evidenceSummaryPromise;
}

function buildDemoMatcherInput(input: DemoInput) {
  const exportInput: BaselineExportInput = validateBaselineExportInput({
    queryId: "local-demo-query",
    startupId: "local-demo-startup",
    fundingRoundId: "local-demo-round",
    startupName: input.startupName,
    description: input.description,
    climateProblem: input.climateProblem,
    solutionDescription: input.solutionDescription,
    businessModel: input.businessModel,
    targetMarket: input.targetMarket,
    competitors: input.competitors,
    roundStage: input.roundStage,
    amountRaising: input.amountRaising,
    minTicketSize: input.minTicketSize,
    investmentTypes: input.investmentTypes,
    roundGeography: input.roundGeography,
    roundSectors: input.roundSectors,
    tweetPitch: input.tweetPitch,
    tractionSummary: input.tractionSummary,
    unfairAdvantage: input.unfairAdvantage,
    preferredInvestorTypes: input.preferredInvestorTypes,
  });
  return buildBaselineMatcherInput(exportInput);
}

function presentMatches(matches: MatchResult[]): DemoMatch[] {
  return matches.map((match, index) => ({
    investorId: match.investor.id,
    organisation: match.investor.organisation ?? "Unnamed fictional investor",
    rank: index + 1,
    totalScore: match.scoreBreakdown.totalScore,
    scoreBreakdown: match.scoreBreakdown,
    matchReasons: match.matchReasons,
    semanticInsight: match.aiInsight,
  }));
}

export async function compareDemoProfiles(rawInput: unknown) {
  const input = parseDemoInput(rawInput);
  const matcherInput = buildDemoMatcherInput(input);
  const investors = await loadInvestorFixture();
  const defaultConfig = getDefaultMatchingConfig();

  const runProfile = (normalisationProfile: "legacy" | "normalisation-v1") =>
    runMatching(
      matcherInput.fundingRound,
      matcherInput.startup,
      [...investors],
      [],
      investors.length,
      { ...defaultConfig, normalisationProfile },
      undefined,
      { semanticMode: "text-similarity" },
    );

  const [legacyMatches, normalisedMatches] = await Promise.all([
    runProfile("legacy"),
    runProfile("normalisation-v1"),
  ]);
  const baseline = presentMatches(legacyMatches);
  const optimised = presentMatches(normalisedMatches);
  const baselineRank = new Map(
    baseline.map(({ investorId, rank }) => [investorId, rank]),
  );

  return {
    dataset: {
      kind: "fictional",
      investorCount: investors.length,
      semanticMethod: "deterministic local text similarity",
    },
    input,
    normalisedInput: {
      roundStage: normaliseFundingStage(input.roundStage) ?? input.roundStage,
      roundGeography:
        normaliseGeography(input.roundGeography) ?? input.roundGeography,
      investmentTypes:
        normaliseInvestmentInstruments(input.investmentTypes) ??
        input.investmentTypes,
    },
    baseline: {
      label: "Legacy baseline",
      normalisationProfile: "legacy",
      matches: baseline,
    },
    optimised: {
      label: "Normalisation v1",
      normalisationProfile: "normalisation-v1",
      matches: optimised,
    },
    movements: optimised.map((match) => {
      const oldRank = baselineRank.get(match.investorId) ?? match.rank;
      return {
        investorId: match.investorId,
        organisation: match.organisation,
        baselineRank: oldRank,
        optimisedRank: match.rank,
        movement: oldRank - match.rank,
      };
    }),
    evidenceBoundary:
      "This local demonstration proves the code path and input normalisation behaviour on fictional data. It is not evidence of improved real-world ranking quality.",
  };
}

async function serveStatic(pathname: string, response: ServerResponse) {
  const entry = staticFiles.get(pathname);
  if (!entry) {
    sendJson(response, 404, { error: "Not found." });
    return;
  }
  const body = await readFile(path.join(clientRoot, entry.path));
  response.writeHead(200, {
    "content-type": entry.contentType,
    "cache-control": "no-cache",
  });
  response.end(body);
}

export function createDemoServer() {
  return createServer(async (request, response) => {
    try {
      const requestUrl = new URL(
        request.url ?? "/",
        `http://${request.headers.host ?? "127.0.0.1"}`,
      );
      if (request.method === "GET" && requestUrl.pathname === "/api/health") {
        sendJson(response, 200, {
          status: "ok",
          application: "irp-matching-demo",
          dataPolicy: "fictional-fixtures-only",
        });
        return;
      }
      if (request.method === "GET" && requestUrl.pathname === "/api/evidence") {
        sendJson(response, 200, await loadEvidenceSummary());
        return;
      }
      if (request.method === "POST" && requestUrl.pathname === "/api/compare") {
        const comparison = await compareDemoProfiles(
          await readRequestJson(request),
        );
        sendJson(response, 200, comparison);
        return;
      }
      if (request.method === "GET") {
        await serveStatic(requestUrl.pathname, response);
        return;
      }
      sendJson(response, 405, { error: "Method not allowed." });
    } catch (error) {
      sendJson(response, 400, {
        error: error instanceof Error ? error.message : "Request failed.",
      });
    }
  });
}

function configuredPort(): number {
  const parsed = Number(process.env.PORT ?? 4173);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }
  return parsed;
}

const isMainModule =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  const port = configuredPort();
  createDemoServer().listen(port, "127.0.0.1", () => {
    console.log(`IRP matching demo: http://127.0.0.1:${port}`);
  });
}
