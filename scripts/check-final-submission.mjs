#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  statSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
process.chdir(repositoryRoot);

const isIrpRepository = existsSync(
  "reference/undaunted-progress/package.json",
);
const isUndauntedRepository = existsSync(
  "artifacts/api-server/package.json",
);

if (isIrpRepository === isUndauntedRepository) {
  throw new Error(
    "Run this check from either the IRP repository or Undaunted-Hub.",
  );
}

const layout = isIrpRepository
  ? {
      name: "IRP submission",
      packagePaths: [
        "package.json",
        "reference/undaunted-progress/package.json",
      ],
      privateOutputPrefix: "reference/undaunted-progress/exports/",
      markdownRoots: [
        "README.md",
        "docs/",
        "logbook/",
        "notes/",
        "reference/undaunted-progress/README.md",
      ],
      requiredFiles: [
        "README.md",
        "package.json",
        "deliverables/lk125-project-plan.pdf",
        "docs/2026-08-03-maiko-final-evaluation-protocol.md",
        "docs/algorithm-decision-log.md",
        "docs/final-report-scaffold.md",
        "docs/version-freeze.md",
        "docs/final-project-readiness.md",
        "docs/final-delivery-report.md",
        "logbook/logbook.md",
        "notes/daily-progress.md",
        "reference/undaunted-baseline/server/services/matching.ts",
        "reference/undaunted-progress/package.json",
        "reference/undaunted-progress/package-lock.json",
        "reference/undaunted-progress/vitest.config.ts",
        "reference/undaunted-progress/client/index.html",
        "reference/undaunted-progress/client/app.js",
        "reference/undaunted-progress/client/styles.css",
        "reference/undaunted-progress/server/demo.ts",
        "reference/undaunted-progress/server/demo.test.ts",
        "reference/undaunted-progress/server/services/matching.ts",
        "reference/undaunted-progress/server/services/expert-review.ts",
        "reference/undaunted-progress/server/scripts/prepare-expert-review-pack.ts",
        "reference/undaunted-progress/server/scripts/evaluate-expert-reviews.ts",
        "reference/undaunted-progress/server/scripts/check-final-project-readiness.ts",
      ],
    }
  : {
      name: "Undaunted supervisor branch",
      packagePaths: ["artifacts/api-server/package.json"],
      privateOutputPrefix: "artifacts/api-server/exports/",
      markdownRoots: ["docs/irp/"],
      requiredFiles: [
        "artifacts/api-server/package.json",
        "artifacts/api-server/src/services/matching.ts",
        "artifacts/api-server/src/services/matching-normalisation.ts",
        "artifacts/api-server/src/services/final-matcher-route-lifecycle.ts",
        "artifacts/api-server/src/services/final-delivery-report.ts",
        "artifacts/api-server/src/scripts/check-final-project-readiness.ts",
        "docs/irp/README.md",
        "docs/irp/2026-07-31-final-project-readiness.md",
        "docs/irp/2026-07-31-final-delivery-report.md",
      ],
    };

