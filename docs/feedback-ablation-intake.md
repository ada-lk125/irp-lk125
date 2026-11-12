# Feedback ablation intake contract

Chuan's Week 6 receiver contract is fixed as `feedback-ablation-intake-v1`. The private handover contains `no_feedback_gpt` and `curated_feedback` for the same three query identities and candidate pools, with ranks 1–10 for every method/query group.

The CSV contains only the schema version, method, stable query/startup/funding-round/investor IDs and rank. It excludes scores, score breakdowns, match reasons, AI insight, investor names and feedback text. Its `feedback-ablation-intake-manifest-v1` records the intake CSV hash, one `candidatePoolSha256` per query, the comparison-batch manifest hash, and both frozen-label file hashes.

From `reference/undaunted-progress`, after replacement query 03 and formal-v3 labels are frozen, run:

```bash
npm run irp:prepare-feedback-ablation-intake -- \
  --batch-manifest exports/feedback-batch.local.manifest.json \
  --frozen-labels exports/blind-labelling-formal-v3-labelled.local.csv \
  --frozen-manifest exports/blind-labelling-formal-v3-frozen-manifest.local.json \
  --csv-output exports/feedback-ablation-intake-v1.local.csv \
  --manifest-output exports/feedback-ablation-intake-v1.local.manifest.json
```

Internal `none` maps to `no_feedback_gpt`; internal `curated` maps to `curated_feedback`. Coverage is checked over the union of both top-ten lists. Any unseen query/investor pair produces `requires-supplementary-blind-labelling`; incomplete frozen labels produce `requires-complete-frozen-labels`. Metrics may start only at `ready-for-metrics`.

Both outputs remain under ignored `exports/` paths and cannot overwrite existing files. The committed check uses fictional data only.
