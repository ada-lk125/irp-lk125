# Formal pack export guard

The accepted formal pack will be built from three private scored exports, one for each query. The export command now expects ten projected rows from every input and rejects a repeated `queryId`, even if the investor sets are different.

Run the formal export from `reference/undaunted-progress/` after the three scored files are ready:

```bash
npm run irp:export-formal-blind-pack
```

The command reads these ignored inputs:

- `exports/baseline-formal-query-01.local.json`
- `exports/baseline-formal-query-02.local.json`
- `exports/baseline-formal-query-03.local.json`

It checks all three inputs before writing the shuffled CSV and manifest. An input with fewer than ten projected rows stops the run. A duplicated query or a tracked filename also stops it, so the formal source cannot be mistaken for a shareable repository file.

The output remains under `exports/` and ends in `.local`. No scored JSON, original ranking, formal CSV or formal manifest is committed.
