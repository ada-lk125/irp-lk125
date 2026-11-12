# Week 1 baseline definition

Target project week: 15-21 June 2026  
Day task: close the Week 1 baseline mapping work.  
Source repository: `/Users/lk125/Undaunted-Hub`

This note pulls together the baseline reading from 15-20 June. It is a checkpoint for later experiment work, not a code change.

## Baseline scope

For this IRP, the baseline is the existing investor introduction matching path before any algorithm changes.

It starts when the founder submits the investor introduction form. It ends when the app returns a ranked investor list with score breakdowns and optional AI insight.

The baseline includes:

- submit form fields and API validation;
- local `fundingRound` and `startup` objects;
- Airtable investor parsing;
- rule-based scoring;
- preferred investor type multiplier;
- AI candidate selection and semantic scoring;
- final total score sorting;
- saved match results;
- feedback reuse in later semantic scoring.

## Files covered this week

| Area | Main files checked |
| --- | --- |
| Form and UI result display | `client/src/pages/InvestorIntroductions.tsx` |
| API schemas | `shared/routes.ts` |
| Submit route and feedback route | `server/routes.ts` |
| Airtable investor parsing | `server/services/airtable.ts` |
| Matching algorithm | `server/services/matching.ts` |
| Default matching config and storage | `server/storage.ts` |
| Result and feedback tables | `shared/schema.ts` |

## Current baseline notes

| Date | Note | What it covers |
| --- | --- | --- |
| 2026-06-15 | `docs/baseline-file-map.md` | First file map and request path. |
| 2026-06-16 | `docs/submit-input-map.md` | Submit input mapping into matcher objects. |
| 2026-06-17 | `docs/rule-scoring-map.md` | Five rule scoring functions. |
| 2026-06-18 | `docs/ranking-flow-map.md` | Weighted total, AI candidate path and final sorting. |
| 2026-06-19 | `docs/airtable-field-map.md` | Airtable and submit fields used by the matcher. |
| 2026-06-20 | `docs/result-feedback-map.md` | Saved outputs and feedback reuse. |

## Fields needed for later comparison runs

Next week needs a repeatable output shape. Based on the baseline reading, each run should keep enough information to compare ranked lists without opening the UI.

Input identifiers:

- run id or timestamp;
- user id if available;
- startup id if available;
- funding round id or local run id;
- startup name;
- round stage.

Investor identifiers:

- investor Airtable id;
- organisation name;
- investor type;
- investment stage;
- sector focus;
- regional focus.

Scores and ranking:

- rank position;
- `stageMatch`;
- `ticketSizeMatch`;
- `sectorOverlap`;
- `geographyMatch`;
- `instrumentMatch`;
- `semanticScore`;
- `totalScore`;
- whether the investor was AI-scored or only rule-scored.

Explanations and feedback:

- `matchReasons`;
- `aiInsight`;
- exclusion flag if the AI insight uses `[EXCLUSION]`;
- feedback rating, if available;
- feedback reason, if available.

These fields should be enough to compare a baseline run against later algorithm variants.

## Week 1 gaps and assumptions

Gaps to remember before building a repeatable export:

- the current submit route uses local ids for the matching run;
- saved match results are replaced for the same user and startup;
- feedback is loaded globally through `getAllMatchFeedback()`;
- only feedback with a written `reason` is reused in semantic scoring;
- `websiteUrl` is accepted by the submit schema but is not passed into the local matcher startup object;
- investor ticket size affects rule scoring but is not part of the current investor semantic context;
- candidates outside the AI candidate slice keep `semanticScore` at 0.

Baseline assumptions for next week:

- keep the existing UI result shape stable;
- treat the 15-21 June notes as the baseline definition;
- export enough fields to compare ranked lists without manually copying from the UI;
- avoid changing weights until the baseline output can be reproduced and inspected.

## Not changed

- I did not change matching code.
- I did not change weights.
- I did not change the data schema.
