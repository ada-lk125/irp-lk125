# Week 4 rule variant plan

This week starts the algorithm-change part of my IRP. Week 1 mapped the baseline, Week 2 made exports repeatable, and Week 3 separated scored outputs from blind labelling. I am now moving from reading and export guards into small matcher changes.

The first rule variant should stay narrow. I will not change the AI prompt, semantic score weight, output shape, or frontend result contract in the first pass. The first changes should only touch fields that enter the rule layer before scoring:

- round stage and investor stage labels;
- funding instrument labels;
- startup sector labels mapped into the investor sector taxonomy;
- geography labels used by `geoCompatibility`.

The current source boundary in the school repository is:

- `reference/undaunted-progress/server/services/matching.ts`
- `reference/undaunted-progress/server/services/matching-config.ts`
- `reference/undaunted-progress/shared/sector-taxonomy.ts`
- `reference/undaunted-progress/server/scripts/export-baseline-matches.ts`

For each variant I need one baseline export and one variant export with the same query IDs and investor IDs. Chuan owns the frozen labels and final evaluation input, so I should not rebuild that part in my repository. My job is to produce variant outputs that can be joined later without changing the private labelling contract.

## First variant boundary

`normalisation-v1` should start with label cleanup, not weight tuning. If a result changes, the reason should be traceable to a field entering the same scoring function in a cleaner form. I should be able to explain the change without saying that the model "just performed better".

I will avoid these changes for now:

- no semantic prompt rewrite;
- no AI candidate count change;
- no new metric runner owned by Chuan's branch;
- no private CSV, labels, ranks, scores, or Airtable records committed;
- no broad rewrite of `matching.ts`.

## Local checks needed before keeping a variant

The local fixture should still run without Airtable or OpenAI access. The check should confirm that:

- the baseline output shape stays the same;
- `queryId + investorId` remains stable;
- `scoreBreakdown`, `matchReasons`, and `aiInsight` remain available;
- the variant only changes rule inputs or rule scores that the note names directly.

The live comparison still depends on the real formal baseline exports and Chuan's frozen labels. Until those are available, I can prepare the code path and local checks, but I should not claim a measured improvement.

## Executable boundary check

I added a small local check before changing more rule behaviour:

```bash
npm run irp:check-week-four-boundary
```

This check does three things. It confirms the baseline weights still sum to one, checks that the default AI model, AI candidate count and exclusion cap have not moved, and tests the sector taxonomy mapping used before sector scoring. It does not call Airtable or OpenAI, and it does not write an export.

## Stage and instrument normalisation

The first implemented part of `normalisation-v1` is a small stage and instrument cleanup before rule scoring. The matcher now reads common aliases such as `pre_seed`, `Series C+`, `convertible loan` and `Equity (VC)` as the same scoring values already used by the baseline config.

This is intentionally not a weight change. The same scoring functions still run afterwards, and the result payload keeps the same `scoreBreakdown`, `matchReasons` and AI fields. The change only reduces avoidable mismatches where the data means the same thing but arrives with different spelling, separators or wording.

I added the local check:

```bash
npm run irp:check-stage-instrument-normalisation
```

The check confirms that alias values normalise into the expected canonical labels, and that a canonical example and an alias example produce the same stage score, instrument score, total rule score and match reasons. It runs without Airtable or OpenAI access.

## Geography normalisation

The next part of `normalisation-v1` applies the same idea to geography. The matcher now cleans common geography labels before it looks up `geoCompatibility`. For example, `UK`, `United Kingdom`, `Europe excl UK`, `EU`, `United States`, `worldwide` and `international` are mapped into the geography labels already used by the config.

I kept the existing geography scoring behaviour. A compatible region still scores 100, a missing field still uses the existing default, and an unsupported geography still falls back through the same no-match path. The change only affects how labels are read before comparison.

The local check is:

```bash
npm run irp:check-geography-normalisation
```

This command checks the alias map and runs a small in-memory matcher example. A canonical geography example and an alias example must produce the same geography score, total score and match reasons. It does not call Airtable or OpenAI.

## Variant comparison input check

Before I can compare a baseline export with a normalisation variant, I need to know that both files describe the same query. I added a small input check for that handoff. It compares the baseline and variant exports by `queryId`, `startupId` and `fundingRoundId`, then counts how much the evaluated top-k investor set changed.

The check does not calculate Precision@k, MRR or NDCG. Chuan owns the frozen labels and the final evaluation input. This script only tells me whether my two scored exports are safe to hand into that later evaluation step.

The local self-check is:

```bash
npm run irp:check-variant-comparison-inputs
```

When real ignored exports are available, the same command can read them from `exports/`:

```bash
npm run irp:check-variant-comparison-inputs -- \
  --baseline exports/baseline-formal-query-01.local.json \
  --variant exports/variant-query-01.local.json \
  --top-k 10 \
  --require-full-top-k
```

It prints counts only. It does not write output files, and it should not be used to share scored JSON or private labels.
