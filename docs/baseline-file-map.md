# Baseline matching file map

Target project week: 15-21 June 2026  
Day 1 task: begin mapping the current Undaunted investor matching baseline.  
Source repository: `/Users/lk125/Undaunted-Hub`

This note starts my 15 June 2026 baseline mapping work in the school repository.

## Why this matters

The project improves an existing ClimateTech startup-investor matching tool. Before I change the ranking logic, I need to map the files that define the current baseline.

No matching logic has been changed.

## Repository boundary

The working system is in:

`/Users/lk125/Undaunted-Hub`

This school repository will not mirror the whole web app during week 1. For now it records my own reading notes and later experiment work.

## Files identified

| Source file in `Undaunted-Hub` | Why I am reading it |
| --- | --- |
| `client/src/pages/InvestorIntroductions.tsx` | Frontend form and result display. |
| `server/routes.ts` | Backend route that starts the matching job. |
| `server/services/airtable.ts` | Airtable field parsing. |
| `server/services/matching.ts` | Current matching algorithm. |
| `server/storage.ts` | Default config and feedback access. |

## First observation

The baseline seems to run through `runMatching(...)` in `server/services/matching.ts`. Next I need to map how the frontend submission reaches that function.

## Request path

I checked the submit flow next. The frontend calls:

`POST /api/investor-introductions/submit`

The backend route then:

1. Parses the submitted form.
2. Creates a matching job.
3. Loads investors from Airtable through `getInvestors()`.
4. Loads previous match feedback.
5. Loads the current matching config.
6. Builds local `fundingRound` and `startup` objects from the form fields.
7. Calls `runMatching(...)`.
8. Saves the completed match results.

The frontend tracks the job through the progress endpoint and then fetches the result endpoint. This means the baseline map needs to cover both the algorithm file and the route code that prepares its inputs.

## Score fields

I also checked the first scoring surface in `server/services/matching.ts`.

The result object contains:

- `investor`
- `scoreBreakdown`
- `matchReasons`
- `aiInsight`

The score breakdown fields are:

- `stageMatch`
- `ticketSizeMatch`
- `sectorOverlap`
- `geographyMatch`
- `instrumentMatch`
- `semanticScore`
- `totalScore`

The default weighting is 20% stage, 15% ticket size, 20% sector overlap, 10% geography, 5% instruments and 30% semantic score. The UI score popup uses the same split, so this is part of the baseline I need to preserve during early experiments.

## Not changed

- I did not change scoring code.
- I did not change the default weights or AI settings.
- I did not import the Undaunted app into this repository.
- I did not use `logbook/logbook.md`, because that file is for meetings.
