import { createHash, randomUUID } from "node:crypto";
import { access, link, mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  FINAL_MATCHER_HANDOFF_SCHEMA_VERSION,
  type FinalMatcherHandoff,
  type FinalMatcherMethod,
} from "./final-matcher-handoff";
import {
  validateFinalMatcherRouteResult,
  type FinalMatcherRouteResult,
} from "./final-matcher-route-result";

export const FINAL_RANKING_MOVEMENT_SCHEMA_VERSION =
  "final-ranking-movement-v1";

export type RankingMovement =
  | "up"
  | "down"
  | "same"
  | "entered"
  | "left";

export interface FinalRankingMovementRow {
  investorAlias: string;
  baselineRank: number | null;
  selectedRank: number | null;
  movement: RankingMovement;
}

export interface FinalRankingMovementManifest {
  schemaVersion: typeof FINAL_RANKING_MOVEMENT_SCHEMA_VERSION;
  createdAt: string;
  queryAlias: string;
  selectedMethod: FinalMatcherMethod;
  aiModel: string;
  matchingConfigHash: string;
  feedbackSetHash: string;
  implementationCommitSha: string;
  topN: number;
  candidatePoolHash: string;
  sources: {
    baseline: { fileName: string; sha256: string };
    selected: { fileName: string; sha256: string };
    handoff: { fileName: string; sha256: string };
  };
  summary: {
    up: number;
    down: number;
    same: number;
    entered: number;
    left: number;
  };
  rows: FinalRankingMovementRow[];
  svg: { fileName: string; sha256: string };
}

export interface FinalRankingMovementVisualisation {
  svg: string;
  manifest: FinalRankingMovementManifest;
}

interface SourceFile {
  fileName: string;
  sha256: string;
}

const MOVEMENT_COLOURS: Record<RankingMovement, string> = {
  up: "#15803d",
  down: "#b91c1c",
  same: "#64748b",
  entered: "#0369a1",
  left: "#a16207",
};

function requireSha(
  value: string,
  label: string,
  length: 40 | 64,
): string {
  const normalised = value.trim().toLowerCase();
  if (!new RegExp(`^[a-f0-9]{${length}}$`).test(normalised)) {
    throw new Error(`${label} must be a ${length}-character hash.`);
  }
  return normalised;
}

function requireCreatedAt(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    throw new Error("createdAt must be an ISO timestamp.");
  }
  return value;
}

function requireQueryAlias(value: string): string {
  const alias = value.trim();
  if (!/^Q[1-9][0-9]*$/.test(alias)) {
    throw new Error("queryAlias must use Q followed by a positive number.");
  }
  return alias;
}

function requireSource(source: SourceFile, label: string): SourceFile {
  if (
    source.fileName !== path.basename(source.fileName)
    || !source.fileName.endsWith(".local.json")
  ) {
    throw new Error(`${label} must use a private .local.json file name.`);
  }
  return {
    fileName: source.fileName,
    sha256: requireSha(source.sha256, `${label} hash`, 64),
  };
}

function requireHandoffSource(source: SourceFile): SourceFile {
  if (
    source.fileName !== path.basename(source.fileName)
    || !source.fileName.endsWith(".local.final-matcher.json")
  ) {
    throw new Error(
      "Handoff source must use a private .local.final-matcher.json file name.",
    );
  }
  return {
    fileName: source.fileName,
    sha256: requireSha(source.sha256, "Handoff source hash", 64),
  };
}

function investorIds(result: FinalMatcherRouteResult): string[] {
  return result.matches.map(match => match.investor.id.trim());
}

function rankMap(
  result: FinalMatcherRouteResult,
  topN: number,
): Map<string, number> {
  return new Map(
    result.matches
      .slice(0, topN)
      .map((match, index) => [match.investor.id.trim(), index + 1]),
  );
}

function movementFor(
  baselineRank: number | undefined,
  selectedRank: number | undefined,
): RankingMovement {
  if (baselineRank === undefined) return "entered";
  if (selectedRank === undefined) return "left";
  if (selectedRank < baselineRank) return "up";
  if (selectedRank > baselineRank) return "down";
  return "same";
}

function methodLabel(method: FinalMatcherMethod): string {
  return method === "curated_feedback"
    ? "Curated feedback"
    : "No-feedback GPT";
}

