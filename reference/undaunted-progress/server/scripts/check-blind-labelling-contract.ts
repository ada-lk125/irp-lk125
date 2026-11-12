import {
  BLIND_IDENTIFIER_COLUMNS,
  BLIND_JUDGEMENT_COLUMNS,
  BLIND_LABELLING_COLUMNS,
  BLIND_LABELLING_SCHEMA_VERSION,
  BLIND_MULTI_VALUE_SEPARATOR,
  FORBIDDEN_BLIND_COLUMNS,
  RELEVANCE_VALUES,
} from "../services/blind-labelling";

function duplicateValues(values: readonly string[]): string[] {
  return [
    ...new Set(
      values.filter((value, index) => values.indexOf(value) !== index),
    ),
  ];
}

function main() {
  const errors: string[] = [];
  const duplicates = duplicateValues(BLIND_LABELLING_COLUMNS);
  const forbiddenOverlap = BLIND_LABELLING_COLUMNS.filter((column) =>
    (FORBIDDEN_BLIND_COLUMNS as readonly string[]).includes(column),
  );

  if (BLIND_LABELLING_SCHEMA_VERSION !== "blind-labelling-v1") {
    errors.push("Blind labelling schema version is not recognised.");
  }
  if (BLIND_LABELLING_COLUMNS.length !== 36) {
    errors.push("Blind labelling contract must contain 36 columns.");
  }
  if (duplicates.length > 0) {
    errors.push(`Duplicate columns: ${duplicates.join(", ")}.`);
  }
  if (forbiddenOverlap.length > 0) {
    errors.push(`Forbidden columns exposed: ${forbiddenOverlap.join(", ")}.`);
  }
  if (BLIND_MULTI_VALUE_SEPARATOR !== " | ") {
    errors.push("Multi-value separator must be a pipe surrounded by spaces.");
  }
  if (
    BLIND_LABELLING_COLUMNS.slice(0, BLIND_IDENTIFIER_COLUMNS.length).join(
      ",",
    ) !== BLIND_IDENTIFIER_COLUMNS.join(",")
  ) {
    errors.push("Stable identifier columns must appear first.");
  }
  if (
    BLIND_LABELLING_COLUMNS.slice(-BLIND_JUDGEMENT_COLUMNS.length).join(",") !==
    BLIND_JUDGEMENT_COLUMNS.join(",")
  ) {
    errors.push("Judgement columns must appear last.");
  }
  if (
    RELEVANCE_VALUES.strong_fit !== 2 ||
    RELEVANCE_VALUES.possible_fit !== 1 ||
    RELEVANCE_VALUES.weak_fit !== 0
  ) {
    errors.push("Relevance values must remain strong=2, possible=1, weak=0.");
  }

  if (errors.length > 0) {
    console.error("Blind labelling contract check failed.");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log("Blind labelling contract check passed.");
  console.log(`Columns: ${BLIND_LABELLING_COLUMNS.length}`);
  console.log(`Schema: ${BLIND_LABELLING_SCHEMA_VERSION}`);
}

main();
