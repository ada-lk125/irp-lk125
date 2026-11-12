import { createHash, randomUUID } from "node:crypto";
import { access, link, mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import {
  FEEDBACK_EVALUATION_VISUALISATION_SCHEMA_VERSION,
  type FeedbackEvaluationVisualisationManifest,
} from "./feedback-evaluation-visualisation";
import {
  FINAL_MATCHER_HANDOFF_SCHEMA_VERSION,
  type FinalMatcherHandoff,
  type FinalMatcherMethod,
} from "./final-matcher-handoff";
import {
  FINAL_RANKING_MOVEMENT_SCHEMA_VERSION,
  type FinalRankingMovementManifest,
} from "./final-ranking-movement";

export const FINAL_EVIDENCE_PAGE_SCHEMA_VERSION = "final-evidence-page-v1";

const RESULT_CONTRACT_SCORE_FIELDS = [
  "stageMatch",
  "ticketSizeMatch",
  "sectorOverlap",
  "geographyMatch",
  "instrumentMatch",
  "semanticScore",
  "totalScore",
] as const;

export interface FinalEvidenceSource {
  fileName: string;
  sha256: string;
}

interface RankingEvidenceInput {
  manifest: FinalRankingMovementManifest;
  manifestText: string;
  manifestSource: FinalEvidenceSource;
  svg: string;
  svgSource: FinalEvidenceSource;
}

export interface FinalEvidencePageManifest {
  schemaVersion: typeof FINAL_EVIDENCE_PAGE_SCHEMA_VERSION;
  createdAt: string;
  batchId: string;
  selectedMethod: FinalMatcherMethod;
  aiModel: string;
  matchingConfigHash: string;
  feedbackSetHash: string;
  implementationCommitSha: string;
  decision: FinalMatcherHandoff["evaluation"];
  sources: {
    handoff: FinalEvidenceSource;
    metricManifest: FinalEvidenceSource;
    metricSvg: FinalEvidenceSource;
    rankings: Array<{
      queryAlias: string;
      manifest: FinalEvidenceSource;
      svg: FinalEvidenceSource;
      candidatePoolHash: string;
    }>;
  };
  page: FinalEvidenceSource;
}

export interface FinalEvidencePage {
  html: string;
  manifest: FinalEvidencePageManifest;
}

function requireHash(
  value: string,
  label: string,
  length: 40 | 64,
): string {
  const hash = String(value ?? "").trim().toLowerCase();
  if (!new RegExp(`^[a-f0-9]{${length}}$`).test(hash)) {
    throw new Error(`${label} must be a ${length}-character hash.`);
  }
  return hash;
}

function requireCreatedAt(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    throw new Error("createdAt must be an ISO timestamp.");
  }
  return value;
}

function requireSource(
  source: FinalEvidenceSource,
  label: string,
  suffix: string,
): FinalEvidenceSource {
  const fileName = String(source.fileName ?? "").trim();
  if (
    fileName !== path.basename(fileName)
    || !fileName.endsWith(suffix)
  ) {
    throw new Error(`${label} must use a private ${suffix} file name.`);
  }
  return {
    fileName,
    sha256: requireHash(source.sha256, `${label} hash`, 64),
  };
}

