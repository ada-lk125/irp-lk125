# Feedback comparison runner

On 21 July I connected the curated feedback selector to the matcher without changing the existing production default. The comparison runs GPT semantic scoring twice for one query: once with no feedback and once with the curated context. Both runs use the same startup, funding round, investor pool, matching configuration and top-ten cutoff.

The context contains only the selected review reasons, split into positive and negative groups. Investor names, startup names and internal IDs are not added to the prompt. The builder also refuses an empty set or an oversized context instead of silently changing the input.

Before either run starts, the runner checks the configuration hash, candidate-pool hash, query IDs and feedback-set version and hash. Its returned metadata records counts and hashes, not the feedback text. Real feedback and scored results still belong in ignored local files.

Run the offline checks from `reference/undaunted-progress`:

```bash
./node_modules/.bin/tsx server/scripts/check-week-six-feedback-readiness.ts
```

The test scorer uses fictional records. Passing this command shows that the control and variant are isolated correctly; it does not show that feedback improves ranking. Chuan's frozen labels, metrics and error review are still needed before this variant can be selected.
