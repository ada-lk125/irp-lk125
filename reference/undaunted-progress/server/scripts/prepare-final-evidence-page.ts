import { readFile } from "node:fs/promises";
import path from "node:path";
import type { FeedbackEvaluationVisualisationManifest } from "../services/feedback-evaluation-visualisation";
import {
  buildFinalEvidencePage,
  hashFinalEvidenceSource,
  writeFinalEvidencePage,
} from "../services/final-evidence-page";
import type { FinalMatcherHandoff } from "../services/final-matcher-handoff";
import type { FinalRankingMovementManifest } from "../services/final-ranking-movement";

type Option =
  | "handoff"
  | "metricManifest"
  | "metricSvg"
  | "q1Manifest"
  | "q1Svg"
  | "q2Manifest"
  | "q2Svg"
  | "q3Manifest"
  | "q3Svg"
  | "createdAt"
  | "htmlOutput"
  | "manifestOutput";

const OPTIONS: Record<string, Option> = {
  "--handoff": "handoff",
  "--metric-manifest": "metricManifest",
  "--metric-svg": "metricSvg",
  "--q1-ranking-manifest": "q1Manifest",
  "--q1-ranking-svg": "q1Svg",
  "--q2-ranking-manifest": "q2Manifest",
  "--q2-ranking-svg": "q2Svg",
  "--q3-ranking-manifest": "q3Manifest",
  "--q3-ranking-svg": "q3Svg",
  "--created-at": "createdAt",
  "--html-output": "htmlOutput",
  "--manifest-output": "manifestOutput",
};

function usage(): never {
  console.error(
    "Usage: prepare-final-evidence-page.ts --handoff <handoff.local.final-matcher.json> --metric-manifest <metrics.local.visualisation.json> --metric-svg <metrics.local.svg> --q1-ranking-manifest <q1.local.ranking-movement.json> --q1-ranking-svg <q1.local.svg> --q2-ranking-manifest <q2.local.ranking-movement.json> --q2-ranking-svg <q2.local.svg> --q3-ranking-manifest <q3.local.ranking-movement.json> --q3-ranking-svg <q3.local.svg> --created-at <ISO timestamp> --html-output <report.local.final-evidence.html> --manifest-output <report.local.final-evidence.json>",
  );
  process.exit(1);
}

function parseArgs(args: string[]): Record<Option, string> {
  const parsed = {} as Record<Option, string>;
  for (let index = 0; index < args.length; index += 2) {
    const option = OPTIONS[args[index]];
    const value = args[index + 1];
    if (!option || !value || value.startsWith("--")) usage();
    if (parsed[option]) {
      throw new Error(`${args[index]} was provided more than once.`);
    }
    parsed[option] = value;
  }
  if (Object.keys(parsed).length !== Object.keys(OPTIONS).length) usage();
  return parsed;
}

function privateInput(filePath: string, suffix: string): string {
  const exportsRoot = path.resolve(process.cwd(), "exports");
  const resolved = path.resolve(process.cwd(), filePath);
  const relative = path.relative(exportsRoot, resolved);
  if (
    relative.length === 0
    || relative.startsWith("..")
    || path.isAbsolute(relative)
    || !path.basename(resolved).endsWith(suffix)
  ) {
    throw new Error(
      `Private input must stay inside exports/ and end with ${suffix}.`,
    );
  }
  return resolved;
}

function parseJson<T>(text: string, label: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${label} must contain valid JSON.`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const paths = {
    handoff: privateInput(args.handoff, ".local.final-matcher.json"),
    metricManifest: privateInput(
      args.metricManifest,
      ".local.visualisation.json",
    ),
    metricSvg: privateInput(args.metricSvg, ".local.svg"),
    q1Manifest: privateInput(
      args.q1Manifest,
      ".local.ranking-movement.json",
    ),
    q1Svg: privateInput(args.q1Svg, ".local.svg"),
    q2Manifest: privateInput(
      args.q2Manifest,
      ".local.ranking-movement.json",
    ),
    q2Svg: privateInput(args.q2Svg, ".local.svg"),
    q3Manifest: privateInput(
      args.q3Manifest,
      ".local.ranking-movement.json",
    ),
    q3Svg: privateInput(args.q3Svg, ".local.svg"),
  };
  const entries = await Promise.all(
    Object.entries(paths).map(async ([name, filePath]) => [
      name,
      await readFile(filePath, "utf8"),
    ]),
  );
  const texts = Object.fromEntries(entries) as Record<keyof typeof paths, string>;
  const source = (filePath: string, text: string) => ({
    fileName: path.basename(filePath),
    sha256: hashFinalEvidenceSource(text),
  });
  const ranking = (alias: "q1" | "q2" | "q3") => {
    const manifestKey = `${alias}Manifest` as const;
    const svgKey = `${alias}Svg` as const;
    return {
      manifest: parseJson<FinalRankingMovementManifest>(
        texts[manifestKey],
        `${alias.toUpperCase()} ranking manifest`,
      ),
      manifestText: texts[manifestKey],
      manifestSource: source(paths[manifestKey], texts[manifestKey]),
      svg: texts[svgKey],
      svgSource: source(paths[svgKey], texts[svgKey]),
    };
  };
  const evidence = buildFinalEvidencePage({
    handoff: parseJson<FinalMatcherHandoff>(
      texts.handoff,
      "Final matcher handoff",
    ),
    handoffText: texts.handoff,
    handoffSource: source(paths.handoff, texts.handoff),
    metricManifest: parseJson<FeedbackEvaluationVisualisationManifest>(
      texts.metricManifest,
      "Metric visualisation manifest",
    ),
    metricManifestText: texts.metricManifest,
    metricManifestSource: source(
      paths.metricManifest,
      texts.metricManifest,
    ),
    metricSvg: texts.metricSvg,
    metricSvgSource: source(paths.metricSvg, texts.metricSvg),
    rankings: [ranking("q1"), ranking("q2"), ranking("q3")],
    createdAt: args.createdAt,
    htmlFileName: path.basename(args.htmlOutput),
  });
  const outputs = await writeFinalEvidencePage({
    evidence,
    htmlPath: args.htmlOutput,
    manifestPath: args.manifestOutput,
  });
  console.log(`Wrote final evidence page: ${outputs.htmlPath}`);
  console.log(`Wrote final evidence manifest: ${outputs.manifestPath}`);
  console.log(`Selected method: ${evidence.manifest.selectedMethod}`);
  console.log(`Review outcome: ${evidence.manifest.decision.reviewOutcome}`);
}

main().catch(error => {
  console.error(
    `Final evidence page failed: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exitCode = 1;
});
