# Maiko-aligned final evaluation protocol

## Material Passport

- Material type: experiment and expert-review protocol
- Created: 3 August 2026
- Status: four real inputs, 55-pair supplementary pilot and 56-pair authoritative-snapshot comparison complete; Skill procedure, semantic prompt, anonymous-report permission and saved platform baseline verified
- Primary source: supervisor meeting transcript from 3 August 2026
- Research claim status: positive model-assisted four-case result established on the verified historical 383-investor snapshot; human and population-level claims not established

## Research question

Does the final optimised matcher return more appropriate Top-10 investor
matches than the preserved legacy matcher for the same complete ClimateTech
funding-round inputs and the same investor pool?

The expected result is directional: the optimised profile should receive a
higher expert thumbs-up rate. A null or negative result remains a valid IRP
finding.

## Design

This is a controlled paired expert case study, not a statistically powered
benchmark.

- Cases: four startups that are actively raising a real funding round.
- Inputs: all available submitted form/deck information, including startup
  description, stage, amount raising, minimum ticket, investment type,
  geography, sectors, preferred investor types and relevant narrative fields.
- Intervention: matcher profile (`legacy` versus `normalisation-v1`).
- Controls: identical funding-round JSON, investor snapshot, Top-K, semantic
  mode, feedback mode, tie-break, weights, model/prompt version and code
  version.
- Outcome: expert thumbs-up rate at 5 and at 10, with review comments used for
  case analysis.
- Reviewers: Maiko, plus Cathal if he confirms availability. They are expert
  proxy reviewers who know the startups and investors; they are not the actual
  investment decision-makers.

## Required input gate

A case must not enter the formal experiment unless it has:

1. stable query, startup and funding-round identifiers;
2. a non-empty startup description and funding stage;
3. amount raising and/or a documented explanation when unavailable;
4. minimum ticket and investment instrument information where available;
5. geography and sector information;
6. source provenance and permission to use the submitted information;
7. no private deck or founder data committed to Git.

Eluna, Green Mixers and the earlier illustrative investor pairs are not formal
cases unless Maiko supplies a complete, authorised funding-round record for
them.

## Frozen identities

Before the formal run, record all of the following in the protected comparison
output:

- IRP Git commit and dirty-worktree state;
- matching source SHA-256;
- every query-input filename and SHA-256;
- investor source filename, file SHA-256, candidate ID-set hash and row-order
  hash;
- complete matching configuration and configuration hash;
- semantic mode, feedback mode, tie-break and Top-K;
- model and prompt version for any GPT-backed run;
- output filename and SHA-256.

Formal runs must use a clean worktree and protected, non-overwriting
`exports/*.local.*` files. The same investor snapshot must be used for both
profiles.

## Procedure

1. Receive four funding-round records from Maiko and confirm their source,
   permission and report-redaction boundary.
2. Validate the inputs and record their provenance.
3. Freeze the authorised investor snapshot.
4. Run `legacy` and `normalisation-v1` on the exact same inputs and investor
   snapshot, without using the received judgements to change either profile.
5. Pool both Top-10 lists per case, deduplicate by stable investor ID and apply
   one deterministic shuffle. The reviewer CSV hides algorithm profile, rank
   and score; its private manifest retains both sources for shared investors.
6. Transfer existing Maiko-supplied judgements only when the case and investor
   identity match. Complete every unseen pair with the same frozen
   qualification method and model settings.
7. Optionally repeat the same pooled pack for Maiko or Cathal as a human
   spot-check. Model-assisted labels must not be described as human reviews.
8. Validate that evidence columns were not altered and calculate paired
   P@5/P@10 deltas and reviewer agreement where multiple reviewers exist.

The current exporter accepts two to four query inputs and writes the complete
review context into a protected local comparison file:

```bash
npm run irp:export-normalisation-comparison -- \
  --input exports/case-01.local.json \
  --input exports/case-02.local.json \
  --input exports/case-03.local.json \
  --input exports/case-04.local.json \
  --investors-csv exports/investors-final.local.csv \
  --experiment-id maiko-final-v1 \
  --purpose formal \
  --semantic-mode text-similarity \
  --created-at <ISO-8601 timestamp> \
  --output exports/maiko-final-v1.local.json
```

If the final method uses GPT, use `--semantic-mode gpt-semantic` only with an
authorised key; the runner refuses fallback-only output.

Generate one combined algorithm-blinded pooled review pack:

```bash
npm run irp:prepare-pooled-expert-review-pack -- \
  --comparison exports/maiko-final-v1.local.json \
  --pack-id maiko-pooled-round-1 \
  --created-at <ISO-8601 timestamp> \
  --output exports/maiko-pooled-round-1.local.csv \
  --manifest exports/maiko-pooled-round-1-manifest.local.json
```

