# Formal query input pipeline

The formal blind-labelling workflow now separates three private file stages:

1. Chuan's three confirmed identifiers are stored in `exports/formal-query-selection.local.json`.
2. Read-only Airtable GET requests convert those identifiers into `formal-query-input-01.local.json` through `formal-query-input-03.local.json`.
3. The matcher converts those query inputs into the scored `baseline-formal-query-01.local.json` through `baseline-formal-query-03.local.json` files used by the blind-pack exporter.

The selection manifest must use `formal-query-selection-v1`, contain exactly three entries, and provide a non-empty `queryId`, `startupId`, and `fundingRoundId` for each entry. Query IDs and funding-round IDs must be distinct. The generator also rejects a Funding Round that is not linked to the selected Company.

A non-secret structural example is available at `docs/irp/samples/formal-query-selection.sample.json`. Real identifiers belong only in the ignored `exports/` directory.

## Commands

In the Undaunted monorepo:

```bash
pnpm --filter @workspace/api-server run irp:check-airtable-access
pnpm --filter @workspace/api-server run irp:prepare-formal-query-inputs
pnpm --filter @workspace/api-server run irp:export-formal-baselines
pnpm --filter @workspace/api-server run irp:prepare-formal-blind-pack
```

In the standalone reference copy:

```bash
npm run irp:check-airtable-access
npm run irp:prepare-formal-query-inputs
npm run irp:export-formal-baselines
npm run irp:prepare-formal-blind-pack
```

Every stage refuses to overwrite existing private outputs. A failed three-query run removes files created by that run so that an incomplete batch cannot be mistaken for a formal dataset.

The Airtable access command sends bounded GET requests with `maxRecords=1` and reports status codes only; it does not print records, table contents, or secret values. It is intentionally separate from `irp:check-week-three-readiness`, which remains an offline fixture and contract check. HTTP 403 means the variables are present but the token, base, or selected table set is not authorised.

The investor source and the selected startup/funding source may be in different Airtable bases. Keep the investor base in `AIRTABLE_BASE_ID`, and set `AIRTABLE_COMPANIES_BASE_ID` plus `AIRTABLE_FUNDING_ROUNDS_BASE_ID` only when those records use a separate approved source. The corresponding table IDs can be set with `AIRTABLE_INVESTORS_TABLE_ID`, `AIRTABLE_COMPANIES_TABLE_ID`, and `AIRTABLE_FUNDING_ROUNDS_TABLE_ID`. The workflow never falls back to legacy tables automatically.

The read-access check probes each configured source independently. A public Airtable share link does not grant API-token access; formal input preparation must stop if either Company or Funding Round access is denied.

## Permission boundary

The code and fixture tests can be prepared locally. The live environment check, Airtable reads, OpenAI matcher calls, scored baseline generation, and formal pack generation must not run in Replit until the platform owner has approved the exact command list. No real query identifiers, scored JSON, rankings, scores, or explanations are committed or shared.
