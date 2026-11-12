import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import type { FinalEvidencePageManifest } from "../services/final-evidence-page";
import {
  buildFinalDeliveryReport,
  FINAL_DELIVERY_SOURCE_FILES,
  writeFinalDeliveryReport,
} from "../services/final-delivery-report";
import type { FinalMatcherHandoff } from "../services/final-matcher-handoff";

type Option =
  | "createdAt"
  | "htmlOutput"
  | "manifestOutput"
  | "handoff"
  | "evidence";

const OPTIONS: Record<string, Option> = {
  "--created-at": "createdAt",
  "--html-output": "htmlOutput",
  "--manifest-output": "manifestOutput",
  "--handoff": "handoff",
  "--evidence-manifest": "evidence",
};

function usage(): never {
  console.error(
    "Usage: prepare-final-delivery-report.ts --created-at <ISO timestamp> --html-output <report.local.final-delivery.html> --manifest-output <report.local.final-delivery.json> [--handoff <handoff.local.final-matcher.json> --evidence-manifest <evidence.local.final-evidence.json>]",
  );
  process.exit(1);
}

function parseArgs(args: string[]): Partial<Record<Option, string>> {
  const parsed: Partial<Record<Option, string>> = {};
  for (let index = 0; index < args.length; index += 2) {
    const option = OPTIONS[args[index]];
    const value = args[index + 1];
    if (!option || !value || value.startsWith("--")) usage();
    if (parsed[option]) {
      throw new Error(`${args[index]} was provided more than once.`);
    }
    parsed[option] = value;
  }
  if (!parsed.createdAt || !parsed.htmlOutput || !parsed.manifestOutput) {
    usage();
  }
  if (Boolean(parsed.handoff) !== Boolean(parsed.evidence)) {
    throw new Error(
      "--handoff and --evidence-manifest must be provided together.",
    );
  }
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

async function detectServicesDirectory(): Promise<string> {
  for (const candidate of ["server/services", "src/services"]) {
    try {
      await access(path.resolve(process.cwd(), candidate));
      return candidate;
    } catch {
      // Try the next repository layout.
    }
  }
  throw new Error("Could not find the final implementation services directory.");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const servicesDirectory = await detectServicesDirectory();
  const sources = await Promise.all(
    FINAL_DELIVERY_SOURCE_FILES.map(async fileName => ({
      fileName,
      text: await readFile(
        path.resolve(process.cwd(), servicesDirectory, fileName),
        "utf8",
      ),
    })),
  );
  const packageText = await readFile(
    path.resolve(process.cwd(), "package.json"),
    "utf8",
  );
  const packageJson = parseJson<{ scripts?: Record<string, string> }>(
    packageText,
    "package.json",
  );

  let finalEvidence;
  if (args.handoff && args.evidence) {
    const handoffPath = privateInput(
      args.handoff,
      ".local.final-matcher.json",
    );
    const evidencePath = privateInput(
      args.evidence,
      ".local.final-evidence.json",
    );
    const [handoffText, evidenceText] = await Promise.all([
      readFile(handoffPath, "utf8"),
      readFile(evidencePath, "utf8"),
    ]);
    const source = (filePath: string, text: string) => ({
      fileName: path.basename(filePath),
      sha256: hashText(text),
    });
    finalEvidence = {
      handoff: parseJson<FinalMatcherHandoff>(
        handoffText,
        "Final matcher handoff",
      ),
      handoffText,
      handoffSource: source(handoffPath, handoffText),
      evidence: parseJson<FinalEvidencePageManifest>(
        evidenceText,
        "Final evidence manifest",
      ),
      evidenceText,
      evidenceSource: source(evidencePath, evidenceText),
    };
  }

  const report = buildFinalDeliveryReport({
    sources,
    availableScripts: Object.keys(packageJson.scripts ?? {}),
    finalEvidence,
    createdAt: args.createdAt!,
    htmlFileName: path.basename(args.htmlOutput!),
  });
  const outputs = await writeFinalDeliveryReport({
    report,
    htmlPath: args.htmlOutput!,
    manifestPath: args.manifestOutput!,
  });
  console.log(`Wrote final delivery page: ${outputs.htmlPath}`);
  console.log(`Wrote final delivery manifest: ${outputs.manifestPath}`);
  console.log(
    `Implementation: ${report.manifest.implementation.status} (${report.manifest.implementation.fileCount} files)`,
  );
  console.log(
    `Source-set SHA-256: ${report.manifest.implementation.sourceSetSha256}`,
  );
  console.log(`Evaluation: ${report.manifest.evaluation.status}`);
  console.log(`Production: ${report.manifest.production.status}`);
}

function hashText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

main().catch(error => {
  console.error(
    `Final delivery report failed: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exitCode = 1;
});
