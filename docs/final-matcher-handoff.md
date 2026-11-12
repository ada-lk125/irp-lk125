# Final matcher handoff

The final method should not be chosen from a chart alone. This handoff waits for the metric receipt, decision, visualisation manifest and Chuan's per-query error review. It binds those four private files by SHA-256 before marking either `no_feedback_gpt` or `curated_feedback` as ready for runtime integration.

Curated feedback can move forward only when all four ranking metrics show a consistent improvement and the error review approves it. The control remains the final method when the metrics are mixed, unchanged or worse, or when the qualitative review finds a practical problem. This keeps the selection rule conservative without taking over Chuan's evaluation work.

From `reference/undaunted-progress`, run:

```bash
npm run irp:prepare-final-matcher-handoff -- \
  --receipt exports/feedback.local.receipt.json \
  --decision exports/feedback.local.decision.json \
  --visualisation-manifest exports/feedback.local.visualisation.json \
  --error-review exports/feedback.local.error-review.json \
  --selected-method curated_feedback \
  --review-outcome approve-curated \
  --output exports/feedback.local.final-matcher.json
```

The output records the selected method, AI model, matching configuration hash, implementation commit and the result fields expected by the existing interface. It stays under the ignored `exports/` directory and cannot replace an earlier handoff. No real selection has been made yet; the command is ready for the private evidence when it arrives.