Give reviewers only the CSV; keep the manifest private. Reviewers enter one
pseudonymous `reviewer_id`, `up` or `down`, and a comment on every row.

After the returned files are complete:

```bash
npm run irp:evaluate-pooled-expert-reviews -- \
  --review exports/maiko-pooled-round-1-returned.local.csv \
  --manifest exports/maiko-pooled-round-1-manifest.local.json \
  --evaluation-id maiko-final-evaluation-v1 \
  --purpose formal \
  --created-at <ISO-8601 timestamp> \
  --output exports/maiko-final-evaluation-v1.local.json
```

Add Cathal's returned copy of the same pooled CSV with the corresponding
private manifest when available.

## Analysis contract

Primary outputs:

- per-case thumbs-up count and rate in Top 10;
- per-case thumbs-up rate in Top 5;
- macro P@5 and P@10 for each profile;
- `normalisation-v1 - legacy` deltas;
- raw pairwise reviewer agreement when at least two reviewers complete the
  same packs;
- representative positive, negative and disagreement comments.

MRR and NDCG from the earlier graded blind study may appear as historical or
supplementary evidence. They are not the headline result for this binary,
small-case expert review.

## Pilot result received on 13 August 2026

Maiko returned the 33 previously unseen pooled pairs. The returned file has 33
unique review item IDs, one reviewer ID, valid binary labels and non-empty
comments. A cell-level comparison found zero changes outside `reviewer_id`,
`thumbs_up` and `review_comment`. Together with the 22 safely transferred
labels, this completes all 55 unique pooled pairs.

The frozen local text-similarity comparison produced the following descriptive
pilot result:

| Metric | Legacy | Normalisation v1 | Delta |
|---|---:|---:|---:|
| Macro P@5 | 0.450 | 0.550 | +0.100 |
| Macro P@10 | 0.300 | 0.425 | +0.125 |

This result is evaluated and reproducible from the protected local files, but
it is still a pilot. Maiko confirmed that the current platform uses the
existing matching algorithm with `gpt-4o-mini` semantic scoring. On 17 August
Maiko supplied the full platform semantic prompt. Its canonical content is
byte-identical to the prompt in the independent progress configuration,
supervisor configuration, supervisor storage default and preserved baseline
storage default (SHA-256
`9269a48b931b6469ab8f342370747e596f0e2073e5bb9a3c3a6afde9992f4061`).
On 17 August, the private Replit saved-run export supplied the four production
runs and their stored 383-investor historical snapshot. All 40 workbook Top-10
rows and all 80 Review Template rows match those saved results; rows 11--20 are
ranks 11--20 of the same current algorithm. The effective configuration and
empty feedback context are also recorded. The exact deployment identifier and
original Airtable return order remain unavailable, so a fresh GPT run cannot be
claimed as a byte-exact historical replay.

The frozen deterministic paired comparison was therefore rerun on the verified
383-investor snapshot. It produces 56 pooled pairs, with 39 earlier labels
transferred by exact case plus stable investor ID. Maiko returned the 17 new
judgements on 18 August using the same frozen Claude Skill and Claude Opus 5
procedure. The return contains the exact requested IDs, all review fields are
complete and zero protected evidence cells changed.

The final descriptive result is:

| Metric | Legacy | Normalisation v1 | Delta |
|---|---:|---:|---:|
| Macro P@5 | 0.350 | 0.500 | +0.150 |
| Macro P@10 | 0.300 | 0.400 | +0.100 |
| Mean positive matches in Top 10 | 3.0 | 4.0 | +1.0 |

An independent implementation recomputed every per-case and aggregate metric
and matched the frozen evaluator output exactly.

The same clarification confirms that the Review Template uses startup-supplied
data and that startup names must be anonymised in the IRP report. The supplied
v1.1 reproducibility record also replaces the archive-level Skill identity with
two member-file hashes. Both members match the original local copy exactly, so
no labels or metrics need to be rerun.

## Interpretation boundary

The report must describe the result as an initial indication. It must state
that the sample contains only four startups, the reviewers are not the
actual investors, judgements are subjective, and the study is not designed to
support a population-level or statistically significant claim.

## Verification closure

- Chuan Ju completed the final private-package check on 21 August. The package
  hash matched; the verifier returned `PASS_FINAL`, 56/56 coverage, zero
  protected evidence changes and all expected macro values, with no
  discrepancies.
- Cathal/Maiko: optionally complete a small algorithm-blinded human spot-check;
  this is required only for a human expert-review claim.
