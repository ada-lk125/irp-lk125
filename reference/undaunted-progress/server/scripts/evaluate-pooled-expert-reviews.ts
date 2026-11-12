import { spawnSync } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildPooledExpertReviewEvaluation,
  parsePooledExpertReviewManifest,
} from "../services/pooled-expert-review";

function values(args: string[], name: string): string[] {
  const result: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== name) continue;
    const found = args[index + 1];
    if (!found || found.startsWith("--")) throw new Error(`${name} needs a value.`);
    result.push(found);
    index += 1;
  }
  return result;
}

function value(args: string[], name: string): string {
  const found = values(args, name);
  if (found.length !== 1) throw new Error(`${name} must be provided exactly once.`);
  return found[0];
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
  if (
    relative.length === 0
    || relative.startsWith("..")
    || path.isAbsolute(relative)
    || !path.basename(resolved).endsWith(".local.json")
  ) {
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
  const reviewPaths = values(args, "--review");
  const manifestPaths = values(args, "--manifest");
  if (reviewPaths.length < 1 || reviewPaths.length !== manifestPaths.length) {
    throw new Error("Provide one --manifest for every completed --review.");
  }
  const purpose = value(args, "--purpose");
  if (purpose !== "pilot" && purpose !== "formal") {
    throw new Error("--purpose must be pilot or formal.");
  }
  const gitCommit = gitValue(["rev-parse", "HEAD"]);
  const workingTreeDirty = gitValue(["status", "--porcelain"]).length > 0;
  if (purpose === "formal" && workingTreeDirty) {
    throw new Error("Formal pooled evaluation requires a clean Git worktree.");
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
      manifest: parsePooledExpertReviewManifest(
        JSON.parse(manifestText) as unknown,
      ),
    });
  }
  const evaluation = buildPooledExpertReviewEvaluation({ reviews });
  const createdAt = new Date(value(args, "--created-at"));
  if (Number.isNaN(createdAt.getTime())) {
    throw new Error("--created-at must be an ISO timestamp.");
  }
  const outputPath = await protectedOutput(value(args, "--output"));
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    `${JSON.stringify({
      run: {
        schemaVersion: evaluation.schemaVersion,
        evaluationId: value(args, "--evaluation-id"),
        purpose,
        createdAt: createdAt.toISOString(),
        implementation: { gitCommit, workingTreeDirty },
      },
      ...evaluation,
    }, null, 2)}\n`,
    { encoding: "utf8", flag: "wx" },
  );
  console.log(`Wrote pooled expert review evaluation to ${outputPath}`);
  console.log(
    `${evaluation.reviewerCount} reviewer(s); aggregate P@10 delta ${evaluation.aggregate.delta.thumbsUpAt10}.`,
  );
}

main().catch((error: Error) => {
  console.error(`Pooled expert review evaluation failed: ${error.message}`);
  process.exitCode = 1;
});
