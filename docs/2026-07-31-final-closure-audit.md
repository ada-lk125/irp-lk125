# Final closure audit and validation plan

Date: 31 July 2026

> Historical status: the 57-row pooled-label completion path in this document
> was superseded as the final main evaluation by Maiko's 3 August meeting
> direction. See `2026-08-03-maiko-final-evaluation-protocol.md`. The technical
> findings and supplementary workflow remain valid; the ordered completion
> path below is no longer the controlling final plan.

## Executive status

The IRP implementation path is substantially complete, but the research claim
is not yet complete. The code can be reproduced offline and the individual
repository now has an independently runnable interface. The available
formal-v3 human labels establish a real baseline. They do not yet establish
that normalisation, a semantic method or curated feedback improves ranking
quality.

The correct final claim at this point is:

> The project has implemented and tested a configurable matching pipeline and
> a controlled evaluation workflow. Formal-v3 baseline quality has been
> independently cross-checked. A final improvement claim remains conditional
> on protected variant runs, pooled blind labels and frozen paired metrics.

## Repository audit

### Individual IRP repository

Issues found and addressed:

- `dev` and `build` referred to files that were not present, so the snapshot
  was not independently runnable.
- The package retained the full production web application's dependency set
  even though the snapshot imports only CSV parsing, OpenAI and PostgreSQL
  clients at runtime.
- There was no package-level test command and test files were excluded from
  TypeScript project coverage.
- The submission audit checked only `irp:*` script targets and therefore did
  not detect the broken application scripts.
- There was no self-contained user interface.

The snapshot now has working `dev`, `start`, `build`, `check` and `test`
commands, a minimal dependency set, an HTTP integration test and a local
interface. The interface runs the actual `runMatching` implementation twice,
with the legacy and `normalisation-v1` profiles, on fictional investor data.

### Supervisor repository

The current `algorithm-lingxin-kong` matcher and the individual repository's
progress matcher are source-identical. The supervisor repository contains the
authenticated production frontend and route lifecycle; the individual
repository contains the reproducible research subset.

The production frontend should not be copied wholesale. It is coupled to
authentication, the active startup record, the database, server-sent progress
events, saved results, feedback, introductions, analytics and deployment
configuration. Copying it would enlarge the submission without making the
algorithm more reproducible. The standalone interface instead recreates only
the input, comparison and explanation contract required for the IRP.

The supervisor workspace's platform overrides removed every Darwin ARM64
binary, which prevented an Apple Silicon lockfile installation. The current
platform's five optional packages are now retained while the Linux/Replit
versions remain pinned. The complete IRP readiness path passes without a
temporary `esbuild` environment override.

The supervisor branch's IRP-specific final readiness command passes in full.
The wider shared API is not globally green: 77 tests pass, while three suites
cannot load without `DATABASE_URL`; the broad API TypeScript check also reports
many pre-existing errors in authentication, generic routes, database storage
and schema integration. These are shared-application risks, not matching
evidence, and should be triaged by the product owners rather than silently
folded into the IRP algorithm change.

### Remaining maintainability items

These should be fixed before a final merge, but should not be mixed with the
research comparison:

1. `export-formal-baselines.ts` and `export-formal-variants.ts` still duplicate most
   of their orchestration. Replace them with one parameterised formal-run
   helper after the real file naming convention is frozen.
2. Several commands still default to the older unversioned/formal-v1 file
   names, while the current evidence is formal-v3. Introduce an explicit
   experiment ID or manifest-driven input rather than silently renaming files.
3. Clarify label ownership. The formal and supplementary freeze commands now
   perform independent source, hash, evidence and completeness verification,
   but they do not decide whether Lingxin or Chuan owns the authoritative
   manifest and metric receipt.
4. The public matcher now rejects invalid `topN`, semantic batch sizes,
   weights and duplicate investor IDs. Historical runs retain input-order ties,
   while new comparison contracts require deterministic investor-ID ties.

## Evidence currently available

The formal-v3 blind pack contains 30 rows across three queries. Its returned
file has 30 completed judgements, no holds and a matching source hash. An
independent read-only parse found 14 `strong`, 14 `possible` and 2 `weak`
labels.

Using graded gains of 2, 1 and 0 for `strong`, `possible` and `weak`, the
current legacy baseline cross-check is:

