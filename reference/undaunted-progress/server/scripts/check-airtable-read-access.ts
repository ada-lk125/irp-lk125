import {
  COMPANIES_BASE_ID,
  COMPANIES_TABLE,
  FUNDING_ROUNDS_BASE_ID,
  FUNDING_ROUND_TABLE,
  INVESTORS_TABLE,
} from "../services/airtable";
import { probeAirtableReadAccess } from "../services/airtable-read-access";

function isJsonOutput(): boolean {
  return process.argv.includes("--json");
}

async function main() {
  const results = await probeAirtableReadAccess({
    apiKey: process.env.AIRTABLE_API_KEY ?? "",
    baseId: process.env.AIRTABLE_BASE_ID ?? "",
    targets: [
      { name: "Investors", tableId: INVESTORS_TABLE },
      {
        name: "Companies",
        tableId: COMPANIES_TABLE,
        baseId: COMPANIES_BASE_ID,
      },
      {
        name: "Funding Rounds",
        tableId: FUNDING_ROUND_TABLE,
        baseId: FUNDING_ROUNDS_BASE_ID,
      },
    ],
  });
  const ok = results.every((result) => result.ok);

  if (isJsonOutput()) {
    console.log(JSON.stringify({ ok, results }, null, 2));
  } else {
    console.log("Airtable read-access check (GET, maxRecords=1):");
    for (const result of results) {
      const status =
        result.status === null ? "network error" : `HTTP ${result.status}`;
      console.log(`- ${result.name}: ${status} (${result.detail})`);
    }
  }

  if (!ok) {
    if (!isJsonOutput()) {
      console.error(
        "Read access is incomplete. Confirm the Airtable base, token scopes, and IRP table ids with the project owner.",
      );
    }
    process.exitCode = 1;
  }
}

main().catch((error: Error) => {
  console.error(`Airtable read-access check failed: ${error.message}`);
  process.exit(1);
});
