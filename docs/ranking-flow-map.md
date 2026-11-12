# Ranking flow map

Target project week: 15-21 June 2026  
Day task: start mapping what happens after the baseline rule scores are calculated.  
Source repository: `/Users/lk125/Undaunted-Hub`

This note continues the rule scoring work from 17 June. I am now reading how the baseline begins to turn score fields into a ranked investor list.

## Files checked

| Source file | What I looked for |
| --- | --- |
| `server/services/matching.ts` | Weighted total score and preferred investor type multiplier. |
| `server/storage.ts` | Default weights and multiplier settings. |

## Weighted total

`computeWeightedTotal(...)` combines six score fields:

- `stageMatch`
- `ticketSizeMatch`
- `sectorOverlap`
- `geographyMatch`
- `instrumentMatch`
- `semanticScore`

The default weights are:

| Score field | Weight |
| --- | ---: |
| Stage | 0.20 |
| Ticket size | 0.15 |
| Sector overlap | 0.20 |
| Geography | 0.10 |
| Instruments | 0.05 |
| Semantic | 0.30 |

The baseline therefore puts 70% of the weighted score on rule-based fields and 30% on semantic scoring.

## Preferred investor type multiplier

`runMatching(...)` also checks `preferredInvestorTypes` from the funding round.

What I found:

- investor types and preferred types are compared as lower-case text;
- partial text matches can count as a type match;
- a matching type gets the configured boost;
- a non-matching type gets the configured penalty.

The default boost is 1.10. The default penalty is 0.90.

One point to remember later: the multiplier is applied when creating the rule-ranked candidate list, and then applied again when the final `totalScore` is calculated.

## AI candidate selection

After rule scoring, `runMatching(...)` sorts investors by `ruleScore`.

Only the top rule-ranked investors go to semantic scoring:

- if `topN` is provided, the AI candidate count is `topN * 3`, capped at 50;
- otherwise the default candidate count is 60;
- if the list is shorter than the candidate limit, the code uses the available investors.

The investors outside this candidate slice still appear later, but they do not get an AI semantic score.

## Semantic scoring context

The semantic path builds:

- startup and funding round context;
- investor context;
- feedback context, if feedback entries are available.

The default context character limit is 2500. The startup context and investor context are each cut to that limit.

Feedback context uses recent positive and negative feedback entries with reasons. The default limit is 15 down-rated entries and 15 up-rated entries.

## AI scoring settings

The current default settings are:

| Setting | Value |
| --- | --- |
| AI model | `gpt-4o-mini` |
| AI batch size | 5 |
| AI candidate count | 60 |
| AI max tokens | 1500 |
| AI failure score | 40 |

`getAIScore(...)` asks the model to return JSON with a score, an exclusion flag and an insight. If the call fails after retries, the matcher uses the AI failure score.

## Final result construction

After semantic scoring, `runMatching(...)` builds the final `MatchResult` list.

For AI-scored candidates:

- the rule scores are copied into `scoreBreakdown`;
- `semanticScore` comes from the AI result;
- `totalScore` is recalculated with the weighted total function and investor type multiplier;
- `aiInsight` is included.

For the remaining candidates:

- the rule scores are copied into `scoreBreakdown`;
- `semanticScore` is set to 0;
- `totalScore` is still calculated;
- `aiInsight` is not included.

## Exclusion cap

If the AI returns `exclusion_found`, the insight gets an `[EXCLUSION]` prefix.

The final score is capped by `exclusionCap`. The default cap is 15.

This matters for later evaluation because a high rule score can still become a low final score when the semantic layer finds a hard exclusion.

## Final sorting

The matcher sorts all results by `scoreBreakdown.totalScore` before returning them.

The result object keeps the fields the UI expects:

- `investor`;
- `scoreBreakdown`;
- `matchReasons`;
- optional `aiInsight`.

## Not changed

- I did not change matching code.
- I did not change weights.
- I did not change any AI scoring code.
