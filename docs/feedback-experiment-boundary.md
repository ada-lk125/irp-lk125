# Feedback experiment boundary

Week 5 compared rule-only, GPT semantic and local text similarity without historical feedback. I am keeping that result as the control instead of changing the earlier comparison after the fact.

The Week 6 experiment changes one thing: the GPT run may receive a curated feedback set. Both runs must use the same three queries, candidate pools, matching configuration and top-ten cutoff. The experiment definition stores their stable IDs and SHA-256 hashes, but it does not store feedback text or profile values.

The curated selector accepts feedback only after it has been grouped as `useful` or `weak`. It keeps useful examples, excludes feedback from the three evaluation funding rounds, and selects positive and negative entries separately. Entries are ordered by time with a stable ID tie-break, so the same input produces the same set and hash. Blank reasons, repeated pairs and invalid timestamps stop the selection.

Run the current offline boundary from `reference/undaunted-progress`:

```bash
./node_modules/.bin/tsx server/scripts/check-week-six-feedback-readiness.ts
```

This command reruns the Week 5 semantic checks before it checks the feedback experiment and selector. It uses fictional records and does not calculate ranking performance. Chuan's frozen labels, metric table and error analysis are still required before any feedback variant can be kept.

Real feedback, scored exports and frozen labels remain under ignored `.local.*` paths. Git contains the selection code and checks, not the private records.
