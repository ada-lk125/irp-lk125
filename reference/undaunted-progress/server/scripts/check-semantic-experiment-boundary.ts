import { getDefaultMatchingConfig } from "../services/matching-config";
import {
  semanticExperimentContract,
  validateSemanticExperimentBoundary,
} from "../services/semantic-experiment";

function expect(condition: boolean, message: string, errors: string[]) {
  if (!condition) errors.push(message);
}

function main() {
  const errors = validateSemanticExperimentBoundary(getDefaultMatchingConfig());
  const methodNames = semanticExperimentContract.methods.map(method => method.method);

  expect(
    JSON.stringify(methodNames) ===
      JSON.stringify(["rule-only", "gpt-semantic", "text-similarity"]),
    `Unexpected semantic methods: ${methodNames.join(", ")}.`,
    errors,
  );
  expect(
    semanticExperimentContract.methods.every(method => method.feedbackMode === "none"),
    "The primary semantic comparison must not include feedback.",
    errors,
  );
  expect(semanticExperimentContract.queryCount === 3, "Expected three formal queries.", errors);
  expect(semanticExperimentContract.rowsPerQuery === 10, "Expected ten rows per query.", errors);
  expect(semanticExperimentContract.topK === 10, "Expected a top-ten comparison.", errors);
  expect(
    semanticExperimentContract.useSameCandidatePool,
    "Semantic methods must use the same candidate pool.",
    errors,
  );

  if (errors.length > 0) {
    console.error("Semantic experiment boundary check failed.");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log("Semantic experiment boundary check passed.");
  console.log("Checked methods, query shape, feedback isolation, and matching configuration.");
}

main();