function renderSvg(args: {
  rows: FinalRankingMovementRow[];
  queryAlias: string;
  selectedMethod: FinalMatcherMethod;
  topN: number;
}): string {
  const width = 1000;
  const plotTop = 180;
  const rankGap = 44;
  const offListLabelY = plotTop + args.topN * rankGap + 18;
  const offListStartY = offListLabelY + 30;
  const baselineOffList = args.rows
    .filter(row => row.baselineRank === null)
    .map(row => row.investorAlias);
  const selectedOffList = args.rows
    .filter(row => row.selectedRank === null)
    .map(row => row.investorAlias);
  const offListRows = Math.max(
    baselineOffList.length,
    selectedOffList.length,
    1,
  );
  const height = offListStartY + offListRows * 20 + 105;
  const leftX = 270;
  const rightX = 730;
  const rankY = (
    rank: number | null,
    alias: string,
    offListAliases: string[],
  ) =>
    rank === null
      ? offListStartY + offListAliases.indexOf(alias) * 20
      : plotTop + (rank - 1) * rankGap;
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description">`,
    `<title id="title">Final ranking movement for ${args.queryAlias}</title>`,
    `<desc id="description">Anonymous rank movement between the baseline and ${methodLabel(args.selectedMethod)} top ${args.topN} results.</desc>`,
    `<rect width="${width}" height="${height}" fill="#ffffff"/>`,
    `<text x="60" y="54" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#111827">Final ranking movement: ${args.queryAlias}</text>`,
    `<text x="60" y="84" font-family="Arial, sans-serif" font-size="14" fill="#475569">This chart shows rank changes only. Frozen metrics determine whether quality improved.</text>`,
    `<text x="${leftX}" y="132" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#1f2937">Baseline</text>`,
    `<text x="${rightX}" y="132" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#1f2937">${methodLabel(args.selectedMethod)}</text>`,
  ];

  for (let rank = 1; rank <= args.topN; rank += 1) {
    const y = plotTop + (rank - 1) * rankGap;
    svg.push(
      `<line x1="210" y1="${y}" x2="790" y2="${y}" stroke="#e5e7eb" stroke-width="1"/>`,
      `<text x="190" y="${y + 5}" text-anchor="end" font-family="Arial, sans-serif" font-size="12" fill="#64748b">#${rank}</text>`,
      `<text x="810" y="${y + 5}" font-family="Arial, sans-serif" font-size="12" fill="#64748b">#${rank}</text>`,
    );
  }

  args.rows.forEach(row => {
    const baselineY = rankY(
      row.baselineRank,
      row.investorAlias,
      baselineOffList,
    );
    const selectedY = rankY(
      row.selectedRank,
      row.investorAlias,
      selectedOffList,
    );
    const colour = MOVEMENT_COLOURS[row.movement];
    svg.push(
      `<line x1="${leftX}" y1="${baselineY}" x2="${rightX}" y2="${selectedY}" stroke="${colour}" stroke-width="2.5" opacity="0.8"/>`,
      `<circle cx="${leftX}" cy="${baselineY}" r="7" fill="${row.baselineRank === null ? "#ffffff" : colour}" stroke="${colour}" stroke-width="2"/>`,
      `<circle cx="${rightX}" cy="${selectedY}" r="7" fill="${row.selectedRank === null ? "#ffffff" : colour}" stroke="${colour}" stroke-width="2"/>`,
    );
    if (row.baselineRank !== null) {
      svg.push(
        `<text x="${leftX - 16}" y="${baselineY + 5}" text-anchor="end" font-family="Arial, sans-serif" font-size="12" fill="#334155">${row.investorAlias}</text>`,
      );
    }
    if (row.selectedRank !== null) {
      svg.push(
        `<text x="${rightX + 16}" y="${selectedY + 5}" font-family="Arial, sans-serif" font-size="12" fill="#334155">${row.investorAlias}</text>`,
      );
    }
  });

  svg.push(
    `<text x="${leftX}" y="${offListLabelY}" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#64748b">Outside top ${args.topN}</text>`,
    `<text x="${rightX}" y="${offListLabelY}" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#64748b">Outside top ${args.topN}</text>`,
  );

  const legend: Array<[RankingMovement, string]> = [
    ["up", "Moved up"],
    ["down", "Moved down"],
    ["same", "Unchanged"],
    ["entered", "Entered top list"],
    ["left", "Left top list"],
  ];
  legend.forEach(([movement, label], index) => {
    const x = 150 + index * 165;
    svg.push(
      `<line x1="${x}" y1="${height - 55}" x2="${x + 26}" y2="${height - 55}" stroke="${MOVEMENT_COLOURS[movement]}" stroke-width="3"/>`,
      `<text x="${x + 34}" y="${height - 50}" font-family="Arial, sans-serif" font-size="12" fill="#475569">${label}</text>`,
    );
  });
  svg.push("</svg>");
  return `${svg.join("\n")}\n`;
}

