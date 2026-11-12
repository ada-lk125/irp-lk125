# Frozen label rules

The frozen-label check now separates a completed judgement from a held row. A completed judgement must use `strong_fit = 2`, `possible_fit = 1` or `weak_fit = 0`. Its `review_status` may be blank or `complete`.

A held row has no relevance label or value. It must use `review_status = hold`, include an uncertainty note, and set `error_category` to `data_missing` or `uncertain`. A query with any held or invalid row remains incomplete, so it cannot enter a baseline-versus-variant comparison.

The rule check also rejects blank stable identifiers and repeated `queryId + investorId` pairs. It runs against the fictional four-row sample in memory and does not write a labelled CSV:

```bash
npm run irp:check-frozen-label-rules
```

This check fixes the row-level rules before Chuan returns the real labels. The private formal CSV is still waiting for live data access and is not stored in Git.
