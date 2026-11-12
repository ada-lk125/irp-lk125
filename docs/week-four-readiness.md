# Week 4 readiness check

By 10 July, the first matcher variant is still deliberately small. It cleans rule inputs before scoring, then checks whether a later variant export can be compared with the matching baseline export. I added one combined command so I can rerun the local Week 4 path without remembering each separate script:

```bash
npm run irp:check-week-four-readiness
```

The command runs:

- `irp:check-week-four-boundary`
- `irp:check-stage-instrument-normalisation`
- `irp:check-geography-normalisation`
- `irp:check-variant-comparison-inputs`

This gives me a local gate before I try any live comparison. It checks that the baseline weights and AI boundary have not moved, that stage/instrument aliases and geography aliases reach the same scoring path as canonical values, and that a baseline export and variant export can be checked for matching query identity.

The check is intentionally limited. It does not call Airtable or OpenAI. It does not calculate Precision@5, Precision@10, MRR or NDCG. It also does not read Chuan's labels or write private exports. The real comparison still needs the private baseline exports, the normalisation variant exports and Chuan's frozen labelled input.

For now, this is the safest Week 4 stopping point: the first rule-input variant has a runnable local check, and the labelled evaluation boundary is still separate.
