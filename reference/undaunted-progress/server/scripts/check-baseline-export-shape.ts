import fs from "node:fs/promises";
import path from "node:path";

const expectedSchemaVersion = "baseline-export-v2";

type ExportObject = Record<string, unknown>;

function parseArgs(argv: string[]) {
  let inputPath = "";
  let summaryPath = "";

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--input") {
      inputPath = argv[index + 1] || "";
      index += 1;
      continue;
    }

    if (arg === "--summary") {
      summaryPath = argv[index + 1] || "";
      index += 1;
      continue;
    }

    if (!arg.startsWith("--") && !inputPath) {
      inputPath = arg;
    }
  }

  if (!inputPath) {
    throw new Error("Usage: npm run irp:check-export-shape -- --input <export-json>");
  }

  return { inputPath, summaryPath };
}

function isObject(value: unknown): value is ExportObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasString(object: ExportObject, key: string) {
  return typeof object[key] === "string" && (object[key] as string).trim().length > 0;
}

function hasNumber(object: ExportObject, key: string) {
  return typeof object[key] === "number" && Number.isFinite(object[key]);
}

function hasNumberOrNull(object: ExportObject, key: string) {
  return object[key] === null || hasNumber(object, key);
}

function hasStringOrNull(object: ExportObject, key: string) {
  return object[key] === null || hasString(object, key);
}

function hasBoolean(object: ExportObject, key: string) {
  return typeof object[key] === "boolean";
}

function isParsableDate(value: unknown) {
  return typeof value === "string" && !Number.isNaN(new Date(value).getTime());
}

function isStringArray(value: unknown) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function requireObject(parent: ExportObject, key: string, errors: string[]) {
  const value = parent[key];
  if (!isObject(value)) {
    errors.push(`${key} must be an object.`);
    return {};
  }
  return value;
}

function checkRunSection(run: ExportObject, errors: string[]) {
  if (run.schemaVersion !== expectedSchemaVersion) {
    errors.push(`run.schemaVersion must be ${expectedSchemaVersion}.`);
  }
  if (!hasString(run, "runId")) errors.push("run.runId must be a non-empty string.");
  if (!hasString(run, "createdAt")) errors.push("run.createdAt must be a non-empty string.");
  if (hasString(run, "createdAt") && !isParsableDate(run.createdAt)) {
    errors.push("run.createdAt must be a valid date or ISO timestamp.");
  }
  if (!hasString(run, "source")) errors.push("run.source must be a non-empty string.");
  if (!hasNumber(run, "aiCandidateCount")) errors.push("run.aiCandidateCount must be a number.");
  if (!hasString(run, "aiModel")) errors.push("run.aiModel must be a non-empty string.");
  if (!isObject(run.weights)) errors.push("run.weights must be an object.");
  if (typeof run.dryRun !== "boolean") errors.push("run.dryRun must be a boolean.");
}

function checkInputSection(input: ExportObject, errors: string[]) {
  const fundingRound = requireObject(input, "fundingRound", errors);
  const startup = requireObject(input, "startup", errors);

  if (!hasString(input, "queryId")) {
    errors.push("input.queryId must be a non-empty string.");
  }
  if (!hasString(fundingRound, "id")) errors.push("input.fundingRound.id must be a non-empty string.");
  if (!hasString(fundingRound, "startupId")) {
    errors.push("input.fundingRound.startupId must be a non-empty string.");
  }
  if (!hasString(fundingRound, "startupName")) {
    errors.push("input.fundingRound.startupName must be a non-empty string.");
  }
  if (!hasString(fundingRound, "roundStage")) {
    errors.push("input.fundingRound.roundStage must be a non-empty string.");
  }

  if (!hasString(startup, "id")) errors.push("input.startup.id must be a non-empty string.");
  if (!hasString(startup, "name")) errors.push("input.startup.name must be a non-empty string.");
  if (!hasString(startup, "description")) errors.push("input.startup.description must be a non-empty string.");
  if (
    hasString(fundingRound, "startupId") &&
    hasString(startup, "id") &&
    fundingRound.startupId !== startup.id
  ) {
    errors.push("input.fundingRound.startupId must match input.startup.id.");
  }
}

function checkMatchScores(scores: ExportObject, label: string, errors: string[]) {
  const scoreFields = [
    "stageMatch",
    "ticketSizeMatch",
    "sectorOverlap",
    "geographyMatch",
    "instrumentMatch",
    "semanticScore",
    "totalScore",
  ];

  for (const field of scoreFields) {
    if (!hasNumber(scores, field)) {
      errors.push(`${label}.scores.${field} must be a number.`);
    }
  }
}

