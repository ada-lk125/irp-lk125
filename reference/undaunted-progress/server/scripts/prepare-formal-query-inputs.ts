import { access, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  COMPANIES_BASE_ID,
  COMPANIES_TABLE,
  FUNDING_ROUNDS_BASE_ID,
  FUNDING_ROUND_TABLE,
  fetchRecordById,
} from "../services/airtable";
import {
  assertFormalStartupEvidenceSufficiency,
  buildFormalBaselineInput,
  validateFormalQuerySelection,
  validateFormalQuerySourceSnapshot,
} from "../services/formal-query-input";

const defaultSelectionPath = "exports/formal-query-selection.local.json";
const defaultOutputDirectory = "exports";
const defaultOutputPrefix = "formal-query-input";

function getArgValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} needs a value.`);
  return value;
}

function getOptionalPositiveInteger(
  args: string[],
  name: string,
): number | undefined {
  const value = getArgValue(args, name);
  if (value === undefined) return undefined;
  if (!/^\d+$/.test(value) || Number(value) < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return Number(value);
}

function validateOutputPrefix(value: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw new Error(
      "--output-prefix must contain lowercase letters, numbers, and single hyphens only.",
    );
  }
  return value;
}

async function assertMissing(filePaths: string[]) {
  const existing: string[] = [];
  for (const filePath of filePaths) {
    try {
      await access(filePath);
      existing.push(filePath);
    } catch {
      // Expected before the first private export.
    }
  }
  if (existing.length > 0) {
    throw new Error(
      `Private query inputs already exist and will not be overwritten:\n${existing
        .map((filePath) => `- ${filePath}`)
        .join("\n")}`,
    );
  }
}

async function main() {
  const args = process.argv.slice(2);
  const selectionPath = getArgValue(args, "--selection") || defaultSelectionPath;
  const outputDirectory = getArgValue(args, "--output-dir") || defaultOutputDirectory;
  const sourceSnapshotPath = getArgValue(args, "--source-snapshot");
  const outputPrefix = validateOutputPrefix(
    getArgValue(args, "--output-prefix") || defaultOutputPrefix,
  );
  const minimumStartupEvidenceFields = getOptionalPositiveInteger(
    args,
    "--minimum-startup-evidence-fields",
  );
  const rawSelection = JSON.parse(await readFile(selectionPath, "utf8")) as unknown;
  const selections = validateFormalQuerySelection(rawSelection);
  const outputPaths = selections.map((_, index) =>
    path.join(
      outputDirectory,
      `${outputPrefix}-${String(index + 1).padStart(2, "0")}.local.json`,
    ),
  );
  await assertMissing(outputPaths);

  const inputs = sourceSnapshotPath
    ? validateFormalQuerySourceSnapshot(
        JSON.parse(await readFile(sourceSnapshotPath, "utf8")) as unknown,
        selections,
      )
    : await Promise.all(
        selections.map(async (selection) => {
          const [startupRecord, fundingRoundRecord] = await Promise.all([
            fetchRecordById(
              COMPANIES_TABLE,
              selection.startupId,
              COMPANIES_BASE_ID,
            ),
            fetchRecordById(
              FUNDING_ROUND_TABLE,
              selection.fundingRoundId,
              FUNDING_ROUNDS_BASE_ID,
            ),
          ]);
          return buildFormalBaselineInput({
            selection,
            startupRecord,
            fundingRoundRecord,
          });
        }),
      );

  if (minimumStartupEvidenceFields !== undefined) {
    assertFormalStartupEvidenceSufficiency(
      inputs,
      minimumStartupEvidenceFields,
    );
  }

  await mkdir(outputDirectory, { recursive: true });
  const pendingPaths = outputPaths.map((outputPath) => `${outputPath}.pending`);
  try {
    for (let index = 0; index < pendingPaths.length; index += 1) {
      await writeFile(
        pendingPaths[index],
        `${JSON.stringify(inputs[index], null, 2)}\n`,
        { encoding: "utf8", flag: "wx" },
      );
    }
    for (let index = 0; index < outputPaths.length; index += 1) {
      await rename(pendingPaths[index], outputPaths[index]);
    }
  } catch (error) {
    await Promise.all(
      [...pendingPaths, ...outputPaths].map((filePath) =>
        rm(filePath, { force: true }),
      ),
    );
    throw error;
  }

  console.log(
    sourceSnapshotPath
      ? `Prepared three private formal query inputs from ${sourceSnapshotPath}.`
      : "Prepared three private formal query inputs from Airtable.",
  );
  outputPaths.forEach((outputPath) => console.log(`- ${outputPath}`));
}

main().catch((error: Error) => {
  console.error(`Formal query input preparation failed: ${error.message}`);
  process.exit(1);
});
