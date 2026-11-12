import { createHash, randomUUID } from "node:crypto";
import { access, link, mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  FeedbackEvaluationDecision,
  FeedbackMetricName,
} from "./feedback-evaluation-decision";
import type {
  FeedbackEvaluationMetricSummary,
  FeedbackEvaluationReceipt,
} from "./feedback-evaluation-receipt";

export const FEEDBACK_EVALUATION_VISUALISATION_SCHEMA_VERSION =
  "feedback-evaluation-visualisation-v1";

const METRICS: Array<{
  name: FeedbackMetricName;
  label: string;
}> = [
  { name: "precisionAt5", label: "Precision@5" },
  { name: "precisionAt10", label: "Precision@10" },
  { name: "mrr", label: "MRR" },
  { name: "ndcgAt10", label: "NDCG@10" },
];

type PerQueryRun = FeedbackEvaluationMetricSummary["perQuery"];

export interface FeedbackEvaluationVisualisationManifest {
  schemaVersion: typeof FEEDBACK_EVALUATION_VISUALISATION_SCHEMA_VERSION;
  batchId: string;
  aiModel: string;
  matchingConfigHash: string;
  implementationCommitSha: string;
  metricFiles: {
    none: { fileName: string; sha256: string };
    curated: { fileName: string; sha256: string };
  };
  decision: {
    evidencePattern: FeedbackEvaluationDecision["evidencePattern"];
    recommendation: FeedbackEvaluationDecision["recommendation"];
    reviewStatus: FeedbackEvaluationDecision["reviewStatus"];
  };
  svg: {
    fileName: string;
    sha256: string;
  };
}

export interface FeedbackEvaluationVisualisation {
  svg: string;
  manifest: FeedbackEvaluationVisualisationManifest;
}

function requireSha(value: string, label: string, length: 40 | 64): string {
  const normalised = value.trim().toLowerCase();
  if (!new RegExp(`^[a-f0-9]{${length}}$`).test(normalised)) {
    throw new Error(`${label} must be a ${length}-character hexadecimal hash.`);
  }
  return normalised;
}

