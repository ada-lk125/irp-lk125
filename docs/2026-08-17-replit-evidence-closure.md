# Replit evidence closure — 17 August 2026

## Status

The private Replit export closes the platform-baseline provenance questions for
the four-case IRP study. Private startup, investor and row-level evidence stays
outside Git; this note records only aggregate audit findings and claim limits.

## What the export establishes

- Four saved production runs correspond to the four cases and were created on
  12 August 2026 UTC.
- Each saved run contains 383 scored investors and its historical investor
  objects.
- All 40 workbook Top-10 entries match the saved investor, rank, order, total
  score and component scores.
- All 80 Review Template entries match ranks 1--20 of the same current platform
  algorithm. Rows 11--20 are not optimised output.
- The effective semantic model was `gpt-4o-mini`, with a 60-candidate semantic
  stage and the previously frozen prompt.
- Effective feedback context was empty for all four runs.
- The five deterministic rule-score columns reproduce exactly for all
  4 x 383 saved rows using the frozen matcher.

## Controlled comparison state

The scoring-relevant 383-investor historical snapshot is now frozen privately.
Both `legacy` and `normalisation-v1` were rerun on that same snapshot with the
same four inputs, deterministic text similarity, no feedback, stable-ID
tie-breaking and Top 10. Their Top-10 sets overlap by 5, 6, 8 and 5 investors
across the four anonymised cases.

Pooling, deduplicating and algorithm-blinding both lists produces 56 unique
case-investor pairs. Exact stable-ID transfer covers 39 pairs from earlier
assessments with no conflicts. Maiko returned the remaining 17 on 18 August
using the same frozen Claude Skill and Claude Opus 5 procedure. All 17 rows are
complete, their IDs match the request exactly, and a cell-level comparison
found zero changes to protected evidence fields.

The completed 56-row pool gives the following descriptive result:

| Metric | Legacy | Normalisation v1 | Delta |
|---|---:|---:|---:|
| Macro P@5 | 0.350 | 0.500 | +0.150 |
| Macro P@10 | 0.300 | 0.400 | +0.100 |
| Mean positive matches in Top 10 | 3.0 | 4.0 | +1.0 |

No case regresses. Gains are concentrated in Cases 1 and 2; Cases 3 and 4 are
unchanged. The independent arithmetic recomputation matches the frozen
evaluator output exactly.

## Reproducibility boundary

The saved results are authoritative evidence of what the platform returned.
The exact Replit deployment identifier and original Airtable return order were
not recoverable. Ties at the 60-candidate boundary and non-deterministic GPT
responses therefore prevent a byte-exact full historical replay. The report
must describe platform reproducibility as partial, while separately describing
the deterministic paired comparison as reproducible from its frozen private
snapshot.

The earlier 354-investor pilot remains valid and retains its published
descriptive deltas. It must not be relabelled as the final 383-snapshot result.
The result above is a model-assisted four-case paired case study, not human
expert review or a population-level claim. On 21 August, Chuan Ju independently
ran the frozen v3 verification package locally and offline. She confirmed the
package hash, `PASS_FINAL`, 56/56 coverage, zero protected evidence changes and
all headline metrics, and reported no discrepancies. A Maiko or Cathal human
spot-check remains optional unless the report claims human review.
