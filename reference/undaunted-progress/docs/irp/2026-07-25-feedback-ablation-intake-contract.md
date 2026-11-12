# Feedback ablation intake contract

Chuan's Week 6 receiver contract is fixed as `feedback-ablation-intake-v1`. The private handover contains two methods, `no_feedback_gpt` and `curated_feedback`, for the same three query identities and the same candidate pool per query. Each method/query group contains ranks 1–10.

The CSV contains only the schema version, method, stable query/startup/funding-round/investor IDs and rank. It excludes scores, score breakdowns, match reasons, AI insight, investor names and feedback text. The companion `feedback-ablation-intake-manifest-v1` contains exactly one `candidatePoolSha256` per query and records SHA-256 values for the intake CSV, source comparison-batch manifest, frozen-label CSV and frozen-label manifest.

From `artifacts/api-server`, after the replacement query 03 comparison and formal-v3 labels have both been frozen, run:

```bash
pnpm run irp:prepare-feedback-ablation-intake -- \
  --batch-manifest exports/feedback-batch.local.manifest.json \
  --frozen-labels exports/blind-labelling-formal-v3-labelled.local.csv \
  --frozen-manifest exports/blind-labelling-formal-v3-frozen-manifest.local.json \
  --csv-output exports/feedback-ablation-intake-v1.local.csv \
  --manifest-output exports/feedback-ablation-intake-v1.local.manifest.json
```

The command reads the three private comparison exports listed in the batch manifest and maps internal modes as follows:

| Internal mode | Intake method      |
| ------------- | ------------------ |
| `none`        | `no_feedback_gpt`  |
| `curated`     | `curated_feedback` |

The manifest computes coverage over the union of both methods' top-ten query/investor pairs. If any pair is absent from the frozen labels, the status is `requires-supplementary-blind-labelling`. If labels contain a hold or another incomplete query, the status is `requires-complete-frozen-labels`. Metrics may start only when the status is `ready-for-metrics`.

The writer keeps both outputs under `exports/` and refuses to overwrite an existing file. The committed check uses fictional IDs and labels; no real ranking, frozen label or performance result is committed.
