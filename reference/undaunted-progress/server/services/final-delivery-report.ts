import { createHash, randomUUID } from "node:crypto";
import { access, link, mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import {
  FINAL_EVIDENCE_PAGE_SCHEMA_VERSION,
  type FinalEvidencePageManifest,
  type FinalEvidenceSource,
} from "./final-evidence-page";
import {
  FINAL_MATCHER_HANDOFF_SCHEMA_VERSION,
  type FinalMatcherHandoff,
} from "./final-matcher-handoff";

export const FINAL_DELIVERY_REPORT_SCHEMA_VERSION =
  "final-delivery-report-v1";

export const FINAL_DELIVERY_SOURCE_FILES = [
  "matching.ts",
  "matching-normalisation.ts",
  "semantic-context.ts",
  "semantic-scorer.ts",
  "text-similarity-scorer.ts",
  "feedback-comparison-runner.ts",
  "feedback-ablation-intake.ts",
  "final-matcher-handoff.ts",
  "final-matcher-runtime.ts",
  "final-matcher-route-result.ts",
  "final-matcher-route-execution.ts",
  "final-matcher-route-lifecycle.ts",
  "final-ranking-movement.ts",
  "final-evidence-page.ts",
] as const;

export const FINAL_DELIVERY_REQUIRED_SCRIPTS = [
  "irp:check-week-four-readiness",
  "irp:check-week-five-semantic-readiness",
  "irp:check-week-six-feedback-readiness",
  "irp:check-week-seven-final-readiness",
  "irp:check-final-matcher-route-lifecycle",
  "irp:check-final-evidence-page",
  "irp:prepare-final-evidence-page",
  "irp:check-final-project-readiness",
  "irp:check-final-submission",
] as const;

type EvaluationStatus = "ready" | "waiting-for-frozen-evidence";
type ProductionStatus =
  | "awaiting-route-registration"
  | "blocked-by-evaluation";

export interface FinalDeliverySourceInput {
  fileName: string;
  text: string;
}

export interface FinalDeliveryReportManifest {
  schemaVersion: typeof FINAL_DELIVERY_REPORT_SCHEMA_VERSION;
  createdAt: string;
  implementation: {
    status: "ready";
    sourceSetSha256: string;
    fileCount: number;
    sources: FinalEvidenceSource[];
    requiredScripts: string[];
  };
  evaluation: {
    status: EvaluationStatus;
    handoff?: FinalEvidenceSource;
    evidence?: FinalEvidenceSource;
    selectedMethod?: FinalMatcherHandoff["selectedMethod"];
    aiModel?: string;
    matchingConfigHash?: string;
    feedbackSetHash?: string;
    implementationCommitSha?: string;
  };
  production: {
    status: ProductionStatus;
  };
  page: FinalEvidenceSource;
}

export interface FinalDeliveryReport {
  html: string;
  manifest: FinalDeliveryReportManifest;
}

export interface FinalEvaluationEvidence {
  handoff: FinalMatcherHandoff;
  handoffText: string;
  handoffSource: FinalEvidenceSource;
  evidence: FinalEvidencePageManifest;
  evidenceText: string;
  evidenceSource: FinalEvidenceSource;
}

function hash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function requireHash(
  value: string,
  label: string,
  length: 40 | 64,
): string {
  const normalised = String(value ?? "").trim().toLowerCase();
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

function requireJsonSource(args: {
  value: unknown;
  text: string;
  source: FinalEvidenceSource;
  label: string;
}) {
  if (hash(args.text) !== args.source.sha256) {
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

function requireImplementationSources(
  inputs: FinalDeliverySourceInput[],
): {
  sourceSetSha256: string;
  sources: FinalEvidenceSource[];
} {
  const expected = [...FINAL_DELIVERY_SOURCE_FILES].sort();
  const byName = new Map<string, string>();
  inputs.forEach(input => {
    const fileName = String(input.fileName ?? "").trim();
    if (
      fileName !== path.basename(fileName)
      || !expected.includes(
        fileName as (typeof FINAL_DELIVERY_SOURCE_FILES)[number],
      )
    ) {
      throw new Error(`Unsupported final implementation source: ${fileName}.`);
    }
    if (byName.has(fileName)) {
      throw new Error(`Duplicate final implementation source: ${fileName}.`);
    }
    if (!input.text.trim()) {
      throw new Error(`Final implementation source is empty: ${fileName}.`);
    }
    byName.set(fileName, input.text);
  });
  const actual = [...byName.keys()].sort();
  if (!isDeepStrictEqual(actual, expected)) {
    const missing = expected.filter(fileName => !byName.has(fileName));
    throw new Error(
      `Missing final implementation sources: ${missing.join(", ")}.`,
    );
  }
  const sources = expected.map(fileName => ({
    fileName,
    sha256: hash(byName.get(fileName)!),
  }));
  return {
    sourceSetSha256: hash(JSON.stringify(sources)),
    sources,
  };
}

function requireScripts(availableScripts: string[]): string[] {
  const available = new Set(availableScripts);
  const missing = FINAL_DELIVERY_REQUIRED_SCRIPTS.filter(
    script => !available.has(script),
  );
  if (missing.length > 0) {
    throw new Error(`Missing final delivery scripts: ${missing.join(", ")}.`);
  }
  return [...FINAL_DELIVERY_REQUIRED_SCRIPTS];
}

function requireEvaluation(
  input: FinalEvaluationEvidence,
): FinalDeliveryReportManifest["evaluation"] {
  if (
    input.handoff.schemaVersion !== FINAL_MATCHER_HANDOFF_SCHEMA_VERSION
    || input.handoff.status !== "ready-for-runtime-integration"
  ) {
    throw new Error("The final matcher handoff is not ready.");
  }
  if (input.evidence.schemaVersion !== FINAL_EVIDENCE_PAGE_SCHEMA_VERSION) {
    throw new Error("The final evidence manifest is not supported.");
  }
  const handoffSource = requireSource(
    input.handoffSource,
    "Final handoff source",
    ".local.final-matcher.json",
  );
  const evidenceSource = requireSource(
    input.evidenceSource,
    "Final evidence source",
    ".local.final-evidence.json",
  );
  requireJsonSource({
    value: input.handoff,
    text: input.handoffText,
    source: handoffSource,
    label: "Final handoff",
  });
  requireJsonSource({
    value: input.evidence,
    text: input.evidenceText,
    source: evidenceSource,
    label: "Final evidence manifest",
  });
  if (
    input.evidence.sources.handoff.fileName !== handoffSource.fileName
    || input.evidence.sources.handoff.sha256 !== handoffSource.sha256
  ) {
    throw new Error("The final evidence does not use the supplied handoff.");
  }
  if (
    input.evidence.batchId !== input.handoff.batchId
    || input.evidence.selectedMethod !== input.handoff.selectedMethod
    || input.evidence.aiModel !== input.handoff.aiModel
    || input.evidence.matchingConfigHash !==
      input.handoff.matchingConfigHash
    || input.evidence.feedbackSetHash !== input.handoff.feedbackSetHash
    || input.evidence.implementationCommitSha !==
      input.handoff.implementationCommitSha
    || !isDeepStrictEqual(input.evidence.decision, input.handoff.evaluation)
  ) {
    throw new Error("The final evidence identity does not match the handoff.");
  }
  return {
    status: "ready",
    handoff: handoffSource,
    evidence: evidenceSource,
    selectedMethod: input.handoff.selectedMethod,
    aiModel: input.handoff.aiModel,
    matchingConfigHash: requireHash(
      input.handoff.matchingConfigHash,
      "matchingConfigHash",
      64,
    ),
    feedbackSetHash: requireHash(
      input.handoff.feedbackSetHash,
      "feedbackSetHash",
      64,
    ),
    implementationCommitSha: requireHash(
      input.handoff.implementationCommitSha,
      "implementationCommitSha",
      40,
    ),
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderReport(
  manifest: Omit<FinalDeliveryReportManifest, "page">,
): string {
  const evaluationReady = manifest.evaluation.status === "ready";
  const evaluationLabel = evaluationReady
    ? "Frozen evidence ready"
    : "Waiting for scored exports and frozen evidence";
  const productionLabel = evaluationReady
    ? "Awaiting reviewed route registration"
    : "Blocked until evaluation is complete";
  const sourceRows = manifest.implementation.sources
    .map(
      source => `<tr>
        <td>${escapeHtml(source.fileName)}</td>
        <td><code>${source.sha256}</code></td>
      </tr>`,
    )
    .join("\n");
  const commandRows = manifest.implementation.requiredScripts
    .map(command => `<li><code>npm run ${escapeHtml(command)}</code></li>`)
    .join("\n");
  const identity = evaluationReady
    ? `<dl>
        <dt>Selected method</dt><dd>${escapeHtml(manifest.evaluation.selectedMethod!)}</dd>
        <dt>AI model</dt><dd>${escapeHtml(manifest.evaluation.aiModel!)}</dd>
        <dt>Matching config</dt><dd><code>${manifest.evaluation.matchingConfigHash}</code></dd>
        <dt>Feedback set</dt><dd><code>${manifest.evaluation.feedbackSetHash}</code></dd>
        <dt>Implementation commit</dt><dd><code>${manifest.evaluation.implementationCommitSha}</code></dd>
      </dl>`
    : `<p class="pending-copy">No final method is selected here. The report will add the model, configuration, feedback set and implementation commit after the authoritative handoff and evidence manifest are available.</p>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Final delivery status</title>
  <style>
    :root {
      color-scheme: light;
      font-family: Arial, sans-serif;
      color: #171a18;
      background: #f3f5f2;
      letter-spacing: 0;
    }
    * { box-sizing: border-box; }
    body { margin: 0; }
    header {
      padding: 34px max(24px, calc((100vw - 1120px) / 2));
      background: #242724;
      color: #ffffff;
      border-bottom: 5px solid #2d9d68;
    }
    h1 { margin: 0 0 9px; font-size: 31px; letter-spacing: 0; }
    header p { margin: 0; color: #d9dedb; line-height: 1.5; }
    main { width: min(1120px, calc(100% - 36px)); margin: 26px auto 52px; }
    .status-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      border: 1px solid #d3d8d4;
      background: #ffffff;
      border-radius: 6px;
      overflow: hidden;
    }
    .status {
      min-height: 142px;
      padding: 20px;
      border-right: 1px solid #e0e4e1;
    }
    .status:last-child { border-right: 0; }
    .status span {
      display: inline-block;
      padding: 4px 7px;
      margin-bottom: 13px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 700;
    }
    .ready span { color: #17633f; background: #dcf2e6; }
    .waiting span { color: #795500; background: #fff0bd; }
    .blocked span { color: #8b322a; background: #f8dedb; }
    .status h2 { margin: 0 0 8px; font-size: 18px; letter-spacing: 0; }
    .status p { margin: 0; color: #59615b; line-height: 1.45; }
    section { margin-top: 30px; }
    section > h2 { margin: 0 0 12px; font-size: 22px; letter-spacing: 0; }
    section > p { color: #59615b; line-height: 1.55; }
    .source-hash {
      padding: 16px 18px;
      border-left: 5px solid #c36a36;
      background: #fff4ea;
      overflow-wrap: anywhere;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      background: #ffffff;
      border: 1px solid #d3d8d4;
    }
    th, td {
      padding: 11px 13px;
      text-align: left;
      border-bottom: 1px solid #e3e6e4;
      vertical-align: top;
    }
    th { color: #4f5751; background: #edf0ed; }
    tr:last-child td { border-bottom: 0; }
    td:first-child { width: 34%; font-weight: 700; }
    code { font-size: 11px; overflow-wrap: anywhere; }
    .commands, .identity {
      background: #ffffff;
      border: 1px solid #d3d8d4;
      padding: 18px 20px;
    }
    .commands ul { margin: 0; padding-left: 20px; }
    .commands li { margin: 8px 0; }
    dl {
      display: grid;
      grid-template-columns: 190px minmax(0, 1fr);
      gap: 10px 16px;
      margin: 0;
    }
    dt { color: #59615b; }
    dd { margin: 0; overflow-wrap: anywhere; }
    .pending-copy { margin: 0; color: #59615b; line-height: 1.55; }
    @media (max-width: 760px) {
      header { padding: 28px 18px; }
      main { width: min(100% - 22px, 1120px); }
      .status-grid { grid-template-columns: 1fr; }
      .status { border-right: 0; border-bottom: 1px solid #e0e4e1; }
      .status:last-child { border-bottom: 0; }
      .table-wrap { overflow-x: auto; }
      table { min-width: 720px; }
      dl { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <header>
    <h1>Final delivery status</h1>
    <p>Implementation coverage, frozen evaluation evidence and production activation are tracked separately.</p>
  </header>
  <main>
    <div class="status-grid">
      <div class="status ready">
        <span>READY</span>
        <h2>Implementation</h2>
        <p>${manifest.implementation.fileCount} core files and the final test commands are present.</p>
      </div>
      <div class="status ${evaluationReady ? "ready" : "waiting"}">
        <span>${evaluationReady ? "READY" : "WAITING"}</span>
        <h2>Frozen evaluation</h2>
        <p>${escapeHtml(evaluationLabel)}.</p>
      </div>
      <div class="status ${evaluationReady ? "waiting" : "blocked"}">
        <span>${evaluationReady ? "WAITING" : "BLOCKED"}</span>
        <h2>Production route</h2>
        <p>${escapeHtml(productionLabel)}.</p>
      </div>
    </div>
    <section>
      <h2>Implementation identity</h2>
      <p class="source-hash">Source-set SHA-256: <code>${manifest.implementation.sourceSetSha256}</code></p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Core file</th><th>SHA-256</th></tr></thead>
          <tbody>${sourceRows}</tbody>
        </table>
      </div>
    </section>
    <section>
      <h2>Repeatable checks</h2>
      <div class="commands"><ul>${commandRows}</ul></div>
    </section>
    <section>
      <h2>Evaluation identity</h2>
      <div class="identity">${identity}</div>
    </section>
  </main>
</body>
</html>
`;
}

export function buildFinalDeliveryReport(args: {
  sources: FinalDeliverySourceInput[];
  availableScripts: string[];
  finalEvidence?: FinalEvaluationEvidence;
  createdAt: string;
  htmlFileName: string;
}): FinalDeliveryReport {
  const implementation = requireImplementationSources(args.sources);
  const requiredScripts = requireScripts(args.availableScripts);
  const evaluation = args.finalEvidence
    ? requireEvaluation(args.finalEvidence)
    : { status: "waiting-for-frozen-evidence" as const };
  const productionStatus: ProductionStatus =
    evaluation.status === "ready"
      ? "awaiting-route-registration"
      : "blocked-by-evaluation";
  if (
    args.htmlFileName !== path.basename(args.htmlFileName)
    || !args.htmlFileName.endsWith(".local.final-delivery.html")
  ) {
    throw new Error(
      "htmlFileName must use a private .local.final-delivery.html name.",
    );
  }
  const manifestWithoutPage: Omit<FinalDeliveryReportManifest, "page"> = {
    schemaVersion: FINAL_DELIVERY_REPORT_SCHEMA_VERSION,
    createdAt: requireCreatedAt(args.createdAt),
    implementation: {
      status: "ready" as const,
      sourceSetSha256: implementation.sourceSetSha256,
      fileCount: implementation.sources.length,
      sources: implementation.sources,
      requiredScripts,
    },
    evaluation,
    production: { status: productionStatus },
  };
  const html = renderReport(manifestWithoutPage);
  return {
    html,
    manifest: {
      ...manifestWithoutPage,
      page: {
        fileName: args.htmlFileName,
        sha256: hash(html),
      },
    },
  };
}

function resolveOutput(args: {
  filePath: string;
  workingDirectory: string;
  suffix: ".local.final-delivery.html" | ".local.final-delivery.json";
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
      `Final delivery output must stay inside exports/ and end with ${args.suffix}.`,
    );
  }
  return resolved;
}

async function assertAvailable(filePath: string) {
  try {
    await access(filePath);
    throw new Error(`Final delivery output already exists: ${filePath}.`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export async function writeFinalDeliveryReport(args: {
  report: FinalDeliveryReport;
  htmlPath: string;
  manifestPath: string;
  workingDirectory?: string;
}): Promise<{ htmlPath: string; manifestPath: string }> {
  const workingDirectory = args.workingDirectory ?? process.cwd();
  const htmlPath = resolveOutput({
    filePath: args.htmlPath,
    workingDirectory,
    suffix: ".local.final-delivery.html",
  });
  const manifestPath = resolveOutput({
    filePath: args.manifestPath,
    workingDirectory,
    suffix: ".local.final-delivery.json",
  });
  if (path.basename(htmlPath) !== args.report.manifest.page.fileName) {
    throw new Error("HTML output name does not match the delivery manifest.");
  }
  if (hash(args.report.html) !== args.report.manifest.page.sha256) {
    throw new Error("HTML content does not match the delivery manifest.");
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
      writeFile(htmlTemporaryPath, args.report.html, {
        encoding: "utf8",
        flag: "wx",
      }),
      writeFile(
        manifestTemporaryPath,
        `${JSON.stringify(args.report.manifest, null, 2)}\n`,
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
