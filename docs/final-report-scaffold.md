# Final IRP report scaffold

## Material Passport

- Material type: report scaffold
- Created: 3 August 2026
- Status: local model-assisted pilot evaluated; formal platform comparison incomplete
- Evidence boundary: pilot result may be reported with limitations; do not call it the reproduced current-platform result

## Abstract

Placeholder: problem, baseline weakness, implemented optimisation, controlled
evaluation design, final numeric result, limitations and contribution.

Do not write a positive result into the abstract before the final evaluation
file exists.

## 1. Introduction

- Why startup-investor matching matters for ClimateTech fundraising.
- Project context and scope within Undaunted.
- Research question and contributions.
- Clear distinction between production integration and the independently
  reproducible IRP artifact.

## 2. Background and related work

- Multi-criteria startup-investor compatibility.
- Rule-based ranking and semantic reranking.
- Data quality and vocabulary-normalisation problems.
- Human relevance assessment for information-retrieval systems.
- Limitations of small expert case studies.

All literature and product claims need primary citations or explicit marking
as project observations.

## 3. Baseline system

- Submitted funding-round fields and investor fields.
- Legacy rule scores, weights and Top-N candidate selection.
- Semantic scoring boundary.
- Saved results and feedback path.
- Baseline weaknesses: label aliases, coarse ties, source-order tie-breaking,
  missing-context risk and external-service dependencies.

## 4. Optimisation design

- Stage, geography and investment-instrument normalisation.
- Deterministic investor-ID tie-breaking.
- Richer semantic context and input-coverage audit.
- Feedback ablation as a separate component experiment.
- Input validation, provenance hashes and failure guards.
- Rationale for each decision, linked to `docs/algorithm-decision-log.md`.

## 5. Implementation and reproducibility

- Relationship between `irp-lk125` and `algorithm-lingxin-kong`.
- Preserved baseline versus progress snapshot.
- Independent installation, checks and standalone interface.
- Public fictional fixtures versus ignored private evaluation files.
- Git commits, source hashes, environment variables and commands.

## 6. Evaluation methodology

Use `docs/2026-08-03-maiko-final-evaluation-protocol.md` as the controlling
protocol.

- Four complete real funding-round cases.
- Same inputs and investor pool for both profiles.
- Pooled, deduplicated and algorithm-blinded Top-10 review.
- Maiko's Claude Skill output as model-assisted assessment, with any Maiko or
  Cathal judgement reported separately as knowledgeable proxy review.
- Thumbs up/down plus mandatory reason.
- P@5, P@10, paired deltas and raw reviewer agreement.
- Historical blind-label and deterministic pilots clearly separated from the
  final case study.

## 7. Results

Status: all 55 pooled labels are complete for the frozen local text-similarity
pilot. The platform `gpt-4o-mini` comparison remains pending an authoritative
snapshot/configuration identity.

### 7.1 Implementation verification

Placeholder for clean-install command, tests, source parity and deterministic
rerun evidence.

### 7.2 Four-case model-assisted local pilot

| Case | Legacy up/10 | Normalisation v1 up/10 | Delta | P@5 change |
|---|---:|---:|---:|---|
| Case 1 | 4 | 5 | +1 | 0.60 → 0.80 |
| Case 2 | 3 | 5 | +2 | 0.20 → 0.60 |
| Case 3 | 3 | 5 | +2 | 0.60 → 0.40 |
| Case 4 | 2 | 2 | 0 | 0.40 → 0.40 |

| Metric | Legacy | Optimised | Delta |
|---|---:|---:|---:|
| Macro P@5 | 0.450 | 0.550 | +0.100 |
| Macro P@10 | 0.300 | 0.425 | +0.125 |
| Reviewer agreement | N/A | N/A | one model-assisted reviewer |

Report this as a positive initial indication: P@10 improved in three cases and
was unchanged in one, while P@5 improved in two, regressed in one and was
unchanged in one. Do not describe the labels as human expert review. The
qualification pass used Claude Opus 5 with public-web evidence.

### 7.3 Cross-environment operational comparison

For context, the current Replit `gpt-4o-mini` output supplied by Maiko has
macro P@5 0.200 and P@10 0.175. The local normalisation-v1 output has 0.550 and
0.425 respectively, descriptive differences of +0.350 and +0.250.

Do not use this as the primary optimisation-effect estimate. The semantic
scorer, candidate snapshot and execution environment were not held constant.
Use it only as an operational comparison of the two delivered result sets.

### 7.4 Error and disagreement analysis

Placeholder for stage, sector, ticket, geography and instrument false-positive
patterns, plus reviewer disagreements.

### 7.5 Supplementary experiments

- Earlier formal-v3 graded baseline.
- Rule-only and local text-similarity deterministic pilots.
- GPT comparison if an authorised key and frozen model configuration exist.
- Historical-feedback ablation, kept separate from the main comparison.

## 8. Discussion

- Whether the observed change is consistent across cases.
- Which algorithm component plausibly explains each movement.
- Cases where the optimised profile regresses.
- Practical meaning versus metric movement.
- What the study can and cannot predict about investor decisions.

## 9. Limitations and ethics

- Four cases only.
- One Claude Opus 5 model-assisted reviewer, not a human expert or actual investor.
- Subjective binary labels and possible memory/order effects.
- Exact model snapshot and sampling settings unavailable; four run-3 rows and
  six earlier rows contain explicitly unverified gates according to the
  supplied reproducibility record.
- Time-specific investor snapshot and data availability.
- Possible GPT nondeterminism, model change and cost.
- Private deck/founder data excluded from the public repository.
- No statistical significance or general performance claim.

## 10. Conclusion and future work

Placeholder: answer the research question in calibrated language, summarise
the engineering contribution, and propose broader multi-investor validation.

Use “initial indication” for a positive small-sample outcome. A null or
negative finding should be reported directly rather than hidden.

## Appendices

- Reproduction commands and environment matrix.
- Matching configuration and hashes.
- Review instrument and anonymised aggregate output.
- Detailed score/rank movement.
- AI-assistance disclosure and decision provenance.