function requireSvg(args: {
  svg: string;
  source: FinalEvidenceSource;
  expectedHash: string;
  title: RegExp;
  label: string;
}): string {
  if (
    !args.svg.trimStart().startsWith("<svg")
    || !args.svg.trimEnd().endsWith("</svg>")
  ) {
    throw new Error(`${args.label} must contain one SVG document.`);
  }
  const actualHash = createHash("sha256")
    .update(args.svg, "utf8")
    .digest("hex");
  if (
    actualHash !== args.source.sha256
    || actualHash !== requireHash(args.expectedHash, `${args.label} hash`, 64)
  ) {
    throw new Error(`${args.label} does not match its manifest hash.`);
  }
  if (!args.title.test(args.svg)) {
    throw new Error(`${args.label} does not have the expected title.`);
  }
  if (
    /<script\b|<foreignObject\b|\son[a-z]+\s*=|\b(?:href|xlink:href)\s*=|url\s*\(/i.test(
      args.svg,
    )
  ) {
    throw new Error(`${args.label} contains unsupported active SVG content.`);
  }
  if (/\b(?:rec|tbl|app)[A-Za-z0-9]{10,}\b/.test(args.svg)) {
    throw new Error(`${args.label} contains an Airtable identifier.`);
  }
  return args.svg;
}

function namespaceSvg(svg: string, prefix: string): string {
  return svg
    .replace(
      'aria-labelledby="title description"',
      `aria-labelledby="${prefix}-title ${prefix}-description"`,
    )
    .replace('id="title"', `id="${prefix}-title"`)
    .replace('id="description"', `id="${prefix}-description"`);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function methodLabel(method: FinalMatcherMethod): string {
  return method === "curated_feedback"
    ? "Curated feedback"
    : "No-feedback GPT";
}

function sameSource(
  left: FinalEvidenceSource,
  right: FinalEvidenceSource,
): boolean {
  return left.fileName === right.fileName && left.sha256 === right.sha256;
}

function requireJsonSource(args: {
  value: unknown;
  text: string;
  source: FinalEvidenceSource;
  label: string;
}) {
  if (hashFinalEvidenceSource(args.text) !== args.source.sha256) {
    throw new Error(`${args.label} text does not match its source hash.`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(args.text) as unknown;
  } catch {
    throw new Error(`${args.label} source must contain valid JSON.`);
  }
  if (!isDeepStrictEqual(parsed, args.value)) {
    throw new Error(`${args.label} object does not match its source file.`);
  }
}

function requireRankingRows(
  manifest: FinalRankingMovementManifest,
  label: string,
) {
  if (
    !Number.isInteger(manifest.topN)
    || manifest.topN < 1
    || manifest.topN > 10
  ) {
    throw new Error(`${label} has an invalid topN.`);
  }
  const aliases = manifest.rows.map(row => row.investorAlias);
  if (
    aliases.length === 0
    || new Set(aliases).size !== aliases.length
    || aliases.some(alias => !/^I[0-9]{3}$/.test(alias))
  ) {
    throw new Error(`${label} has invalid anonymous investor aliases.`);
  }
  const movements = ["up", "down", "same", "entered", "left"] as const;
  movements.forEach(movement => {
    const expected = manifest.rows.filter(
      row => row.movement === movement,
    ).length;
    if (manifest.summary[movement] !== expected) {
      throw new Error(`${label} movement summary does not match its rows.`);
    }
  });
}

function renderPage(args: {
  handoff: FinalMatcherHandoff;
  metricSvg: string;
  rankings: Array<{
    manifest: FinalRankingMovementManifest;
    svg: string;
  }>;
}): string {
  const handoff = args.handoff;
  const rankingFigures = args.rankings
    .map(({ manifest, svg }, index) => {
      const summary = manifest.summary;
      return `<figure class="evidence">
        <figcaption>
          <div>
            <h3>${escapeHtml(manifest.queryAlias)} ranking movement</h3>
            <p>Top ${manifest.topN} | Up ${summary.up} | Down ${summary.down} | Same ${summary.same} | Entered ${summary.entered} | Left ${summary.left}</p>
          </div>
          <code>${escapeHtml(manifest.candidatePoolHash)}</code>
        </figcaption>
        <div class="chart">${namespaceSvg(svg, `ranking-${index + 1}`)}</div>
      </figure>`;
    })
    .join("\n");
  const reviewLabel =
    handoff.evaluation.reviewOutcome === "approve-curated"
      ? "Curated method approved"
      : "Control method retained";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Final matcher evidence</title>
  <style>
    :root {
      color-scheme: light;
      font-family: Arial, sans-serif;
      color: #171717;
      background: #f4f5f2;
      letter-spacing: 0;
    }
    * { box-sizing: border-box; }
    body { margin: 0; }
    header {
      background: #202321;
      color: #ffffff;
      padding: 38px max(28px, calc((100vw - 1180px) / 2));
      border-bottom: 5px solid #31a36f;
    }
    header h1 { margin: 0 0 10px; font-size: 32px; letter-spacing: 0; }
    header p { margin: 0; color: #d7ddd9; line-height: 1.5; }
    main { width: min(1180px, calc(100% - 40px)); margin: 28px auto 56px; }
    .status {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      background: #ffffff;
      border: 1px solid #d6d9d5;
      border-radius: 6px;
      margin-bottom: 24px;
    }
    .status div { padding: 18px; border-right: 1px solid #e3e5e2; }
    .status div:last-child { border-right: 0; }
    .label { display: block; color: #626963; font-size: 12px; margin-bottom: 7px; }
    .value { font-weight: 700; overflow-wrap: anywhere; }
    .decision {
      border-left: 5px solid #31a36f;
      background: #e8f5ee;
      padding: 16px 18px;
      margin-bottom: 24px;
    }
    .decision strong { color: #176a45; }
    section > h2 { margin: 34px 0 14px; font-size: 22px; letter-spacing: 0; }
    section > p { color: #555d57; line-height: 1.55; }
    .evidence {
      margin: 0 0 22px;
      background: #ffffff;
      border: 1px solid #d6d9d5;
      border-radius: 6px;
      overflow: hidden;
    }
    figcaption {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      align-items: center;
      padding: 16px 18px;
      border-bottom: 1px solid #e3e5e2;
    }
    figcaption h3 { margin: 0 0 5px; font-size: 17px; letter-spacing: 0; }
    figcaption p { margin: 0; color: #626963; font-size: 13px; }
    code {
      color: #4f3b00;
      background: #fff4cc;
      padding: 5px 7px;
      border-radius: 4px;
      font-size: 11px;
      overflow-wrap: anywhere;
    }
    .chart { padding: 14px; overflow-x: auto; }
    .chart svg { display: block; width: 100%; height: auto; min-width: 760px; }
    .provenance {
      background: #ffffff;
      border-top: 3px solid #c26a37;
      padding: 20px;
      margin-top: 30px;
    }
    .provenance dl {
      display: grid;
      grid-template-columns: 190px minmax(0, 1fr);
      gap: 10px 18px;
      margin: 0;
    }
    .provenance dt { color: #626963; }
    .provenance dd { margin: 0; overflow-wrap: anywhere; }
    @media (max-width: 760px) {
      header { padding: 28px 20px; }
      main { width: min(100% - 24px, 1180px); }
      .status { grid-template-columns: 1fr 1fr; }
      .status div:nth-child(2) { border-right: 0; }
      .status div:nth-child(-n+2) { border-bottom: 1px solid #e3e5e2; }
      figcaption { display: block; }
      figcaption code { display: block; margin-top: 10px; }
      .provenance dl { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <header>
    <h1>Final matcher evidence</h1>
    <p>Frozen ranking metrics and anonymous rank movement for the selected matching method.</p>
  </header>
  <main>
    <div class="status">
      <div><span class="label">Selected method</span><span class="value">${escapeHtml(methodLabel(handoff.selectedMethod))}</span></div>
      <div><span class="label">AI model</span><span class="value">${escapeHtml(handoff.aiModel)}</span></div>
      <div><span class="label">Evidence pattern</span><span class="value">${escapeHtml(handoff.evaluation.evidencePattern)}</span></div>
      <div><span class="label">Review outcome</span><span class="value">${escapeHtml(handoff.evaluation.reviewOutcome)}</span></div>
    </div>
    <div class="decision">
      <strong>${escapeHtml(reviewLabel)}.</strong>
      The metric chart measures quality. The ranking charts show where the ordered results changed.
    </div>
    <section>
      <h2>Frozen metric comparison</h2>
      <p>Precision@5, Precision@10, MRR and NDCG@10 use Chuan's frozen labels on the same evaluated queries.</p>
      <figure class="evidence">
        <div class="chart">${namespaceSvg(args.metricSvg, "metrics")}</div>
      </figure>
    </section>
    <section>
      <h2>Anonymous ranking movement</h2>
      <p>Each query uses stable aliases so the page can show movement without publishing Airtable records or investor names.</p>
      ${rankingFigures}
    </section>
    <section class="provenance">
      <h2>Implementation identity</h2>
      <dl>
        <dt>Batch</dt><dd>${escapeHtml(handoff.batchId)}</dd>
        <dt>Matching configuration</dt><dd>${escapeHtml(handoff.matchingConfigHash)}</dd>
        <dt>Feedback set</dt><dd>${escapeHtml(handoff.feedbackSetHash)}</dd>
        <dt>Implementation commit</dt><dd>${escapeHtml(handoff.implementationCommitSha)}</dd>
      </dl>
    </section>
  </main>
</body>
</html>
`;
}

export function buildFinalEvidencePage(args: {
  handoff: FinalMatcherHandoff;
  handoffText: string;
  handoffSource: FinalEvidenceSource;
  metricManifest: FeedbackEvaluationVisualisationManifest;
  metricManifestText: string;
  metricManifestSource: FinalEvidenceSource;
  metricSvg: string;
  metricSvgSource: FinalEvidenceSource;
  rankings: RankingEvidenceInput[];
  createdAt: string;
  htmlFileName: string;
}): FinalEvidencePage {
  if (
    args.handoff.schemaVersion !== FINAL_MATCHER_HANDOFF_SCHEMA_VERSION
    || args.handoff.status !== "ready-for-runtime-integration"
  ) {
    throw new Error("The final matcher handoff is not ready.");
  }
  if (
    args.handoff.selectedMethod !== "no_feedback_gpt"
    && args.handoff.selectedMethod !== "curated_feedback"
  ) {
    throw new Error("The final matcher handoff has an unsupported method.");
  }
  if (
    args.handoff.semanticMethod !== "gpt-semantic"
    || !args.handoff.batchId.trim()
    || !args.handoff.aiModel.trim()
    || args.handoff.aiModel.trim().length > 80
  ) {
    throw new Error("The final matcher handoff identity is invalid.");
  }
  const resultContract = args.handoff.resultContract;
  if (
    resultContract?.investor !== true
    || resultContract?.matchReasons !== true
    || resultContract?.aiInsight !== true
    || !Array.isArray(resultContract.scoreBreakdown)
    || resultContract.scoreBreakdown.length !==
      RESULT_CONTRACT_SCORE_FIELDS.length
    || RESULT_CONTRACT_SCORE_FIELDS.some(
      (field, index) => resultContract.scoreBreakdown[index] !== field,
    )
  ) {
    throw new Error("The final matcher handoff result contract is invalid.");
  }
  if (
    args.handoff.selectedMethod === "curated_feedback"
      ? (
          args.handoff.evaluation.evidencePattern !==
            "consistent-improvement"
          || args.handoff.evaluation.recommendation !==
            "review-curated-candidate"
          || args.handoff.evaluation.reviewOutcome !== "approve-curated"
        )
      : args.handoff.evaluation.reviewOutcome !== "keep-control"
  ) {
    throw new Error("The final matcher handoff selection is inconsistent.");
  }
  if (
    args.metricManifest.schemaVersion !==
      FEEDBACK_EVALUATION_VISUALISATION_SCHEMA_VERSION
    || args.metricManifest.decision.reviewStatus !== "requires-error-review"
  ) {
    throw new Error("The metric visualisation manifest is not supported.");
  }
  const handoffSource = requireSource(
    args.handoffSource,
    "Handoff source",
    ".local.final-matcher.json",
  );
  const metricManifestSource = requireSource(
    args.metricManifestSource,
    "Metric manifest source",
    ".local.visualisation.json",
  );
  const metricSvgSource = requireSource(
    args.metricSvgSource,
    "Metric SVG source",
    ".local.svg",
  );
  requireJsonSource({
    value: args.handoff,
    text: args.handoffText,
    source: handoffSource,
    label: "Handoff",
  });
  requireJsonSource({
    value: args.metricManifest,
    text: args.metricManifestText,
    source: metricManifestSource,
    label: "Metric manifest",
  });
  if (
    !sameSource(metricManifestSource, args.handoff.sources.visualisation)
  ) {
    throw new Error("The metric manifest does not match the final handoff.");
  }
  if (
    args.metricManifest.batchId !== args.handoff.batchId
    || args.metricManifest.aiModel !== args.handoff.aiModel
    || args.metricManifest.matchingConfigHash !==
      args.handoff.matchingConfigHash
    || args.metricManifest.implementationCommitSha !==
      args.handoff.implementationCommitSha
    || args.metricManifest.decision.evidencePattern !==
      args.handoff.evaluation.evidencePattern
    || args.metricManifest.decision.recommendation !==
      args.handoff.evaluation.recommendation
  ) {
    throw new Error("The metric visualisation identity does not match the handoff.");
  }
  if (metricSvgSource.fileName !== args.metricManifest.svg.fileName) {
    throw new Error("The metric SVG file name does not match its manifest.");
  }
  const metricSvg = requireSvg({
    svg: args.metricSvg,
    source: metricSvgSource,
    expectedHash: args.metricManifest.svg.sha256,
    title: /<title[^>]*>Feedback ablation evaluation<\/title>/,
    label: "Metric SVG",
  });

  if (args.rankings.length !== 3) {
    throw new Error("The final evidence page requires three ranking charts.");
  }
  const rankings = [...args.rankings].sort((left, right) =>
    left.manifest.queryAlias.localeCompare(
      right.manifest.queryAlias,
      undefined,
      { numeric: true },
    ),
  );
  if (
    rankings.map(item => item.manifest.queryAlias).join(",") !== "Q1,Q2,Q3"
  ) {
    throw new Error("Ranking charts must contain Q1, Q2 and Q3 once each.");
  }
  const rankingSources = rankings.map((ranking, index) => {
    const label = `Ranking ${index + 1}`;
    if (
      ranking.manifest.schemaVersion !==
        FINAL_RANKING_MOVEMENT_SCHEMA_VERSION
    ) {
      throw new Error(`${label} manifest is not supported.`);
    }
    if (
      ranking.manifest.selectedMethod !== args.handoff.selectedMethod
      || ranking.manifest.aiModel !== args.handoff.aiModel
      || ranking.manifest.matchingConfigHash !==
        args.handoff.matchingConfigHash
      || ranking.manifest.feedbackSetHash !== args.handoff.feedbackSetHash
      || ranking.manifest.implementationCommitSha !==
        args.handoff.implementationCommitSha
    ) {
      throw new Error(`${label} identity does not match the handoff.`);
    }
    const manifestSource = requireSource(
      ranking.manifestSource,
      `${label} manifest source`,
      ".local.ranking-movement.json",
    );
    requireJsonSource({
      value: ranking.manifest,
      text: ranking.manifestText,
      source: manifestSource,
      label: `${label} manifest`,
    });
    const svgSource = requireSource(
      ranking.svgSource,
      `${label} SVG source`,
      ".local.svg",
    );
    if (
      ranking.manifest.sources.handoff.fileName !== handoffSource.fileName
      || ranking.manifest.sources.handoff.sha256 !== handoffSource.sha256
    ) {
      throw new Error(`${label} does not use the final handoff source.`);
    }
    if (svgSource.fileName !== ranking.manifest.svg.fileName) {
      throw new Error(`${label} SVG file name does not match its manifest.`);
    }
    requireHash(
      ranking.manifest.candidatePoolHash,
      `${label} candidate pool hash`,
      64,
    );
    requireRankingRows(ranking.manifest, label);
    const svg = requireSvg({
      svg: ranking.svg,
      source: svgSource,
      expectedHash: ranking.manifest.svg.sha256,
      title: new RegExp(
        `<title[^>]*>Final ranking movement for ${ranking.manifest.queryAlias}<\\/title>`,
      ),
      label: `${label} SVG`,
    });
    return {
      manifest: ranking.manifest,
      manifestSource,
      svgSource,
      svg,
    };
  });

  if (
    args.htmlFileName !== path.basename(args.htmlFileName)
    || !args.htmlFileName.endsWith(".local.final-evidence.html")
  ) {
    throw new Error(
      "htmlFileName must be a private .local.final-evidence.html file name.",
    );
  }
  const html = renderPage({
    handoff: args.handoff,
    metricSvg,
    rankings: rankingSources.map(({ manifest, svg }) => ({ manifest, svg })),
  });
  const pageSource = {
    fileName: args.htmlFileName,
    sha256: createHash("sha256").update(html, "utf8").digest("hex"),
  };

  return {
    html,
    manifest: {
      schemaVersion: FINAL_EVIDENCE_PAGE_SCHEMA_VERSION,
      createdAt: requireCreatedAt(args.createdAt),
      batchId: args.handoff.batchId,
      selectedMethod: args.handoff.selectedMethod,
      aiModel: args.handoff.aiModel,
      matchingConfigHash: requireHash(
        args.handoff.matchingConfigHash,
        "matchingConfigHash",
        64,
      ),
      feedbackSetHash: requireHash(
        args.handoff.feedbackSetHash,
        "feedbackSetHash",
        64,
      ),
      implementationCommitSha: requireHash(
        args.handoff.implementationCommitSha,
        "implementationCommitSha",
        40,
      ),
      decision: args.handoff.evaluation,
      sources: {
        handoff: handoffSource,
        metricManifest: metricManifestSource,
        metricSvg: metricSvgSource,
        rankings: rankingSources.map(
          ({ manifest, manifestSource, svgSource }) => ({
            queryAlias: manifest.queryAlias,
            manifest: manifestSource,
            svg: svgSource,
            candidatePoolHash: manifest.candidatePoolHash,
          }),
        ),
      },
      page: pageSource,
    },
  };
}

function resolveOutput(args: {
  filePath: string;
  workingDirectory: string;
  suffix: ".local.final-evidence.html" | ".local.final-evidence.json";
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
      `Final evidence output must stay inside exports/ and end with ${args.suffix}.`,
    );
  }
  return resolved;
}

async function assertAvailable(filePath: string) {
  try {
    await access(filePath);
    throw new Error(`Final evidence output already exists: ${filePath}.`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export async function writeFinalEvidencePage(args: {
  evidence: FinalEvidencePage;
  htmlPath: string;
  manifestPath: string;
  workingDirectory?: string;
}): Promise<{ htmlPath: string; manifestPath: string }> {
  const workingDirectory = args.workingDirectory ?? process.cwd();
  const htmlPath = resolveOutput({
    filePath: args.htmlPath,
    workingDirectory,
    suffix: ".local.final-evidence.html",
  });
  const manifestPath = resolveOutput({
    filePath: args.manifestPath,
    workingDirectory,
    suffix: ".local.final-evidence.json",
  });
  if (path.basename(htmlPath) !== args.evidence.manifest.page.fileName) {
    throw new Error("HTML output name does not match the evidence manifest.");
  }
  const pageHash = createHash("sha256")
    .update(args.evidence.html, "utf8")
    .digest("hex");
  if (pageHash !== args.evidence.manifest.page.sha256) {
    throw new Error("HTML content does not match the evidence manifest.");
  }
  await Promise.all([assertAvailable(htmlPath), assertAvailable(manifestPath)]);
  await Promise.all([
    mkdir(path.dirname(htmlPath), { recursive: true }),
    mkdir(path.dirname(manifestPath), { recursive: true }),
  ]);
  const htmlTemporaryPath =
    `${htmlPath}.${process.pid}.${randomUUID()}.tmp`;
  const manifestTemporaryPath =
    `${manifestPath}.${process.pid}.${randomUUID()}.tmp`;
  let htmlLinked = false;
  let manifestLinked = false;
  try {
    await Promise.all([
      writeFile(htmlTemporaryPath, args.evidence.html, {
        encoding: "utf8",
        flag: "wx",
      }),
      writeFile(
        manifestTemporaryPath,
        `${JSON.stringify(args.evidence.manifest, null, 2)}\n`,
        { encoding: "utf8", flag: "wx" },
      ),
    ]);
    await link(htmlTemporaryPath, htmlPath);
    htmlLinked = true;
    await link(manifestTemporaryPath, manifestPath);
    manifestLinked = true;
  } catch (error) {
    if (htmlLinked) await unlink(htmlPath);
    if (manifestLinked) await unlink(manifestPath);
    throw error;
  } finally {
    await Promise.all(
      [htmlTemporaryPath, manifestTemporaryPath].map(filePath =>
        unlink(filePath).catch(() => {}),
      ),
    );
  }
  return { htmlPath, manifestPath };
}

export function hashFinalEvidenceSource(text: string): string {
  if (!text.trim()) throw new Error("Final evidence source file is empty.");
  return createHash("sha256").update(text, "utf8").digest("hex");
}
