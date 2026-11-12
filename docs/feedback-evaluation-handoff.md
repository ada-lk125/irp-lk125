# Feedback evaluation handoff

This is the downstream metrics receiver. It must not be used until the revised `feedback-ablation-intake-v1` handover reports `ready-for-metrics`. If the intake reports an unseen top-ten pair, supplementary blind labelling and a new frozen label set come first.

The feedback experiment now has a receiver-side boundary for Chuan's frozen metric outputs. It accepts one `frozen-ranking-metrics-v1` file for the no-feedback control and one for the curated-feedback run. Both files must cover the same three query IDs, startup and funding round identities, and 30 judged pairs recorded by the comparison batch. Each summary value must also match the macro mean of its three per-query values.

The receipt records the batch manifest hash, matching-configuration hash, feedback-set hash and both metric-file hashes. The decision file then shows the change in Precision@5, Precision@10, MRR and NDCG@10. It does not recalculate Chuan's metrics or read her frozen labels.

Run the private preparation command from `reference/undaunted-progress`:

```bash
./node_modules/.bin/tsx server/scripts/prepare-feedback-evaluation-decision.ts \
  --batch-manifest exports/feedback-batch.local.manifest.json \
  --none-metrics exports/feedback-none-metrics.local.json \
  --curated-metrics exports/feedback-curated-metrics.local.json \
  --receipt-output exports/feedback-result.local.receipt.json \
  --decision-output exports/feedback-result.local.decision.json
```

The inputs and outputs must stay under the ignored `exports/` directory. Before writing anything, the command rechecks the three scored batch files against their manifest. Existing outputs are not overwritten. Even when all four metrics move in the right direction, the result is only marked for error review. A final algorithm choice still needs the real private files and a check of the affected cases.

The repository currently contains the executable handoff and fictional checks only. It does not contain Chuan's labels, real query IDs or a measured performance result.
