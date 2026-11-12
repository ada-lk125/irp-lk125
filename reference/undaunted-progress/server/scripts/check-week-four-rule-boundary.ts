import { mapSectorsToInvestorTaxonomy } from "@shared/sector-taxonomy";
import { getDefaultMatchingConfig } from "../services/matching-config";

const expectedWeights = {
  stage: 0.2,
  ticketSize: 0.15,
  sectorOverlap: 0.2,
  geography: 0.1,
  instruments: 0.05,
  semantic: 0.3,
};

function sameNumber(actual: number, expected: number) {
  return Math.abs(actual - expected) < 0.000001;
}

function expect(condition: boolean, message: string, errors: string[]) {
  if (!condition) errors.push(message);
}

function main() {
  const errors: string[] = [];
  const config = getDefaultMatchingConfig();

  for (const [key, expected] of Object.entries(expectedWeights)) {
    const actual = config.weights[key as keyof typeof expectedWeights];
    expect(
      sameNumber(actual, expected),
      `Expected ${key} weight ${expected}; found ${actual}.`,
      errors,
    );
  }

  expect(config.aiModel === "gpt-4o-mini", "Default AI model changed.", errors);
  expect(config.aiCandidateCount === 60, "Default AI candidate count changed.", errors);
  expect(config.exclusionCap === 15, "Default exclusion cap changed.", errors);

  const mappedSectors = mapSectorsToInvestorTaxonomy([
    "Sustainable & Renewable Energy",
    "Energy Storage",
    "Other",
    " ",
  ]);
  expect(
    JSON.stringify(mappedSectors) === JSON.stringify(["Power & Renewables", "Other"]),
    `Sector taxonomy mapping changed: ${JSON.stringify(mappedSectors)}.`,
    errors,
  );

  const weightSum = Object.values(config.weights).reduce((sum, value) => sum + value, 0);
  expect(sameNumber(weightSum, 1), `Default weights sum to ${weightSum}.`, errors);

  if (errors.length > 0) {
    console.error("Week 4 rule boundary check failed.");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log("Week 4 rule boundary check passed.");
  console.log("Checked default weights, AI boundary, and sector taxonomy mapping.");
}

main();
