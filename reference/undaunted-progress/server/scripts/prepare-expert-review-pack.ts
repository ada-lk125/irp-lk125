import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildExpertReviewPack,
  type ExpertReviewProfile,
} from "../services/expert-review";

function values(args: string[], name: string): string[] {
  const result: string[] = [];
  const prefix = `${name}=`;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg.startsWith(prefix)) {
      const value = arg.slice(prefix.length);
      if (!value) throw new Error(`${name} needs a value.`);
      result.push(value);
    } else if (arg === name) {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${name} needs a value.`);
      }
      result.push(value);
      index += 1;
    }
  }
  return result;
}

function one(args: string[], name: string): string {
  const found = values(args, name);
  if (found.length !== 1) {
    throw new Error(`${name} must be provided exactly once.`);
  }
  return found[0];
}

function profile(value: string): ExpertReviewProfile {
  if (value === "legacy" || value === "normalisation-v1") return value;
  throw new Error("--profile must be legacy or normalisation-v1.");
}

async function protectedOutput(filePath: string, suffix: string): Promise<string> {
  const exportsRoot = path.resolve("exports");
  const resolved = path.resolve(filePath);
  const relative = path.relative(exportsRoot, resolved);
  const insideExports =
    relative.length > 0
    && !relative.startsWith("..")
    && !path.isAbsolute(relative);
  if (!insideExports || !path.basename(resolved).endsWith(suffix)) {
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
      "Usage: tsx server/scripts/prepare-expert-review-pack.ts --comparison <paired.local.json> --profile <legacy|normalisation-v1> --pack-id <id> --created-at <iso> --output <exports/*.local.csv> --manifest <exports/*.local.json>",
    );
    return;
  }
  const comparisonPath = one(args, "--comparison");
  if (!comparisonPath.endsWith(".local.json")) {
    throw new Error("--comparison must end with .local.json.");
  }
  const outputPath = await protectedOutput(one(args, "--output"), ".local.csv");
  const manifestPath = await protectedOutput(
    one(args, "--manifest"),
    ".local.json",
  );
  const comparisonText = await readFile(comparisonPath, "utf8");
  const pack = buildExpertReviewPack({
    comparison: JSON.parse(comparisonText) as unknown,
    comparisonSha256: createHash("sha256")
      .update(comparisonText, "utf8")
      .digest("hex"),
    packId: one(args, "--pack-id"),
    profile: profile(one(args, "--profile")),
    createdAt: one(args, "--created-at"),
    fileName: path.basename(outputPath),
  });
  await mkdir(path.dirname(outputPath), { recursive: true });
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(outputPath, pack.csv, { encoding: "utf8", flag: "wx" });
  await writeFile(
    manifestPath,
    `${JSON.stringify(pack.manifest, null, 2)}\n`,
    { encoding: "utf8", flag: "wx" },
  );
  console.log(`Wrote ${pack.manifest.profile} expert review pack to ${outputPath}`);
  console.log(`Wrote private rank/method manifest to ${manifestPath}`);
  console.log(
    `${pack.manifest.queryCount} funding-round cases; ${pack.manifest.rowCount} review rows.`,
  );
}

main().catch((error: Error) => {
  console.error(`Expert review pack failed: ${error.message}`);
  process.exitCode = 1;
});
