# Final ranking movement

The final evidence now has two views. The frozen-metric chart answers whether
the selected method improved Precision@5, Precision@10, MRR and NDCG@10. This
ranking chart answers a different question: which anonymous investors moved
within the top results?

The command accepts one baseline route result, one selected-method route
result and the final matcher handoff. It refuses different queries, different
candidate pools, unsupported handoffs and files outside `exports/`. The SVG
uses aliases such as `I001`; it does not include Airtable IDs, investor names,
scores, reasons or AI insight.

Run the offline check with:

```bash
npm run irp:check-final-ranking-movement
```

Private outputs use `.local.svg` and `.local.ranking-movement.json` suffixes.
The manifest records the input hashes, candidate-pool hash, AI model, matching
configuration hash and implementation commit. It also states how many
anonymous candidates moved up, moved down, stayed in place, entered or left
the chosen top list.

Rank movement is not proof of better matching. The final decision still comes
from Chuan's frozen metrics and per-query error review.
