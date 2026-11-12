# Normalisation paired-comparison protocol

Date: 31 July 2026

> Historical/supplementary protocol: after the 3 August supervisor meeting,
> this 57-row pooled-label pilot is no longer the final IRP critical path. The
> controlling final study is `2026-08-03-maiko-final-evaluation-protocol.md`.
> Keep this file for reproducibility and supplementary analysis.

## Purpose

This protocol compares the preserved `legacy` rule profile with
`normalisation-v1` without mixing in Maiko's pending feedback. It addresses the
large score ties discovered at the 60-investor semantic cutoff.

Historical formal-v3 outputs retain the original `input-order` behaviour. New
comparisons explicitly use `candidateTieBreak: investor-id`, so reversing the
investor source order cannot change tied candidate selection or final tied
rank order.

## Protected identities

Every comparison records:

- experiment ID and `pilot` or `formal` purpose;
- query-input filenames and SHA-256 values;
- investor CSV hash, candidate count, ID-set hash and input-order hash;
- matching source hash, Git commit and dirty-worktree flag;
- full matching configuration hash for both profiles;
- semantic mode, feedback mode, tie-break and top-k;
- top-ten results and overlap for all three queries.

A `formal` run is refused while the Git worktree is dirty. A GPT run is
refused without `AI_INTEGRATIONS_OPENAI_API_KEY`, and any exhausted GPT
fallback prevents an output from being written.

## Current pilot

Two deterministic comparisons were generated from the formal-v3 query inputs
and the same 354-investor read-only snapshot:

| Experiment | Q1 profile overlap | Q2 profile overlap | Q3 profile overlap |
|---|---:|---:|---:|
| Rule only | 6/10 | 6/10 | 9/10 |
| Local text similarity | 6/10 | 5/10 | 9/10 |

Both the paired text-similarity output and the derived blind CSV reproduced
byte-for-byte when rerun with the same inputs and timestamp.

The union across both semantic modes and both profiles contains 62 distinct
query-investor pairs. Only five are present in the formal-v3 frozen label set:

| Query | Pooled pairs | Existing labels | New blind labels required |
|---|---:|---:|---:|
| Q1 | 25 | 1 | 24 |
| Q2 | 24 | 2 | 22 |
| Q3 | 13 | 2 | 11 |
| Total | 62 | 5 | 57 |

The protected supplementary outputs are:

- `blind-labelling-normalisation-pooled-pilot-v1.local.csv`
- `blind-labelling-normalisation-pooled-pilot-v1-manifest.local.json`
- `blind-labelling-normalisation-pooled-pilot-v1-provenance.local.json`

They remain ignored under the supervisor repository's
`artifacts/api-server/exports/` directory.

## Gate

No ranking-quality metric may be calculated from the five covered pairs alone.
The 57 new rows need blind labels, followed by source-file verification and a
new frozen label manifest. Until then, the observed rank and candidate changes
are behaviour evidence only, not an optimisation result.

The receiving workflow is already implemented. After the returned CSV has all
57 rows judged, run:

```bash
pnpm run irp:freeze-supplementary-labels -- \
  --source exports/blind-labelling-normalisation-pooled-pilot-v1.local.csv \
  --source-manifest exports/blind-labelling-normalisation-pooled-pilot-v1-manifest.local.json \
  --labelled exports/blind-labelling-normalisation-pooled-pilot-v1-returned.local.csv \
  --output exports/blind-labelling-normalisation-pooled-pilot-v1-labelled.local.csv \
  --manifest exports/blind-labelling-normalisation-pooled-pilot-v1-frozen-manifest.local.json \
  --frozen-version normalisation-pooled-pilot-v1 \
  --frozen-at <ISO-8601 timestamp>
```

This command accepts unequal rows per query, but still requires exactly three
complete queries, no holds, unchanged evidence fields, a matching source-pack
hash and protected non-overwriting outputs. Freezing verifies file integrity;
it does not decide who owns the authoritative labels or metric receipt.

Once both the existing formal-v3 labels and the supplementary labels are
frozen, run:

```bash
pnpm run irp:evaluate-normalisation-comparison -- \
  --comparison exports/normalisation-rule-only-pilot-v1.local.json \
  --comparison exports/normalisation-text-similarity-pilot-v1.local.json \
  --labels exports/blind-labelling-formal-v3-labelled.local.csv \
  --label-manifest exports/blind-labelling-formal-v3-frozen-manifest.local.json \
  --labels exports/blind-labelling-normalisation-pooled-pilot-v1-labelled.local.csv \
  --label-manifest exports/blind-labelling-normalisation-pooled-pilot-v1-frozen-manifest.local.json \
  --evaluation-id normalisation-paired-pilot-v1 \
  --purpose pilot \
  --created-at <ISO-8601 timestamp> \
  --output exports/normalisation-paired-pilot-v1-evaluation.local.json
```

The evaluator refuses incomplete coverage. It reports per-query and macro
P@5, P@10, MRR and NDCG@10, plus `normalisation-v1 - legacy` deltas. NDCG uses
`2^relevanceValue - 1`, and IDCG@10 uses all frozen judged pairs for that
query rather than only one method's own retrieved list.

After the implementation is committed, rerun comparisons and pooled-pack
generation with new output names and `--purpose formal`; never rename a pilot
output to formal. Existing judgements may be transferred to the new formal
pack only through `irp:transfer-frozen-labels`, which rejects missing pairs,
duplicate pairs and any evidence-field change. Freeze the transferred file
against the new formal source manifest before the formal evaluation.
