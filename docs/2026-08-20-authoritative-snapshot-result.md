# Authoritative-snapshot comparison result — 20 August 2026

## Outcome

The final controlled comparison uses four real funding-round cases and the
verified historical snapshot of 383 investors recovered from the four saved
Replit platform runs. The same case inputs, candidate snapshot, deterministic
text-similarity mode, no-feedback setting, Top 10 and stable-ID tie-break are
used for `legacy` and `normalisation-v1`.

The two Top-10 lists were pooled, deduplicated and algorithm-blinded. The final
pool contains 56 unique case-investor pairs. Thirty-nine labels transferred by
exact case plus stable investor ID; Maiko returned the remaining 17 using the
same frozen qualification Skill and Claude Opus 5 settings. Validation found
zero protected evidence-cell changes and one complete pseudonymous reviewer.

## Aggregate result

| Metric | Legacy | Normalisation v1 | Delta |
|---|---:|---:|---:|
| Macro P@5 | 0.350 | 0.500 | +0.150 |
| Macro P@10 | 0.300 | 0.400 | +0.100 |
| Mean positive matches in Top 10 | 3.0 | 4.0 | +1.0 |

## Anonymous case result

| Case | Legacy P@5 | Optimised P@5 | Delta | Legacy P@10 | Optimised P@10 | Delta |
|---|---:|---:|---:|---:|---:|---:|
| Case 1 | 0.200 | 0.600 | +0.400 | 0.300 | 0.600 | +0.300 |
| Case 2 | 0.400 | 0.600 | +0.200 | 0.300 | 0.400 | +0.100 |
| Case 3 | 0.400 | 0.400 | 0.000 | 0.400 | 0.400 | 0.000 |
| Case 4 | 0.400 | 0.400 | 0.000 | 0.200 | 0.200 | 0.000 |

No case regresses; the aggregate gain is concentrated in Cases 1 and 2. The
result therefore supports a positive, heterogeneous directional finding rather
than a claim that every case improves.

## Claim and reproducibility boundary

An independent implementation recomputed the 56 labels against the private
rank manifest and matched every evaluator metric exactly. The deterministic
comparison arithmetic is reproducible from the frozen private package.

This remains a four-case, model-assisted paired case study. Claude Opus 5
applied the frozen qualification procedure; this is not human expert review.
The exact historical deployment SHA, original Airtable return order and a
deterministic replay of the original `gpt-4o-mini` calls are unavailable, so
the broader platform run is partially rather than byte-exactly reproducible.
The result is descriptive and does not establish a population-level effect.

All identifiable startup, investor, comment, reviewer and rank-manifest data
remain outside Git. Public reporting uses only anonymous cases and aggregate
metrics.

## Independent receiver verification

On 21 August, Chuan Ju independently ran the exact frozen v3 private package
locally and offline. She confirmed that its SHA-256 matched and that the
verifier returned `PASS_FINAL`, 56/56 covered pairs, zero protected evidence
changes and the four expected macro values. She found no discrepancies and
confirmed that neither the package nor its extracted contents was committed to
either repository.

This closes the independent technical and arithmetic gate. It is not a second
investment judgement and does not change the model-assisted review boundary.