function checkProgressRows(progress: unknown[], errors: string[]) {
  progress.forEach((event, index) => {
    if (!isObject(event)) {
      errors.push(`progress[${index}] must be an object.`);
      return;
    }

    const label = `progress[${index}]`;
    if (!hasString(event, "phase")) errors.push(`${label}.phase must be a non-empty string.`);
    if (!hasNumberOrNull(event, "current")) errors.push(`${label}.current must be a number or null.`);
    if (!hasNumberOrNull(event, "total")) errors.push(`${label}.total must be a number or null.`);
    if (!hasString(event, "message")) errors.push(`${label}.message must be a non-empty string.`);
  });
}

function checkMatchRows(matches: unknown[], errors: string[]) {
  matches.forEach((match, index) => {
    if (!isObject(match)) {
      errors.push(`matches[${index}] must be an object.`);
      return;
    }

    const label = `matches[${index}]`;
    if (!hasNumber(match, "rank")) errors.push(`${label}.rank must be a number.`);
    if (hasNumber(match, "rank") && match.rank !== index + 1) {
      errors.push(`${label}.rank must be ${index + 1}.`);
    }

    const investor = requireObject(match, "investor", errors);
    if (!hasString(investor, "id")) errors.push(`${label}.investor.id must be a non-empty string.`);
    if (!hasString(investor, "organisation")) {
      errors.push(`${label}.investor.organisation must be a non-empty string.`);
    }
    for (const field of ["description", "hqLocation", "investmentThesis"]) {
      if (!hasStringOrNull(investor, field)) {
        errors.push(`${label}.investor.${field} must be a string or null.`);
      }
    }

    const scores = requireObject(match, "scores", errors);
    checkMatchScores(scores, label, errors);

    if (!isStringArray(match.matchReasons)) {
      errors.push(`${label}.matchReasons must be an array of strings.`);
    }

    const ai = requireObject(match, "ai", errors);
    if (!hasBoolean(ai, "scored")) errors.push(`${label}.ai.scored must be a boolean.`);
    if (!hasBoolean(ai, "hardExcluded")) errors.push(`${label}.ai.hardExcluded must be a boolean.`);
    if (ai.insight !== undefined && typeof ai.insight !== "string") {
      errors.push(`${label}.ai.insight must be a string when present.`);
    }
  });
}

function checkExportShape(exportBody: unknown) {
  const errors: string[] = [];

  if (!isObject(exportBody)) {
    return ["Export body must be a JSON object."];
  }

  checkRunSection(requireObject(exportBody, "run", errors), errors);
  checkInputSection(requireObject(exportBody, "input", errors), errors);

  if (!Array.isArray(exportBody.progress)) {
    errors.push("progress must be an array.");
  } else {
    checkProgressRows(exportBody.progress, errors);
  }

  if (!Array.isArray(exportBody.matches)) {
    errors.push("matches must be an array.");
  } else {
    checkMatchRows(exportBody.matches, errors);
  }

  return errors;
}

function buildShapeSummary(exportBody: ExportObject, inputPath: string) {
  const run = exportBody.run as ExportObject;
  const progress = exportBody.progress as unknown[];
  const matches = exportBody.matches as unknown[];
  const matchRows = matches.filter(isObject);
  const topMatch = matchRows[0];
  const totalScores = matchRows
    .map(match => (isObject(match.scores) && hasNumber(match.scores, "totalScore") ? match.scores.totalScore : undefined))
    .filter((score): score is number => typeof score === "number");

  return {
    checkedAt: new Date().toISOString(),
    inputPath,
    schemaVersion: run.schemaVersion,
    runId: run.runId,
    source: run.source,
    dryRun: run.dryRun,
    aiCandidateCount: run.aiCandidateCount,
    aiModel: run.aiModel,
    progressCount: progress.length,
    matchCount: matches.length,
    topMatch: topMatch
      ? {
          rank: topMatch.rank,
          investorId: isObject(topMatch.investor) ? topMatch.investor.id : undefined,
          organisation: isObject(topMatch.investor) ? topMatch.investor.organisation : undefined,
          totalScore: isObject(topMatch.scores) ? topMatch.scores.totalScore : undefined,
        }
      : null,
    scoreRange:
      totalScores.length > 0
        ? {
            min: Math.min(...totalScores),
            max: Math.max(...totalScores),
          }
        : null,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const raw = await fs.readFile(args.inputPath, "utf8");
  const exportBody = JSON.parse(raw);
  const errors = checkExportShape(exportBody);

  if (errors.length > 0) {
    console.error("Baseline export shape check failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  if (args.summaryPath && isObject(exportBody)) {
    const summary = buildShapeSummary(exportBody, args.inputPath);
    await fs.mkdir(path.dirname(args.summaryPath), { recursive: true });
    await fs.writeFile(args.summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
    console.log(`Wrote baseline export shape summary to ${args.summaryPath}`);
  }

  console.log(`Baseline export shape check passed for ${args.inputPath}`);
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
