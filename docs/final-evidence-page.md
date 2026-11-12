# Final evidence page

The final local report brings the evaluation evidence into one place. It shows
Chuan's frozen comparison for Precision@5, Precision@10, MRR and NDCG@10,
followed by anonymous ranking movement for Q1, Q2 and Q3. The page also records
the selected method, AI model, matching configuration hash, feedback-set hash
and implementation commit.

The generator accepts only the approved final matcher handoff, its metric
visualisation, and three ranking-movement manifests and SVGs. Every file must
be inside `exports/`, use a private `.local` suffix and match its SHA-256
record. Active SVG content, Airtable identifiers, duplicate queries, identity
mismatches and overwrites are rejected.

Run the offline contract check with:

```bash
npm run irp:check-final-evidence-page
```

Once the private frozen results are ready, build the page with:

```bash
npm run irp:prepare-final-evidence-page -- \
  --handoff exports/final.local.final-matcher.json \
  --metric-manifest exports/final.local.visualisation.json \
  --metric-svg exports/final.local.svg \
  --q1-ranking-manifest exports/q1.local.ranking-movement.json \
  --q1-ranking-svg exports/q1.local.svg \
  --q2-ranking-manifest exports/q2.local.ranking-movement.json \
  --q2-ranking-svg exports/q2.local.svg \
  --q3-ranking-manifest exports/q3.local.ranking-movement.json \
  --q3-ranking-svg exports/q3.local.svg \
  --created-at 2026-07-30T12:00:00.000Z \
  --html-output exports/final.local.final-evidence.html \
  --manifest-output exports/final.local.final-evidence.json
```

The HTML has no client-side JavaScript and does not replace the production
result screen. It is a review artifact for the final test: frozen metrics show
whether quality changed, while the ranking diagrams make the effect easier to
inspect. No improvement should be claimed until the real approved handoff is
available.