function requireMetric(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${label} must be between 0 and 1.`);
  }
  return value;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function formatMetric(value: number): string {
  return value.toFixed(3);
}

function formatDelta(value: number): string {
  if (Math.abs(value) < 0.00005) return "0.000";
  return `${value > 0 ? "+" : ""}${value.toFixed(3)}`;
}

function deltaColour(delta: number): { fill: string; text: string } {
  if (delta > 0) return { fill: "#d9f2e6", text: "#12633c" };
  if (delta < 0) return { fill: "#fde2df", text: "#9f271f" };
  return { fill: "#e9edf2", text: "#475467" };
}

function perQueryById(
  rows: PerQueryRun,
  expectedQueryIds: readonly string[],
  label: string,
): Map<string, PerQueryRun[number]> {
  const byId = new Map(rows.map(row => [row.queryId, row]));
  if (
    rows.length !== expectedQueryIds.length ||
    byId.size !== expectedQueryIds.length ||
    expectedQueryIds.some(queryId => !byId.has(queryId))
  ) {
    throw new Error(`${label} does not match the receipt query set.`);
  }
  return byId;
}

export function buildFeedbackEvaluationVisualisation(args: {
  receipt: FeedbackEvaluationReceipt;
  decision: FeedbackEvaluationDecision;
  perQuery: { none: PerQueryRun; curated: PerQueryRun };
  aiModel: string;
  implementationCommitSha: string;
  svgFileName: string;
}): FeedbackEvaluationVisualisation {
  if (
    args.receipt.batch.batchId !== args.decision.batchId ||
    JSON.stringify(args.receipt.queryIds) !==
      JSON.stringify(args.decision.queryIds)
  ) {
    throw new Error("The receipt and decision describe different batches.");
  }
  if (
    args.svgFileName !== path.basename(args.svgFileName) ||
    !args.svgFileName.endsWith(".local.svg")
  ) {
    throw new Error("svgFileName must be a private .local.svg file name.");
  }
  const aiModel = args.aiModel.trim();
  if (!aiModel || aiModel.length > 80) {
    throw new Error("aiModel must be a short non-empty value.");
  }
  const implementationCommitSha = requireSha(
    args.implementationCommitSha,
    "implementationCommitSha",
    40,
  );
  const matchingConfigHash = requireSha(
    args.receipt.batch.matchingConfigHash,
    "matchingConfigHash",
    64,
  );
  const noneById = perQueryById(
    args.perQuery.none,
    args.receipt.queryIds,
    "No-feedback per-query metrics",
  );
  const curatedById = perQueryById(
    args.perQuery.curated,
    args.receipt.queryIds,
    "Curated per-query metrics",
  );

  const width = 1120;
  const height = 780;
  const chartTop = 150;
  const chartHeight = 230;
  const chartBottom = chartTop + chartHeight;
  const groupWidth = 220;
  const chartLeft = 120;
  const barWidth = 46;
  const svg: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description">`,
    '<title id="title">Feedback ablation evaluation</title>',
    '<desc id="description">Macro ranking metrics and anonymised per-query changes for no-feedback and curated-feedback matching runs.</desc>',
    `<rect width="${width}" height="${height}" fill="#ffffff"/>`,
    '<text x="60" y="58" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#101828">Feedback ablation evaluation</text>',
    '<text x="60" y="88" font-family="Arial, sans-serif" font-size="15" fill="#475467">Frozen labels; identical queries, candidate pools and matching configuration</text>',
    '<rect x="775" y="48" width="18" height="18" fill="#344054"/>',
    '<text x="802" y="62" font-family="Arial, sans-serif" font-size="13" fill="#344054">No feedback</text>',
    '<rect x="910" y="48" width="18" height="18" fill="#12b76a"/>',
    '<text x="937" y="62" font-family="Arial, sans-serif" font-size="13" fill="#344054">Curated feedback</text>',
  ];

  for (let tick = 0; tick <= 4; tick += 1) {
    const value = tick / 4;
    const y = chartBottom - value * chartHeight;
    svg.push(
      `<line x1="${chartLeft}" y1="${y}" x2="1020" y2="${y}" stroke="#eaecf0" stroke-width="1"/>`,
      `<text x="${chartLeft - 18}" y="${y + 5}" text-anchor="end" font-family="Arial, sans-serif" font-size="12" fill="#667085">${value.toFixed(2)}</text>`,
    );
  }

  args.decision.metricDeltas.forEach((metricDelta, index) => {
    const expected = METRICS[index];
    if (metricDelta.metric !== expected.name) {
      throw new Error("Decision metrics are not in the expected order.");
    }
    const groupX = chartLeft + index * groupWidth + 55;
    const none = requireMetric(metricDelta.none, `${expected.name}.none`);
    const curated = requireMetric(
      metricDelta.curated,
      `${expected.name}.curated`,
    );
    const noneHeight = none * chartHeight;
    const curatedHeight = curated * chartHeight;
    svg.push(
      `<rect x="${groupX}" y="${chartBottom - noneHeight}" width="${barWidth}" height="${noneHeight}" fill="#344054"/>`,
      `<rect x="${groupX + 58}" y="${chartBottom - curatedHeight}" width="${barWidth}" height="${curatedHeight}" fill="#12b76a"/>`,
      `<text x="${groupX + 52}" y="${chartTop - 22}" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="${deltaColour(metricDelta.delta).text}">${formatDelta(metricDelta.delta)}</text>`,
      `<text x="${groupX + 52}" y="${chartBottom + 28}" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" fill="#344054">${expected.label}</text>`,
      `<text x="${groupX + barWidth / 2}" y="${chartBottom - noneHeight - 8}" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" fill="#344054">${formatMetric(none)}</text>`,
      `<text x="${groupX + 58 + barWidth / 2}" y="${chartBottom - curatedHeight - 8}" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" fill="#12633c">${formatMetric(curated)}</text>`,
    );
  });

  svg.push(
    '<text x="60" y="455" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#101828">Per-query change (curated minus no feedback)</text>',
  );
  METRICS.forEach((metric, index) => {
    svg.push(
      `<text x="${340 + index * 175}" y="493" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" fill="#344054">${metric.label}</text>`,
    );
  });
  args.receipt.queryIds.forEach((queryId, queryIndex) => {
    const none = noneById.get(queryId)!;
    const curated = curatedById.get(queryId)!;
    const y = 515 + queryIndex * 58;
    svg.push(
      `<text x="110" y="${y + 30}" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#344054">Q${queryIndex + 1}</text>`,
    );
    METRICS.forEach((metric, metricIndex) => {
      const delta =
        curated.metrics[metric.name] - none.metrics[metric.name];
      const colour = deltaColour(delta);
      const x = 265 + metricIndex * 175;
      svg.push(
        `<rect x="${x}" y="${y}" width="150" height="42" rx="4" fill="${colour.fill}"/>`,
        `<text x="${x + 75}" y="${y + 27}" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="${colour.text}">${formatDelta(delta)}</text>`,
      );
    });
  });

  const pattern = escapeXml(args.decision.evidencePattern);
  const recommendation = escapeXml(args.decision.recommendation);
  svg.push(
    `<text x="60" y="716" font-family="Arial, sans-serif" font-size="13" fill="#344054">Evidence pattern: ${pattern} | Recommendation: ${recommendation}</text>`,
    '<text x="60" y="742" font-family="Arial, sans-serif" font-size="12" fill="#667085">The final selection still requires qualitative error review.</text>',
    `<text x="1060" y="716" text-anchor="end" font-family="Arial, sans-serif" font-size="11" fill="#667085">Model: ${escapeXml(aiModel)}</text>`,
    `<text x="1060" y="738" text-anchor="end" font-family="Arial, sans-serif" font-size="11" fill="#667085">Config: ${matchingConfigHash.slice(0, 12)} | Commit: ${implementationCommitSha.slice(0, 12)}</text>`,
    "</svg>",
  );
  const svgText = `${svg.join("\n")}\n`;

  return {
    svg: svgText,
    manifest: {
      schemaVersion: FEEDBACK_EVALUATION_VISUALISATION_SCHEMA_VERSION,
      batchId: args.receipt.batch.batchId,
      aiModel,
      matchingConfigHash,
      implementationCommitSha,
      metricFiles: {
        none: {
          fileName: args.receipt.runs[0].metricsFileName,
          sha256: requireSha(
            args.receipt.runs[0].metricsSha256,
            "none metrics hash",
            64,
          ),
        },
        curated: {
          fileName: args.receipt.runs[1].metricsFileName,
          sha256: requireSha(
            args.receipt.runs[1].metricsSha256,
            "curated metrics hash",
            64,
          ),
        },
      },
      decision: {
        evidencePattern: args.decision.evidencePattern,
        recommendation: args.decision.recommendation,
        reviewStatus: args.decision.reviewStatus,
      },
      svg: {
        fileName: args.svgFileName,
        sha256: createHash("sha256").update(svgText, "utf8").digest("hex"),
      },
    },
  };
}

