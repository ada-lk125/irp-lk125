import { loadBaselineQuerySet } from "../services/baseline-query-set";

function getInputPath(args: string[]): string {
  const inline = args.find((arg) => arg.startsWith("--input="));
  if (inline) return inline.slice("--input=".length);

  const index = args.indexOf("--input");
  const value = index >= 0 ? args[index + 1] : undefined;
  if (!value || value.startsWith("--")) {
    throw new Error(
      "Usage: tsx check-baseline-query-set.ts --input <manifest-json>",
    );
  }
  return value;
}

async function main() {
  const querySet = await loadBaselineQuerySet(
    getInputPath(process.argv.slice(2)),
  );
  console.log(
    `Baseline query set check passed: ${querySet.queries.length} queries.`,
  );
  for (const { input } of querySet.queries) {
    console.log(
      `${input.queryId}: startup ${input.startupId}, round ${input.fundingRoundId}`,
    );
  }
}

main().catch((error: Error) => {
  console.error(`Baseline query set check failed: ${error.message}`);
  process.exit(1);
});
