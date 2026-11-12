import { readFile } from "node:fs/promises";
import {
  buildFormalBaselineInput,
  validateFormalQuerySelection,
} from "../services/formal-query-input";

const samplePath = "docs/irp/samples/formal-query-selection.sample.json";

function getArgValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} needs a value.`);
  return value;
}

function assertSharedSourceAliases(selection: {
  queryId: string;
  startupId: string;
  fundingRoundId: string;
}) {
  const input = buildFormalBaselineInput({
    selection,
    startupRecord: {
      id: selection.startupId,
      fields: {
        Company: "Shared-source startup",
        "Full Description": "Shared-source startup description.",
        Sector: ["Clean Energy"],
      },
    },
    fundingRoundRecord: {
      id: selection.fundingRoundId,
      fields: {
        Companies: [selection.startupId],
        "Fundraising Stage": "Pre-Seed",
        "Target Raise Amount": 900_000,
        "Minimum Ticket Size": 25_000,
        "Funding Instrument": ["Equity"],
        "Target Investor Type": ["Angel"],
      },
    },
  });
  if (
    input.startupName !== "Shared-source startup" ||
    input.roundSectors?.[0] !== "Clean Energy" ||
    input.preferredInvestorTypes?.[0] !== "Angel"
  ) {
    throw new Error("Shared Airtable source aliases failed to project.");
  }
}

async function main() {
  const selectionPath =
    getArgValue(process.argv.slice(2), "--selection") || samplePath;
  const raw = JSON.parse(await readFile(selectionPath, "utf8")) as unknown;
  const selections = validateFormalQuerySelection(raw);

  for (const selection of selections) {
    const input = buildFormalBaselineInput({
      selection,
      startupRecord: {
        id: selection.startupId,
        fields: {
          Name: `Example ${selection.queryId}`,
          Description: "Non-production query input contract check.",
        },
      },
      fundingRoundRecord: {
        id: selection.fundingRoundId,
        fields: {
          Startup: [selection.startupId],
          "Round Stage": "Seed",
        },
      },
    });
    if (input.queryId !== selection.queryId) {
      throw new Error(`Query ${selection.queryId} changed during projection.`);
    }
  }
  assertSharedSourceAliases(selections[0]);

  console.log("Formal query selection and projection checks passed.");
}

main().catch((error: Error) => {
  console.error(`Formal query input check failed: ${error.message}`);
  process.exit(1);
});