export function buildFinalRankingMovement(args: {
  baseline: unknown;
  selected: unknown;
  handoff: FinalMatcherHandoff;
  sources: {
    baseline: SourceFile;
    selected: SourceFile;
    handoff: SourceFile;
  };
  queryAlias: string;
  topN?: number;
  createdAt: string;
  svgFileName: string;
}): FinalRankingMovementVisualisation {
  const baseline = validateFinalMatcherRouteResult(args.baseline);
  const selected = validateFinalMatcherRouteResult(args.selected);
  if (args.handoff.schemaVersion !== FINAL_MATCHER_HANDOFF_SCHEMA_VERSION) {
    throw new Error("The final matcher handoff schema is not supported.");
  }
  if (args.handoff.status !== "ready-for-runtime-integration") {
    throw new Error("The final matcher handoff is not ready.");
  }
  if (
    args.handoff.selectedMethod !== "no_feedback_gpt"
    && args.handoff.selectedMethod !== "curated_feedback"
  ) {
    throw new Error("The final matcher handoff has an unsupported method.");
  }
  const aiModel = args.handoff.aiModel.trim();
  if (!aiModel || aiModel.length > 80) {
    throw new Error("The final matcher handoff requires a short AI model name.");
  }
  if (
    baseline.startupAirtableId !== selected.startupAirtableId
    || baseline.fundingRoundAirtableId !== selected.fundingRoundAirtableId
  ) {
    throw new Error("Baseline and selected results describe different queries.");
  }
  const topN = args.topN ?? 10;
  if (
    !Number.isInteger(topN)
    || topN < 1
    || topN > 10
    || topN > baseline.matches.length
    || topN > selected.matches.length
  ) {
    throw new Error("topN must be between 1 and 10 and fit both result sets.");
  }
  const baselineIds = investorIds(baseline).sort();
  const selectedIds = investorIds(selected).sort();
  if (JSON.stringify(baselineIds) !== JSON.stringify(selectedIds)) {
    throw new Error(
      "Baseline and selected results must use the same candidate pool.",
    );
  }
  if (
    args.svgFileName !== path.basename(args.svgFileName)
    || !args.svgFileName.endsWith(".local.svg")
  ) {
    throw new Error("svgFileName must be a private .local.svg file name.");
  }

  const aliases = new Map(
    baselineIds.map((investorId, index) => [
      investorId,
      `I${String(index + 1).padStart(3, "0")}`,
    ]),
  );
  const baselineRanks = rankMap(baseline, topN);
  const selectedRanks = rankMap(selected, topN);
  const topIds = new Set([...baselineRanks.keys(), ...selectedRanks.keys()]);
  const rows = [...topIds]
    .map(investorId => {
      const baselineRank = baselineRanks.get(investorId);
      const selectedRank = selectedRanks.get(investorId);
      return {
        investorAlias: aliases.get(investorId)!,
        baselineRank: baselineRank ?? null,
        selectedRank: selectedRank ?? null,
        movement: movementFor(baselineRank, selectedRank),
      };
    })
    .sort((a, b) => {
      const aRank = Math.min(
        a.baselineRank ?? topN + 1,
        a.selectedRank ?? topN + 1,
      );
      const bRank = Math.min(
        b.baselineRank ?? topN + 1,
        b.selectedRank ?? topN + 1,
      );
      return aRank - bRank || a.investorAlias.localeCompare(b.investorAlias);
    });
  const summary = {
    up: rows.filter(row => row.movement === "up").length,
    down: rows.filter(row => row.movement === "down").length,
    same: rows.filter(row => row.movement === "same").length,
    entered: rows.filter(row => row.movement === "entered").length,
    left: rows.filter(row => row.movement === "left").length,
  };
  const queryAlias = requireQueryAlias(args.queryAlias);
  const svg = renderSvg({
    rows,
    queryAlias,
    selectedMethod: args.handoff.selectedMethod,
    topN,
  });
  const sources = {
    baseline: requireSource(args.sources.baseline, "Baseline source"),
    selected: requireSource(args.sources.selected, "Selected source"),
    handoff: requireHandoffSource(args.sources.handoff),
  };

  return {
    svg,
    manifest: {
      schemaVersion: FINAL_RANKING_MOVEMENT_SCHEMA_VERSION,
      createdAt: requireCreatedAt(args.createdAt),
      queryAlias,
      selectedMethod: args.handoff.selectedMethod,
      aiModel,
      matchingConfigHash: requireSha(
        args.handoff.matchingConfigHash,
        "matchingConfigHash",
        64,
      ),
      feedbackSetHash: requireSha(
        args.handoff.feedbackSetHash,
        "feedbackSetHash",
        64,
      ),
      implementationCommitSha: requireSha(
        args.handoff.implementationCommitSha,
        "implementationCommitSha",
        40,
      ),
      topN,
      candidatePoolHash: createHash("sha256")
        .update(JSON.stringify(baselineIds), "utf8")
        .digest("hex"),
      sources,
      summary,
      rows,
      svg: {
        fileName: args.svgFileName,
        sha256: createHash("sha256").update(svg, "utf8").digest("hex"),
      },
    },
  };
}

