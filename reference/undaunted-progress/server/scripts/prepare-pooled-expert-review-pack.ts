import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildPooledExpertReviewPack } from "../services/pooled-expert-review";

function value(args: string[], name: string): string {
  const index = args.indexOf(name);
  const found = index >= 0 ? args[index + 1] : undefined;
  if (!found || found.startsWith("--")) throw new Error(`${name} needs a value.`);
  return found;
}

async function protectedOutput(filePath: string, suffix: string): Promise<string> {
  const exportsRoot = path.resolve("exports");
  const resolved = path.resolve(filePath);
  const relative = path.relative(exportsRoot, resolved);
  if (
    relative.length === 0
    || relative.startsWith("..")
    || path.isAbsolute(relative)
    || !path.basename(resolved).endsWith(suffix)
  ) {
    throw new Error(`Output must stay inside exports/ and end with ${suffix}.`);
  }
  try {
    await access(resolved);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return resolved;
    throw error;
  }
  throw new Error(`Output already exists and will not be overwritten: ${filePath}`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log(
      "Usage: tsx server/scripts/prepare-pooled-expert-review-pack.ts --comparison <paired.local.json> --pack-id <id> --created-at <iso> --output <exports/*.local.csv> --manifest <exports/*.local.json>",
    );
    return;
  }
  const comparisonPath = value(args, "--comparison");
  if (!comparisonPath.endsWith(".local.json")) {
    throw new Error("--comparison must end with .local.json.");
  }
  const outputPath = await protectedOutput(value(args, "--output"), ".local.csv");
  const manifestPath = await protectedOutput(
    value(args, "--manifest"),
    ".local.json",
  );
  const comparisonText = await readFile(comparisonPath, "utf8");
  const pack = buildPooledExpertReviewPack({
    comparison: JSON.parse(comparisonText) as unknown,
    comparisonSha256: createHash("sha256")
      .update(comparisonText, "utf8")
      .digest("hex"),
    packId: value(args, "--pack-id"),
    createdAt: value(args, "--created-at"),
    fileName: path.basename(outputPath),
  });
  await mkdir(path.dirname(outputPath), { recursive: true });
  await Promise.all([
    writeFile(outputPath, pack.csv, { encoding: "utf8", flag: "wx" }),
    writeFile(manifestPath, `${JSON.stringify(pack.manifest, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    }),
  ]);
  console.log(`Wrote algorithm-blinded pooled review CSV to ${outputPath}`);
  console.log(`Wrote private algorithm/rank/score manifest to ${manifestPath}`);
  console.log(
    `${pack.manifest.queryCount} cases; ${pack.manifest.rowCount} unique query-investor pairs.`,
  );
}

main().catch((error: Error) => {
  console.error(`Pooled expert review pack failed: ${error.message}`);
  process.exitCode = 1;
});
