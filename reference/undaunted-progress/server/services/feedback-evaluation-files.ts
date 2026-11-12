import { randomUUID } from "node:crypto";
import { access, link, mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FeedbackEvaluationDecision } from "./feedback-evaluation-decision";
import {
  serialiseFeedbackEvaluationReceipt,
  type FeedbackEvaluationReceipt,
} from "./feedback-evaluation-receipt";

function resolveOutput(args: {
  filePath: string;
  workingDirectory: string;
  suffix: ".local.receipt.json" | ".local.decision.json";
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
      `Feedback evaluation output must stay inside exports/ and end with ${args.suffix}.`,
    );
  }
  return resolved;
}

async function assertAvailable(filePath: string) {
  try {
    await access(filePath);
    throw new Error(`Feedback evaluation output already exists: ${filePath}.`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export async function writeFeedbackEvaluationArtifacts(args: {
  receipt: FeedbackEvaluationReceipt;
  decision: FeedbackEvaluationDecision;
  receiptPath: string;
  decisionPath: string;
  workingDirectory?: string;
}): Promise<{ receiptPath: string; decisionPath: string }> {
  if (
    args.receipt.batch.batchId !== args.decision.batchId
    || JSON.stringify(args.receipt.queryIds) !== JSON.stringify(args.decision.queryIds)
  ) {
    throw new Error("The feedback receipt and decision describe different batches.");
  }

  const workingDirectory = args.workingDirectory ?? process.cwd();
  const receiptPath = resolveOutput({
    filePath: args.receiptPath,
    workingDirectory,
    suffix: ".local.receipt.json",
  });
  const decisionPath = resolveOutput({
    filePath: args.decisionPath,
    workingDirectory,
    suffix: ".local.decision.json",
  });
  await Promise.all([assertAvailable(receiptPath), assertAvailable(decisionPath)]);

  await mkdir(path.dirname(receiptPath), { recursive: true });
  await mkdir(path.dirname(decisionPath), { recursive: true });
  const receiptTemporaryPath = `${receiptPath}.${process.pid}.${randomUUID()}.tmp`;
  const decisionTemporaryPath = `${decisionPath}.${process.pid}.${randomUUID()}.tmp`;
  let receiptLinked = false;
  let decisionLinked = false;
  try {
    await Promise.all([
      writeFile(
        receiptTemporaryPath,
        serialiseFeedbackEvaluationReceipt(args.receipt),
        { encoding: "utf8", flag: "wx" },
      ),
      writeFile(
        decisionTemporaryPath,
        `${JSON.stringify(args.decision, null, 2)}\n`,
        { encoding: "utf8", flag: "wx" },
      ),
    ]);
    await link(receiptTemporaryPath, receiptPath);
    receiptLinked = true;
    await link(decisionTemporaryPath, decisionPath);
    decisionLinked = true;
  } catch (error) {
    if (receiptLinked) await unlink(receiptPath);
    if (decisionLinked) await unlink(decisionPath);
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error("A feedback evaluation output was created by another process.");
    }
    throw error;
  } finally {
    await Promise.all(
      [receiptTemporaryPath, decisionTemporaryPath].map(async temporaryPath => {
        try {
          await unlink(temporaryPath);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
      }),
    );
  }
  return { receiptPath, decisionPath };
}
