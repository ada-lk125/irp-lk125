import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  assertSemanticReviewOutputAvailable,
  buildSemanticComparisonReviewPack,
} from "../services/semantic-comparison-review";

const usage = [
  "Usage:",
  "  tsx server/scripts/review-semantic-comparisons.ts --input <file> --input <file> --input <file> [options]",
  "",
  "Options:",
  "  --output <path>      Write the private review under exports/*.local.json.",
  "  --created-at <iso>   Use a stable ISO timestamp.",
  "  --help               Show this help text.",
].join("\n");

function getArgValue(args: string[], name: string): string | undefined {
  const prefix = `${name}=`;
  const inline = args.find(arg => arg.startsWith(prefix));
  if (inline) {
    const value = inline.slice(prefix.length);
    if (!value) throw new Error(`${name} needs a value.`);
    return value;
  }
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} needs a value.`);
  return value;
}

function getArgValues(args: string[], name: string): string[] {
  const values: string[] = [];
  const prefix = `${name}=`;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg.startsWith(prefix)) {
      const value = arg.slice(prefix.length);
      if (!value) throw new Error(`${name} needs a value.`);
      values.push(value);
    } else if (arg === name) {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${name} needs a value.`);
      values.push(value);
      index += 1;
    }
  }
  return values;
}

function resolveLocalInput(filePath: string): string {
  const exportsRoot = path.resolve("exports");
  const resolved = path.resolve(filePath);
  const relative = path.relative(exportsRoot, resolved);
  const insideExports = relative.length > 0
    && !relative.startsWith("..")
    && !path.isAbsolute(relative);
  if (!insideExports || !path.basename(resolved).endsWith(".local.json")) {
    throw new Error("Review inputs must stay inside exports/ and end with .local.json.");
  }
  return resolved;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log(usage);
    return;
  }
  const inputPaths = getArgValues(args, "--input");
  if (inputPaths.length === 0) throw new Error(`Missing --input.\n\n${usage}`);
  if (new Set(inputPaths.map(inputPath => path.resolve(inputPath))).size !== inputPaths.length) {
    throw new Error("Review input paths must be unique.");
  }
  const outputPath = getArgValue(args, "--output")
    ?? "exports/semantic-comparison-review.local.json";
  const createdAt = getArgValue(args, "--created-at");
  const inputs = await Promise.all(
    inputPaths.map(inputPath =>
      readFile(resolveLocalInput(inputPath), "utf8").then(value => JSON.parse(value) as unknown),
    ),
  );
  const review = buildSemanticComparisonReviewPack({ exports: inputs, createdAt });
  const resolvedOutput = await assertSemanticReviewOutputAvailable(outputPath);

  await mkdir(path.dirname(resolvedOutput), { recursive: true });
  await writeFile(resolvedOutput, `${JSON.stringify(review, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  console.log(`Wrote ${review.queryCount}-query semantic review to ${outputPath}`);
  console.log("Frozen labels are still required before any method can be selected.");
}

main().catch((error: Error) => {
  console.error(`Semantic comparison review failed: ${error.message}`);
  process.exit(1);
});
