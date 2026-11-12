# Three-query feedback comparison batch

On 23 July I extended the feedback comparison from one query to the three-query evaluation set. The batch first checks that all three query IDs are present once. It also checks each startup and funding round pair, the fixed investor candidate pool and the minimum top-ten size. Inputs may arrive in any order, but the runner follows the order recorded in the experiment definition.

The runner processes one query at a time. Each query uses the same matching configuration and curated feedback set for its no-feedback control and curated-feedback run. This avoids a burst of scorer calls and keeps the progress output tied to a query ID and feedback mode. A changed configuration or candidate pool stops the batch before that query is scored.

Each query result remains a private `.local.json` file. A separate manifest records the three file names, query identities, candidate-pool hashes, matching-configuration hash, feedback-set version and SHA-256 values. It does not contain feedback text, investor profiles, match reasons or AI insight. The manifest is only published after all three files pass their schema and hash checks, and an existing manifest is never replaced.

Run the complete offline check from `reference/undaunted-progress`:

```bash
./node_modules/.bin/tsx server/scripts/check-week-six-feedback-readiness.ts
```

The check uses fictional inputs and temporary files. It confirms that the producer-side workflow is ready, but it does not report ranking quality. Precision@5, Precision@10, MRR and NDCG@10 still require Chuan's frozen labels and the three private query results.

## Protected real run

The real producer runs only in the authorised Replit environment. It first
reads historical match feedback from PostgreSQL inside a read-only transaction:

```bash
pnpm run irp:export-feedback-selection-source
```

Only non-blank human reasons of at most 500 characters can enter the curated
set. The next command checks the private formal-v3 query set and the fixed
354-investor pool before calling the scorer:

```bash
pnpm run irp:export-feedback-comparison-batch
```

The command writes three private comparison files and one batch manifest under
`exports/`. It stops before OpenAI if the curated source has no eligible
positive or negative reason. The scored files, feedback source and private
identifiers are not committed.
