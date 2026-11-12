# Semantic comparison runner

On 16 July I connected the three Week 5 methods to one comparison runner. Each run now sends the same investor candidates through `rule-only`, `gpt-semantic` and `text-similarity`, using the fixed matching configuration and no historical feedback. The runner keeps the top ten from each method.

The comparison identity records `queryId`, `startupId`, `fundingRoundId`, the candidate count and a SHA-256 hash of the sorted investor IDs. It does not copy the investor ID list into the identity record. This gives me a way to check that the candidate pool stayed fixed without creating another public data file.

The export command writes one query comparison at a time. It accepts the existing baseline query input shape and either reads investors from Airtable or uses a local fixture. Output is restricted to `exports/*.local.json`. The command checks all three top-ten lists before writing and refuses to replace an existing file.

Run the offline checks from `reference/undaunted-progress`:

```bash
npm run irp:check-semantic-comparison-identity
npm run irp:check-semantic-comparison-runner
npm run irp:check-semantic-comparison-export
npm run irp:check-week-five-semantic-readiness
```

An authorised Replit run for the first private query will use:

```bash
npm run irp:export-semantic-comparison -- \
  --input exports/formal-query-input-01.local.json \
  --output exports/semantic-comparison-query-01.local.json \
  --run-id semantic-comparison-query-01
```

The offline checks use fictional investors and injected scorer results. They prove that the runner and guards behave as expected, but they do not show that one method ranks investors better. The real outputs still need the three private queries, the authorised Airtable and OpenAI runtime, and Chuan's frozen labels. Chuan remains responsible for the labelled metric calculation.
