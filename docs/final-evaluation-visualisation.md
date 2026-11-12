# Final evaluation visualisation

The final comparison needs to be visible as well as reproducible. Once Chuan returns the authoritative no-feedback and curated-feedback metric files, this command turns the four agreed ranking metrics into a single SVG. The upper chart compares the macro Precision@5, Precision@10, MRR and NDCG@10 values. The lower section shows the change for each of the three queries as Q1, Q2 and Q3, without exposing the real query, startup or funding round identifiers.

From `reference/undaunted-progress`, run:

```bash
npm run irp:prepare-feedback-evaluation-visualisation -- \
  --batch-manifest exports/feedback-batch.local.manifest.json \
  --none-metrics exports/feedback-none-metrics.local.json \
  --curated-metrics exports/feedback-curated-metrics.local.json \
  --ai-model gpt-4o-mini \
  --implementation-commit "$(git rev-parse HEAD)" \
  --svg-output exports/feedback-evaluation.local.svg \
  --manifest-output exports/feedback-evaluation.local.visualisation.json
```

The command checks the scored comparison files, metric definitions, query identities and macro means before drawing anything. Its sidecar manifest records the metric hashes, model, matching configuration hash and implementation commit. Both outputs stay under the ignored `exports/` directory and existing files are never replaced.

The chart does not decide that curated feedback is better on its own. Consistent improvement only moves that run to qualitative error review. Mixed, unchanged or regressed results retain the no-feedback control. Real results are therefore still waiting for the private Replit runs and Chuan's frozen metric files.