function resolveOutput(args: {
  filePath: string;
  workingDirectory: string;
  suffix: ".local.svg" | ".local.ranking-movement.json";
}): string {
  const exportsRoot = path.resolve(args.workingDirectory, "exports");
  const resolved = path.resolve(args.workingDirectory, args.filePath);
  const relative = path.relative(exportsRoot, resolved);
  if (
    relative.length === 0
    || relative.startsWith("..")
    || path.isAbsolute(relative)
    || !path.basename(resolved).endsWith(args.suffix)
  ) {
    throw new Error(
      `Ranking output must stay inside exports/ and end with ${args.suffix}.`,
    );
  }
  return resolved;
}

async function assertAvailable(filePath: string) {
  try {
    await access(filePath);
    throw new Error(`Ranking output already exists: ${filePath}.`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export async function writeFinalRankingMovement(args: {
  visualisation: FinalRankingMovementVisualisation;
  svgPath: string;
  manifestPath: string;
  workingDirectory?: string;
}): Promise<{ svgPath: string; manifestPath: string }> {
  const workingDirectory = args.workingDirectory ?? process.cwd();
  const svgPath = resolveOutput({
    filePath: args.svgPath,
    workingDirectory,
    suffix: ".local.svg",
  });
  const manifestPath = resolveOutput({
    filePath: args.manifestPath,
    workingDirectory,
    suffix: ".local.ranking-movement.json",
  });
  if (path.basename(svgPath) !== args.visualisation.manifest.svg.fileName) {
    throw new Error("SVG output name does not match the movement manifest.");
  }
  const svgHash = createHash("sha256")
    .update(args.visualisation.svg, "utf8")
    .digest("hex");
  if (svgHash !== args.visualisation.manifest.svg.sha256) {
    throw new Error("SVG content does not match the movement manifest.");
  }
  await Promise.all([assertAvailable(svgPath), assertAvailable(manifestPath)]);
  await Promise.all([
    mkdir(path.dirname(svgPath), { recursive: true }),
    mkdir(path.dirname(manifestPath), { recursive: true }),
  ]);
  const svgTemporaryPath = `${svgPath}.${process.pid}.${randomUUID()}.tmp`;
  const manifestTemporaryPath =
    `${manifestPath}.${process.pid}.${randomUUID()}.tmp`;
  let svgLinked = false;
  let manifestLinked = false;
  try {
    await Promise.all([
      writeFile(svgTemporaryPath, args.visualisation.svg, {
        encoding: "utf8",
        flag: "wx",
      }),
      writeFile(
        manifestTemporaryPath,
        `${JSON.stringify(args.visualisation.manifest, null, 2)}\n`,
        { encoding: "utf8", flag: "wx" },
      ),
    ]);
    await link(svgTemporaryPath, svgPath);
    svgLinked = true;
    await link(manifestTemporaryPath, manifestPath);
    manifestLinked = true;
  } catch (error) {
    if (svgLinked) await unlink(svgPath);
    if (manifestLinked) await unlink(manifestPath);
    throw error;
  } finally {
    await Promise.all(
      [svgTemporaryPath, manifestTemporaryPath].map(filePath =>
        unlink(filePath).catch(() => {}),
      ),
    );
  }
  return { svgPath, manifestPath };
}