| Query | P@5 | P@10 | MRR | NDCG@10 |
|---|---:|---:|---:|---:|
| Q1 | 1.000 | 1.000 | 1.000 | 0.781822 |
| Q2 | 1.000 | 1.000 | 1.000 | 0.764517 |
| Q3 | 1.000 | 0.800 | 1.000 | 0.942353 |
| Macro mean | 1.000 | 0.933333 | 1.000 | 0.829564 |

This is an independent cross-check, not Chuan's authoritative frozen metric
receipt. P@5 and MRR are already saturated on these three queries. The primary
metric for the final paired comparison should therefore be NDCG@10; P@10 is a
secondary metric, and P@5/MRR should be non-inferiority checks rather than
headline improvement measures.

Three queries are enough for a pilot and for detailed case analysis, not for a
strong general performance claim. If schedule permits, expand to at least ten
representative queries covering stage, sector, geography, ticket size and
instrument variations. A second blinded reviewer and agreement statistic
would strengthen label reliability.

## Candidate-selection risk

The rule score is coarse and produces large ties before semantic reranking.
On the current 354-investor snapshot:

| Query | Legacy top/cutoff tie | Normalisation-v1 top/cutoff tie | Shared top 60 |
|---|---:|---:|---:|
| Q1 | 197 at 39 | 123 at 54 | 39/60 |
| Q2 | 198 at 41 | 124 at 56 | 39/60 |
| Q3 | 14 at 41; 185 at cutoff 39 | 12 at 56; 113 at cutoff 54 | 41/60 |

Because JavaScript sorting is stable, the source row order was an implicit
tie-breaker when only the first 60 candidates were sent to a semantic scorer.
Historical outputs retain that behaviour. New comparisons now require an
explicit investor-ID tie-break, and automated checks reverse the investor
source order to verify that both rule-only and text-similarity results remain
unchanged.

## Required before-and-after experiment

Use two complementary evaluations:

1. **Component isolation.** Give baseline and variant semantic rerankers the
   same frozen candidate pool. This isolates the effect of normalisation,
   semantic context or feedback.
2. **End-to-end evaluation.** Let each method generate its own candidates,
   then pool the union of both top tens for blind judgement. This measures the
   full system while avoiding the bias of judging baseline results only.

For every run, freeze the query inputs, 354-investor snapshot hash, candidate
pool hash, matching configuration, model and prompt version, feedback-set
hash, implementation commit and output hash. Do not overwrite an earlier run.

Report:

- macro and per-query NDCG@10, P@10, P@5 and MRR;
- paired deltas against the legacy baseline;
- top-ten overlap and ranking movement;
- false-positive and false-negative examples by stage, sector, geography,
  ticket and instrument;
- latency, model-token/cost information and deterministic rerun behaviour;
- which changes are algorithmic and which are only interface or
  infrastructure work.

## Ordered completion path

1. Keep the standalone app and full offline readiness check green from a clean
   `npm ci`.
2. Repair and verify the supervisor checkout's dependency installation. Do
   not change the production route.
3. Freeze the tie-break/candidate-pool protocol and experiment IDs before
   generating any new evidence.
4. Run the legacy and `normalisation-v1` comparison first. Maiko's feedback is
   not required for this comparison. A rule-only pilot is complete.
5. Run the no-feedback semantic comparison on the same controlled inputs. A
   deterministic local text-similarity pilot is complete; GPT remains pending
   an authorised key/environment.
6. When Maiko returns the four real-startup feedback ratings, freeze their
   provenance and run `curated_feedback` as a separate ablation. Do not
   substitute invented or synthetic feedback.
7. Blind-label every new query-investor pair in the pooled top tens. The
   current pilot requires 57 new labels; reuse a formal-v3 label only when the
   query-investor pair is identical. The supplementary freeze receiver, safe
   label-transfer path and missing-label evaluation guard are complete.
8. Have Chuan produce or approve the frozen metric receipt and document the
   ownership decision.
9. Select a final method only if NDCG@10 improves without unacceptable
   regression in P@10, P@5/MRR, latency or error patterns. A null or negative
   result is still a valid IRP result and must be reported honestly.
10. Only after the handoff identity matches the chosen evidence should the
    guarded production route be activated.

If external feedback or labelling is delayed, steps 1–5 remain useful and
should be completed first. The presentation can already demonstrate the
standalone code path and explain the formal-v3 baseline, ceiling effects and
candidate-tie discovery. It must label any fictional demonstration as a
demonstration, not as proof of improved matching.
