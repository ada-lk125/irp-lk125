const requiredEnv = [
  "AIRTABLE_API_KEY",
  "AIRTABLE_BASE_ID",
  "AI_INTEGRATIONS_OPENAI_API_KEY",
];

const optionalEnv = [
  "AI_INTEGRATIONS_OPENAI_BASE_URL",
  "AIRTABLE_INVESTORS_TABLE_ID",
  "AIRTABLE_COMPANIES_TABLE_ID",
  "AIRTABLE_FUNDING_ROUNDS_TABLE_ID",
];

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function isSet(name: string) {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0;
}

function main() {
  const json = hasFlag("--json");
  const missing = requiredEnv.filter((name) => !isSet(name));
  const presentOptional = optionalEnv.filter(isSet);
  const result = {
    ok: missing.length === 0,
    required: {
      total: requiredEnv.length,
      present: requiredEnv.length - missing.length,
      missing,
    },
    optional: {
      total: optionalEnv.length,
      present: presentOptional.length,
    },
  };

  if (json) {
    console.log(JSON.stringify(result, null, 2));
  }

  if (missing.length > 0) {
    if (!json) {
      console.error("Live baseline environment check failed.");
      console.error("Missing required variables:");
      for (const name of missing) {
        console.error(`- ${name}`);
      }
    }
    process.exitCode = 1;
    return;
  }

  if (json) return;

  console.log("Live baseline environment check passed.");
  console.log(`Required variables present: ${result.required.present}`);
  console.log(`Optional variables present: ${presentOptional.length}`);
}

main();
