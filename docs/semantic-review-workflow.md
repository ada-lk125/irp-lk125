# Semantic review workflow

On 17 July I added the checks needed to inspect the Week 5 semantic comparison without exposing profile text or claiming an evaluation result too early.

The text signal audit reports which startup fields are present, which fields are missing, whether the startup context is truncated, and aggregate coverage across the investor candidate pool. Investor names, identifiers and text values are not part of this summary. This makes sparse or heavily truncated inputs visible before I try to explain a ranking change.

The comparison review reads the three private method outputs and records:

- top-10 and top-5 overlap between each pair of methods;
- how many shared investors stayed at the same rank;
- the average rank movement among shared investors;
- semantic score ranges and hard exclusion counts.

These checks describe how the methods differ. They do not measure relevance. Every review remains marked `requires-frozen-labels` until Chuan's frozen judgements are available for the same query and investor pairs.

After the three private comparison exports have been generated, run:

```bash
npm run irp:review-semantic-comparisons -- \
  --input exports/semantic-comparison-query-01.local.json \
  --input exports/semantic-comparison-query-02.local.json \
  --input exports/semantic-comparison-query-03.local.json \
  --output exports/semantic-comparison-review.local.json
```

The command accepts exactly three distinct queries and rejects repeated startup and funding-round pairs, even if they use different query IDs. Inputs and output must stay under `exports/` and end with `.local.json`; an existing review file will not be replaced. The saved review uses the `semantic-comparison-review-v2` schema and contains the three stable query identifiers and candidate-pool hashes for traceability. The signal audit is rebuilt from an explicit field list, so extra profile text or identifiers cannot pass through into the review.

The primary Week 5 comparison still excludes historical feedback. No feedback signal has been selected yet. Feedback should remain a separate experiment until Chuan's grouping of useful and weak examples is ready.
