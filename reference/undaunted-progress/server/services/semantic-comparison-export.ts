import { access } from "node:fs/promises";
import path from "node:path";
import { toBaselineExportRow } from "./baseline-export";
import {
  SEMANTIC_COMPARISON_SCHEMA_VERSION,
  type SemanticComparisonIdentity,
} from "./semantic-comparison";
import type { SemanticComparisonRun } from "./semantic-comparison-runner";
import {
  semanticExperimentContract,
  type SemanticExperimentMethod,
} from "./semantic-experiment";
import {
  validateSemanticSignalAudit,
  type SemanticSignalAudit,
} from "./semantic-signal-audit";

export const SEMANTIC_COMPARISON_EXPORT_SCHEMA_VERSION =
  "semantic-comparison-export-v1";

type SemanticComparisonExportMatch = ReturnType<typeof toBaselineExportRow>;

export interface SemanticComparisonExport {
  run: {
    schemaVersion: typeof SEMANTIC_COMPARISON_EXPORT_SCHEMA_VERSION;
    runId: string;
    createdAt: string;
    source: string;
    topK: number;
    methods: SemanticExperimentMethod[];
    feedbackMode: "none";
  };
  identity: SemanticComparisonIdentity;
  signalAudit: SemanticSignalAudit;
  methods: Array<{
    method: SemanticExperimentMethod;
    matches: SemanticComparisonExportMatch[];
  }>;
}

export interface SemanticComparisonExportSummary {
  queryId: string;
  startupId: string;
  fundingRoundId: string;
  candidateCount: number;
  candidatePoolHash: string;
  signalAudit: SemanticSignalAudit;
  methodMatchCounts: Record<SemanticExperimentMethod, number>;
}

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

function requireMethodList(value: unknown, label: string): SemanticExperimentMethod[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }
  const methods = value.map((method, index) =>
    requireString(method, `${label}[${index}]`),
  );
  const expected = semanticExperimentContract.methods.map(({ method }) => method);
  if (JSON.stringify(methods) !== JSON.stringify(expected)) {
    throw new Error(`${label} must be ${expected.join(", ")} in that order.`);
  }
  return methods as SemanticExperimentMethod[];
}

function normaliseIsoTimestamp(value?: string): string {
  const parsed = value ? new Date(value) : new Date();
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("createdAt must be a valid date or ISO timestamp.");
  }
  return parsed.toISOString();
}

