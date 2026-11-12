# Variant comparison inputs

This note records the small comparison guard added on 9 July.

The first Week 4 variant changes rule inputs before scoring. Once I have a baseline export and a variant export, I need a simple check before any metric calculation: are these two files talking about the same query, and did the evaluated top-k investor set change?

I added `variant-comparison.ts` for that job. It reads the two export shapes, checks `queryId`, `startupId` and `fundingRoundId`, rejects duplicate investor IDs, and counts three things for the selected top-k:

- investor pairs present in both exports;
- investor pairs only in the baseline top-k;
- investor pairs only in the variant top-k.

The command is:

```bash
npm run irp:check-variant-comparison-inputs
```

With no arguments, it runs an offline self-check using in-memory fake exports. With real local files, it can be run like this:

```bash
npm run irp:check-variant-comparison-inputs -- \
  --baseline exports/baseline-formal-query-01.local.json \
  --variant exports/variant-query-01.local.json \
  --top-k 10 \
  --require-full-top-k
```

This is not the metric runner. It does not calculate Precision@5, Precision@10, MRR or NDCG, and it does not read Chuan's frozen labels. It is just a guard before the labelled evaluation step, so I do not compare mismatched queries by accident.

The script prints counts only and writes no output files. Real scored exports remain private local files.