function listTrackedFiles() {
  return execFileSync("git", ["ls-files", "-z"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean);
}

function sha256(filePath) {
  return createHash("sha256")
    .update(readFileSync(filePath))
    .digest("hex");
}

function localMarkdownTargets(filePath) {
  const text = readFileSync(filePath, "utf8");
  const targets = [];
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    let target = match[1].trim();
    if (
      !target
      || target.startsWith("#")
      || /^(?:https?:|mailto:)/i.test(target)
    ) {
      continue;
    }
    if (target.startsWith("<") && target.endsWith(">")) {
      target = target.slice(1, -1);
    }
    target = target.split(/\s+["']/)[0].split("#")[0];
    if (target) targets.push(target);
  }
  return targets;
}

function scriptTargets(packagePath) {
  const packageDirectory = path.dirname(packagePath);
  const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
  const targets = [];
  for (const [name, command] of Object.entries(packageJson.scripts ?? {})) {
    const tokens = command.trim().split(/\s+/);
    for (let index = 0; index < tokens.length; index += 1) {
      const executable = tokens[index];
      if (executable !== "node" && executable !== "tsx") continue;
      let targetIndex = index + 1;
      while (
        targetIndex < tokens.length
        && (
          tokens[targetIndex].startsWith("-")
          || (executable === "tsx" && tokens[targetIndex] === "watch")
        )
      ) {
        targetIndex += 1;
      }
      if (targetIndex >= tokens.length) continue;
      targets.push({
        name,
        target: path.normalize(
          path.join(packageDirectory, tokens[targetIndex]),
        ),
      });
    }
  }
  return targets;
}

const trackedFiles = listTrackedFiles();
const trackedSet = new Set(trackedFiles);

const missingRequiredFiles = layout.requiredFiles.filter(
  filePath => !trackedSet.has(filePath) || !existsSync(filePath),
);
if (missingRequiredFiles.length > 0) {
  throw new Error(
    `Missing required tracked files:\n${missingRequiredFiles.join("\n")}`,
  );
}

const privateFiles = trackedFiles.filter(filePath => {
  const fileName = path.basename(filePath);
  return (
    filePath.startsWith(layout.privateOutputPrefix)
    || filePath.includes(".local.")
    || fileName === ".env"
    || (fileName.startsWith(".env.") && fileName !== ".env.example")
  );
});
if (privateFiles.length > 0) {
  throw new Error(
    `Private or generated files are tracked:\n${privateFiles.join("\n")}`,
  );
}

const oversizedFiles = trackedFiles.filter(
  filePath =>
    existsSync(filePath)
    && statSync(filePath).isFile()
    && statSync(filePath).size > 20 * 1024 * 1024,
);
if (oversizedFiles.length > 0) {
  throw new Error(
    `Tracked files exceed 20 MiB:\n${oversizedFiles.join("\n")}`,
  );
}

const checkedScriptTargets = layout.packagePaths.flatMap(packagePath =>
  scriptTargets(packagePath),
);
const missingScriptTargets = checkedScriptTargets.filter(
  item => !existsSync(item.target),
);
if (missingScriptTargets.length > 0) {
  throw new Error(
    `IRP package scripts point to missing files:\n${missingScriptTargets
      .map(item => `${item.name}: ${item.target}`)
      .join("\n")}`,
  );
}

const markdownFiles = trackedFiles.filter(
  filePath =>
    filePath.endsWith(".md")
    && layout.markdownRoots.some(root =>
      root.endsWith("/")
        ? filePath.startsWith(root)
        : filePath === root,
    ),
);
const brokenLinks = [];
let localLinkCount = 0;
for (const markdownFile of markdownFiles) {
  for (const target of localMarkdownTargets(markdownFile)) {
    localLinkCount += 1;
    let decodedTarget = target;
    try {
      decodedTarget = decodeURIComponent(target);
    } catch {
      // Keep the original target so the missing-path report remains useful.
    }
    const resolved = path.resolve(path.dirname(markdownFile), decodedTarget);
    if (!existsSync(resolved)) {
      brokenLinks.push(`${markdownFile}: ${target}`);
    }
  }
}
if (brokenLinks.length > 0) {
  throw new Error(`Broken local Markdown links:\n${brokenLinks.join("\n")}`);
}

const secretPatterns = [
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\binviteToken=[A-Fa-f0-9]{40,}\b/,
  /\b(?:AIRTABLE_API_KEY|OPENAI_API_KEY|AI_INTEGRATIONS_OPENAI_API_KEY)\s*[:=]\s*["']?[A-Za-z0-9_-]{20,}/,
];
const secretMatches = [];
for (const filePath of trackedFiles) {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) continue;
  const buffer = readFileSync(filePath);
  if (buffer.length > 2 * 1024 * 1024 || buffer.includes(0)) continue;
  const text = buffer.toString("utf8");
  if (secretPatterns.some(pattern => pattern.test(text))) {
    secretMatches.push(filePath);
  }
}
if (secretMatches.length > 0) {
  throw new Error(
    `Possible credentials found in tracked files:\n${secretMatches.join("\n")}`,
  );
}

if (isIrpRepository) {
  const baselineHash = sha256(
    "reference/undaunted-baseline/server/services/matching.ts",
  );
  const progressHash = sha256(
    "reference/undaunted-progress/server/services/matching.ts",
  );
  if (baselineHash === progressHash) {
    throw new Error(
      "The baseline and progress matcher snapshots are unexpectedly identical.",
    );
  }
}

console.log("Final submission repository audit passed.");
console.log(`Layout: ${layout.name}`);
console.log(`Tracked files: ${trackedFiles.length}`);
console.log(`Package script targets checked: ${checkedScriptTargets.length}`);
console.log(
  `Markdown files and local links checked: ${markdownFiles.length} files, ${localLinkCount} links`,
);
console.log("Private outputs and credential patterns: clear");
if (isIrpRepository) {
  console.log("Baseline and progress matcher snapshots: present and distinct");
}
