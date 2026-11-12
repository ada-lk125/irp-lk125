# Feedback comparison export

On 22 July I added the private export for the Week 6 feedback comparison. Each file contains one query with the no-feedback control and curated-feedback top ten. The rows keep the rank, investor ID, score breakdown, match reasons and AI insight needed for later review.

The export does not contain the feedback context. It records the feedback-set version, SHA-256 hash, character count and positive and negative example counts instead. The file also carries the query IDs, candidate-pool hash and matching-configuration hash, so a result can be checked against the experiment that produced it.

Output is limited to `exports/*.local.json`. The writer validates the full object, refuses paths outside `exports/`, and will not replace an existing file. It writes a temporary file in the same directory and publishes the final name with an exclusive operation. The offline check also runs two concurrent writes to confirm that only one can succeed.

Run the current local workflow from `reference/undaunted-progress`:

```bash
./node_modules/.bin/tsx server/scripts/check-week-six-feedback-readiness.ts
```

The check uses fictional records and a temporary directory. Real scored exports remain ignored. They must still be joined to Chuan's frozen labels before Precision@5, Precision@10, MRR or NDCG@10 can be reported.