function resolveOutput(args: {
  filePath: string;
  workingDirectory: string;
  suffix: ".local.svg" | ".local.visualisation.json";
}): string {
  const exportsRoot = path.resolve(args.workingDirectory, "exports");
  const resolved = path.resolve(args.workingDirectory, args.filePath);
  const relative = path.relative(exportsRoot, resolved);
  if (
    relative.length === 0 ||
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    !path.basename(resolved).endsWith(args.suffix)
  ) {
    throw new Error(
      `Visualisation output must stay inside exports/ and end with ${args.suffix}.`,
    );
  }
  return resolved;
}

async function assertAvailable(filePath: string) {
  try {
    await access(filePath);
    throw new Error(`Visualisation output already exists: ${filePath}.`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export async function writeFeedbackEvaluationVisualisation(args: {
  visualisation: FeedbackEvaluationVisualisation;
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
    suffix: ".local.visualisation.json",
  });
  if (path.basename(svgPath) !== args.visualisation.manifest.svg.fileName) {
    throw new Error("SVG output name does not match its manifest.");
  }
  const svgHash = createHash("sha256")
    .update(args.visualisation.svg, "utf8")
    .digest("hex");
  if (svgHash !== args.visualisation.manifest.svg.sha256) {
    throw new Error("SVG content does not match its manifest hash.");
  }
  await Promise.all([assertAvailable(svgPath), assertAvailable(manifestPath)]);
  await Promise.all([
    mkdir(path.dirname(svgPath), { recursive: true }),
    mkdir(path.dirname(manifestPath), { recursive: true }),
  ]);
  const svgTemporaryPath = `${svgPath}.${process.pid}.${randomUUID()}.tmp`;
  const manifestTemporaryPath = `${manifestPath}.${process.pid}.${randomUUID()}.tmp`;
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
