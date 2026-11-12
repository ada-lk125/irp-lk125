# Rule scoring map

Target project week: 15-21 June 2026  
Day task: start mapping the rule-based scoring logic in the baseline matcher.  
Source repository: `/Users/lk125/Undaunted-Hub`

This note continues the baseline work from 15 and 16 June. I am now looking at the rule scoring layer in `server/services/matching.ts`.

## File checked

| Source file | What I looked for |
| --- | --- |
| `server/services/matching.ts` | The rule scoring entry point and the score fields it returns. |

## First reading

The rule scoring starts in `computeRuleBasedScore(...)`.

That function calls five smaller functions:

- `computeStageMatch(...)`
- `computeTicketSizeMatch(...)`
- `computeSectorOverlap(...)`
- `computeGeographyMatch(...)`
- `computeInstrumentMatch(...)`

The result is a set of five rule scores. The AI semantic score is not part of this first rule scoring step.

## Rule score fields

The rule layer returns:

- `stageMatch`
- `ticketSizeMatch`
- `sectorOverlap`
- `geographyMatch`
- `instrumentMatch`

It also returns short match reasons. Those reasons are already filtered, so incomplete-data notes are not shown as positive match reasons.

## Stage score

`computeStageMatch(...)` compares the funding round stage with the investor's preferred stages.

What I found:

- missing stage data returns the incomplete stage score;
- stage-agnostic investors get a high score;
- compatible stages are checked through a config map;
- if there is no direct compatible stage, the code checks distance across the stage order.

The default distance scores are 100 for a direct match, 50 for one stage away, 20 for two stages away and 0 for three or more stages away.

## Ticket size score

`computeTicketSizeMatch(...)` compares the investor's minimum and maximum ticket size with the round amount and minimum ticket size.

What I found:

- missing ticket data or missing raise amount returns the incomplete ticket score;
- overlapping ranges score 100;
- tickets that are clearly too small or too large score 0;
- partial overlap is capped at 60;
- one fallback partial case returns 50.

One point to remember later: if the investor maximum ticket is missing, the code treats it as no upper limit.

## Sector score

`computeSectorOverlap(...)` compares every round sector with the investor's sector focus and sub-sector fields.

What I found:

- missing round sectors and missing investor sectors have separate fallback scores;
- direct sector matches get the strongest weight;
- partial text matches get a lower weight;
- sub-sector matches are checked when the sector match is not already direct.

The score is based on the average best match across all round sectors.

## Geography score

`computeGeographyMatch(...)` compares the round geography with the investor's regional focus.

What I found:

- missing round geography and missing investor geography have separate fallback scores;
- known regions use the configured geography compatibility map;
- unknown regions can still match directly, or through `Global` and `Worldwide`;
- a non-matching geography returns 10.

## Instrument score

`computeInstrumentMatch(...)` compares the round instruments with the investor's investment instruments.

What I found:

- missing round instruments and missing investor instruments have separate fallback scores;
- matching is case-insensitive;
- the score is the share of round instruments also listed by the investor.

This function is simpler than sector scoring. It does not do partial text matching.

## Not changed

- I did not change matching code.
- I did not change weights.
- I did not change any AI scoring code.
