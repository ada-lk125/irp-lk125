import { spawnSync } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildExpertReviewEvaluation,
  parseExpertReviewManifest,
} from "../services/expert-review";

type Purpose = "pilot" | "formal";

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

function purpose(value: string): Purpose {
  if (value === "pilot" || value === "formal") return value;
  throw new Error("--purpose must be pilot or formal.");
}

function createdAt(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("--created-at must be an ISO timestamp.");
  }
  return parsed.toISOString();
}

function gitValue(args: string[]): string {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed.`);
  return result.stdout.trim();
}

async function protectedOutput(filePath: string): Promise<string> {
  const exportsRoot = path.resolve("exports");
  const resolved = path.resolve(filePath);
  const relative = path.relative(exportsRoot, resolved);
  const insideExports =
    relative.length > 0
    && !relative.startsWith("..")
    && !path.isAbsolute(relative);
  if (!insideExports || !path.basename(resolved).endsWith(".local.json")) {
    throw new Error("Output must stay inside exports/ and end with .local.json.");
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
      "Usage: tsx server/scripts/evaluate-expert-reviews.ts --review <returned.local.csv> --manifest <pack.local.json> [repeat both options] --evaluation-id <id> --purpose <pilot|formal> --created-at <iso> --output <exports/*.local.json>",
    );
    return;
  }
  const reviewPaths = values(args, "--review");
  const manifestPaths = values(args, "--manifest");
  if (reviewPaths.length < 2 || reviewPaths.length !== manifestPaths.length) {
    throw new Error(
      "Provide matching --review and --manifest options for at least one baseline and one optimised pack.",
    );
  }
  if (
    reviewPaths.some(filePath => !filePath.endsWith(".local.csv"))
    || manifestPaths.some(filePath => !filePath.endsWith(".local.json"))
  ) {
    throw new Error("Review files must use protected .local.csv/.local.json names.");
  }
  const evaluationPurpose = purpose(one(args, "--purpose"));
  const gitCommit = gitValue(["rev-parse", "HEAD"]);
  const workingTreeDirty = gitValue(["status", "--porcelain"]).length > 0;
  if (evaluationPurpose === "formal" && workingTreeDirty) {
    throw new Error("Formal expert evaluation requires a clean Git worktree.");
  }
  const reviews = [];
  for (let index = 0; index < reviewPaths.length; index += 1) {
    const [csv, manifestText] = await Promise.all([
      readFile(reviewPaths[index], "utf8"),
      readFile(manifestPaths[index], "utf8"),
    ]);
    reviews.push({
      fileName: path.basename(reviewPaths[index]),
      csv,
      manifest: parseExpertReviewManifest(JSON.parse(manifestText) as unknown),
    });
  }
  const evaluation = buildExpertReviewEvaluation({ reviews });
  const outputPath = await protectedOutput(one(args, "--output"));
  const output = {
    run: {
      schemaVersion: evaluation.schemaVersion,
      evaluationId: one(args, "--evaluation-id"),
      purpose: evaluationPurpose,
      createdAt: createdAt(one(args, "--created-at")),
      implementation: { gitCommit, workingTreeDirty },
    },
    ...evaluation,
  };
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  console.log(`Wrote expert review evaluation to ${outputPath}`);
  console.log(
    `${evaluation.reviewerCount} reviewer(s); aggregate P@10 delta ${evaluation.aggregate.delta.thumbsUpAt10}.`,
  );
}

main().catch((error: Error) => {
  console.error(`Expert review evaluation failed: ${error.message}`);
  process.exitCode = 1;
});
