# Query input readiness

The baseline export now keeps separate query, startup and funding-round identifiers. It also carries the investor description, HQ location and investment thesis needed for blind review. These changes do not alter the matcher; they make its output usable for a later labelling step.

The query-set sample covers two rounds for the same fictional startup. This checks an important part of the agreed identity rule: a startup can appear more than once, but each round and each query must remain unique.

Run the complete local check from `reference/undaunted-progress/`:

```bash
npm run irp:check-week-three-readiness
```

The command reruns the Week 2 fixture export, checks the 36-column blind contract, and loads the two-query sample manifest. It does not call Airtable or OpenAI.

No blind CSV is generated yet. The scored JSON still contains rank and score details, while the planned CSV contract explicitly blocks those fields, organisation names, startup names, match reasons and AI insight.
