# Stage and instrument normalisation

This note records the first implemented Week 4 matcher change.

The baseline matcher already had fixed rule scores for funding stage and investment instrument overlap, but it compared many labels directly. That made simple data differences matter more than they should. For example, `pre_seed` and `Pre-seed` describe the same stage, and `convertible loan` and `Convertible Note` describe the same broad instrument for this matching layer.

I added a small normalisation helper before the existing scoring functions run. It maps common aliases into the canonical labels already used by the baseline configuration, then leaves unknown values untouched. This keeps the change narrow: it reduces avoidable spelling and separator mismatches without changing weights, AI prompts, semantic scoring, frontend fields or Chuan's evaluation workflow.

Current scope:

- stage aliases such as `pre seed`, `pre_seed`, `Series C+`, `growth` and `stage agnostic`;
- instrument aliases such as `Equity (VC)`, `convertible loan`, `SAFE note`, `revenue_based_finance`, `venture debt` and `grant funding`;
- duplicate canonical labels are collapsed before scoring;
- unknown labels remain available to the existing fallback paths.

Local validation:

```bash
npm run irp:check-stage-instrument-normalisation
npm run irp:check-week-four-boundary
```

The first command checks the alias map and runs a small in-memory matcher example. A canonical example and an alias example must produce the same stage score, instrument score, total score and match reasons. The second command confirms that the baseline weights and AI boundary settings have not moved.

This work does not use live Airtable data and does not produce a formal performance result. The real comparison still needs the private baseline exports, frozen labels and Chuan's authoritative evaluation input.