export function validateSemanticComparisonExport(
  rawExport: unknown,
): SemanticComparisonExportSummary {
  const raw = requireObject(rawExport, "comparison export");
  const run = requireObject(raw.run, "comparison export.run");
  if (run.schemaVersion !== SEMANTIC_COMPARISON_EXPORT_SCHEMA_VERSION) {
    throw new Error(
      `comparison export.run.schemaVersion must be ${SEMANTIC_COMPARISON_EXPORT_SCHEMA_VERSION}.`,
    );
  }
  requireString(run.runId, "comparison export.run.runId");
  requireString(run.createdAt, "comparison export.run.createdAt");
  requireString(run.source, "comparison export.run.source");
  if (run.topK !== semanticExperimentContract.topK) {
    throw new Error(`comparison export.run.topK must be ${semanticExperimentContract.topK}.`);
  }
  requireMethodList(run.methods, "comparison export.run.methods");
  if (run.feedbackMode !== "none") {
    throw new Error("comparison export.run.feedbackMode must be none.");
  }

  const identity = requireObject(raw.identity, "comparison export.identity");
  if (identity.schemaVersion !== SEMANTIC_COMPARISON_SCHEMA_VERSION) {
    throw new Error(
      `comparison export.identity.schemaVersion must be ${SEMANTIC_COMPARISON_SCHEMA_VERSION}.`,
    );
  }
  const queryId = requireString(identity.queryId, "comparison export.identity.queryId");
  const startupId = requireString(
    identity.startupId,
    "comparison export.identity.startupId",
  );
  const fundingRoundId = requireString(
    identity.fundingRoundId,
    "comparison export.identity.fundingRoundId",
  );
  if (!Number.isInteger(identity.candidateCount) || Number(identity.candidateCount) < 10) {
    throw new Error("comparison export.identity.candidateCount must be at least 10.");
  }
  const candidatePoolHash = requireString(
    identity.candidatePoolHash,
    "comparison export.identity.candidatePoolHash",
  );
  if (!/^[a-f0-9]{64}$/.test(candidatePoolHash)) {
    throw new Error("comparison export.identity.candidatePoolHash must be a SHA-256 value.");
  }
  requireMethodList(identity.methods, "comparison export.identity.methods");
  if (identity.feedbackMode !== "none") {
    throw new Error("comparison export.identity.feedbackMode must be none.");
  }
  if (identity.topK !== semanticExperimentContract.topK) {
    throw new Error(`comparison export.identity.topK must be ${semanticExperimentContract.topK}.`);
  }
  if (identity.useSameCandidatePool !== true) {
    throw new Error("comparison export.identity.useSameCandidatePool must be true.");
  }
  if (identity.candidateTieBreak !== semanticExperimentContract.candidateTieBreak) {
    throw new Error(
      `comparison export.identity.candidateTieBreak must be ${semanticExperimentContract.candidateTieBreak}.`,
    );
  }
  const signalAudit = validateSemanticSignalAudit(raw.signalAudit);
  if (signalAudit.investors.candidateCount !== Number(identity.candidateCount)) {
    throw new Error(
      "comparison export signal audit candidate count must match the comparison identity.",
    );
  }

  if (!Array.isArray(raw.methods)) {
    throw new Error("comparison export.methods must be an array.");
  }
  const methodMatchCounts = {} as Record<SemanticExperimentMethod, number>;
  const actualMethods: string[] = [];
  raw.methods.forEach((methodRun, methodIndex) => {
    const methodObject = requireObject(
      methodRun,
      `comparison export.methods[${methodIndex}]`,
    );
    const method = requireString(
      methodObject.method,
      `comparison export.methods[${methodIndex}].method`,
    ) as SemanticExperimentMethod;
    actualMethods.push(method);
    if (!Array.isArray(methodObject.matches)) {
      throw new Error(`comparison export.methods[${methodIndex}].matches must be an array.`);
    }
    if (methodObject.matches.length !== semanticExperimentContract.topK) {
      throw new Error(
        `comparison export method ${method} must contain ${semanticExperimentContract.topK} matches.`,
      );
    }

    const investorIds = methodObject.matches.map((match, matchIndex) => {
      const matchObject = requireObject(
        match,
        `comparison export.methods[${methodIndex}].matches[${matchIndex}]`,
      );
      if (matchObject.rank !== matchIndex + 1) {
        throw new Error(`comparison export method ${method} must use sequential ranks.`);
      }
      const investor = requireObject(
        matchObject.investor,
        `comparison export.methods[${methodIndex}].matches[${matchIndex}].investor`,
      );
      return requireString(
        investor.id,
        `comparison export.methods[${methodIndex}].matches[${matchIndex}].investor.id`,
      );
    });
    if (new Set(investorIds).size !== investorIds.length) {
      throw new Error(`comparison export method ${method} contains duplicate investor ids.`);
    }
    methodMatchCounts[method] = methodObject.matches.length;
  });

  requireMethodList(actualMethods, "comparison export methods");
  return {
    queryId,
    startupId,
    fundingRoundId,
    candidateCount: Number(identity.candidateCount),
    candidatePoolHash,
    signalAudit,
    methodMatchCounts,
  };
}

export function buildSemanticComparisonExport(args: {
  comparison: SemanticComparisonRun;
  runId: string;
  source: string;
  createdAt?: string;
}): SemanticComparisonExport {
  const output: SemanticComparisonExport = {
    run: {
      schemaVersion: SEMANTIC_COMPARISON_EXPORT_SCHEMA_VERSION,
      runId: requireString(args.runId, "runId"),
      createdAt: normaliseIsoTimestamp(args.createdAt),
      source: requireString(args.source, "source"),
      topK: semanticExperimentContract.topK,
      methods: semanticExperimentContract.methods.map(({ method }) => method),
      feedbackMode: "none",
    },
    identity: args.comparison.identity,
    signalAudit: args.comparison.signalAudit,
    methods: args.comparison.methodRuns.map(({ method, matches }) => ({
      method,
      matches: matches.map(toBaselineExportRow),
    })),
  };

  validateSemanticComparisonExport(output);
  return output;
}

export async function assertSemanticComparisonOutputAvailable(
  filePath: string,
  workingDirectory = process.cwd(),
): Promise<string> {
  const exportsRoot = path.resolve(workingDirectory, "exports");
  const resolved = path.resolve(workingDirectory, filePath);
  const relative = path.relative(exportsRoot, resolved);
  const insideExports = relative.length > 0
    && !relative.startsWith("..")
    && !path.isAbsolute(relative);
  if (!insideExports || !path.basename(resolved).endsWith(".local.json")) {
    throw new Error("Comparison output must stay inside exports/ and end with .local.json.");
  }

  try {
    await access(resolved);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return resolved;
    throw error;
  }
  throw new Error(`Comparison output already exists and will not be overwritten: ${filePath}`);
}
