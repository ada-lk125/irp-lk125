# Formal-v3 replacement and evidence gate

Formal-v3 replaces the incomplete formal-v2 blind pack without rewriting its private files. Queries 01 and 02 keep their formal-v2 query inputs, scored exports and top-ten pair sets. Query 03 is regenerated from the agreed replacement startup and funding round only after its startup evidence passes a minimum populated-field check.

`irp:prepare-formal-query-inputs` now accepts `--output-prefix` so a revised pack can use new private file names. The optional `--minimum-startup-evidence-fields` gate counts `climateProblem`, `solutionDescription`, `businessModel` and `targetMarket`, then stops before writing any query input if the threshold is not met.

Investor ticket bounds use one deterministic interpretation throughout later evidence projection and comparison runs. When both bounds exist and the recorded minimum is greater than the recorded maximum, the lower value becomes the minimum and the higher value becomes the maximum. Historical scored exports remain byte-for-byte unchanged; the corrected bounds are applied when projecting the blind evidence and loading future candidate pools.

The formal-v3 handover contains only the anonymised CSV and its manifest. Query inputs, scored exports, run metadata, rankings, scores, match reasons and AI insight remain private. No real identifiers, evidence text or scored output are committed.

After Chuan returns the completed CSV, freeze it from `reference/undaunted-progress`:

```bash
npm run irp:freeze-formal-labels -- \
  --source exports/blind-labelling-formal-v3.local.csv \
  --source-manifest exports/blind-labelling-formal-v3-manifest.local.json \
  --labelled <returned-labelled-csv> \
  --output exports/blind-labelling-formal-v3-labelled.local.csv \
  --manifest exports/blind-labelling-formal-v3-frozen-manifest.local.json \
  --frozen-version formal-v3-frozen-v1
```

The command verifies the source-pack hash, fixed columns, all identifier and evidence values, three ten-row queries and complete judgements with no holds. It preserves the returned CSV bytes, binds both CSVs by SHA-256 and refuses to overwrite existing frozen outputs.
