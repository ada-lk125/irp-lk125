import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { FinalMatcherHandoff } from "../services/final-matcher-handoff";
import {
  buildFinalRankingMovement,
  writeFinalRankingMovement,
} from "../services/final-ranking-movement";

type RequiredOption =
  | "baselineResult"
  | "selectedResult"
  | "handoff"
  | "queryAlias"
  | "createdAt"
  | "svgOutput"
  | "manifestOutput";

const OPTIONS: Record<string, RequiredOption | "topN"> = {
  "--baseline-result": "baselineResult",
  "--selected-result": "selectedResult",
  "--handoff": "handoff",
  "--query-alias": "queryAlias",
  "--created-at": "createdAt",
  "--top-n": "topN",
  "--svg-output": "svgOutput",
  "--manifest-output": "manifestOutput",
};

function usage(): never {
  console.error(
    "Usage: prepare-final-ranking-movement.ts --baseline-result <baseline.local.json> --selected-result <selected.local.json> --handoff <handoff.local.final-matcher.json> --query-alias <Q1> --created-at <ISO timestamp> [--top-n <1-10>] --svg-output <chart.local.svg> --manifest-output <chart.local.ranking-movement.json>",
  );
  process.exit(1);
}

function parseArgs(args: string[]): Record<RequiredOption, string> & {
  topN?: string;
} {
  const parsed: Partial<
    Record<RequiredOption | "topN", string>
  > = {};
  for (let index = 0; index < args.length; index += 2) {
    const option = OPTIONS[args[index]];
    const value = args[index + 1];
    if (!option || !value || value.startsWith("--")) usage();
    if (parsed[option]) {
      throw new Error(`${args[index]} was provided more than once.`);
    }
    parsed[option] = value;
  }
  const required: RequiredOption[] = [
    "baselineResult",
    "selectedResult",
    "handoff",
    "queryAlias",
    "createdAt",
    "svgOutput",
    "manifestOutput",
  ];
  if (required.some(option => !parsed[option])) usage();
  return parsed as Record<RequiredOption, string> & { topN?: string };
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
    baseline: privateInput(args.baselineResult, ".local.json"),
    selected: privateInput(args.selectedResult, ".local.json"),
    handoff: privateInput(args.handoff, ".local.final-matcher.json"),
  };
  const texts = {
    baseline: await readFile(paths.baseline, "utf8"),
    selected: await readFile(paths.selected, "utf8"),
    handoff: await readFile(paths.handoff, "utf8"),
  };
  const source = (filePath: string, text: string) => ({
    fileName: path.basename(filePath),
    sha256: createHash("sha256").update(text, "utf8").digest("hex"),
  });
  const topN = args.topN === undefined ? undefined : Number(args.topN);
  const visualisation = buildFinalRankingMovement({
    baseline: parseJson(texts.baseline, "Baseline result"),
    selected: parseJson(texts.selected, "Selected result"),
    handoff: parseJson<FinalMatcherHandoff>(texts.handoff, "Final handoff"),
    sources: {
      baseline: source(paths.baseline, texts.baseline),
      selected: source(paths.selected, texts.selected),
      handoff: source(paths.handoff, texts.handoff),
    },
    queryAlias: args.queryAlias,
    topN,
    createdAt: args.createdAt,
    svgFileName: path.basename(args.svgOutput),
  });
  const outputs = await writeFinalRankingMovement({
    visualisation,
    svgPath: args.svgOutput,
    manifestPath: args.manifestOutput,
  });
  console.log(`Wrote ranking chart: ${outputs.svgPath}`);
  console.log(`Wrote ranking manifest: ${outputs.manifestPath}`);
  console.log(
    "The chart shows anonymous rank movement only; frozen metrics determine improvement.",
  );
}

main().catch(error => {
  console.error(
    `Final ranking movement failed: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exitCode = 1;
});
