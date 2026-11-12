# Submit input map

Target project week: 15-21 June 2026  
Day task: map how submitted form fields become matcher inputs.  
Source repository: `/Users/lk125/Undaunted-Hub`

This note continues my baseline mapping work. On 15 June I mapped the main request path and score output. Today I am starting with the input side: which files define the submitted fields, and where those fields are reshaped before matching.

## Files checked

| Source file | What I looked for |
| --- | --- |
| `client/src/pages/InvestorIntroductions.tsx` | Frontend form schema and submit call. |
| `shared/routes.ts` | Shared validation schema for the submit API. |
| `server/routes.ts` | Backend construction of `fundingRound` and `startup`. |

## First note

The matcher does not receive a raw form object. The submit route parses the form, creates a job, then builds two local objects:

- `fundingRound`
- `startup`

This split matters because later experiments should reproduce the same input shape. If I build a baseline runner later, it should not accidentally use a field that the current route ignores.

## Funding round object

The route creates a local `fundingRound` object before matching. These are the fields I found:

| Matcher input field | Source submitted field |
| --- | --- |
| `id` | Generated local id. |
| `startupId` | Generated local id. |
| `startupName` | `input.startupName` |
| `roundStage` | `input.roundStage` |
| `amountRaising` | `input.amountRaising` |
| `minTicketSize` | `input.minTicketSize` |
| `investmentTypes` | `input.investmentTypes` |
| `roundGeography` | `input.roundGeography` |
| `roundSectors` | `input.roundSectors` |
| `tweetPitch` | `input.tweetPitch` |
| `tractionSummary` | `input.tractionSummary` |
| `unfairAdvantage` | `input.unfairAdvantage` |
| `preferredInvestorTypes` | `input.preferredInvestorTypes` |

This is the part of the input that feeds most of the rule scoring. The startup context is separate, so I will map that next instead of mixing both objects together.

## Startup object

The route also creates a `startup` object for the context used by the matcher:

| Matcher input field | Source submitted field |
| --- | --- |
| `id` | Generated local id. |
| `name` | `input.startupName` |
| `description` | `input.description` |
| `climateProblem` | `input.climateProblem` |
| `solutionDescription` | `input.solutionDescription` |
| `businessModel` | `input.businessModel` |
| `targetMarket` | `input.targetMarket` |
| `competitors` | `input.competitors` |

Two submitted fields need a note. `startupId` is used when match results are saved, but it is not passed into `runMatching(...)` as part of the startup context. `websiteUrl` is accepted by the form and shared API schema, but the current route does not copy it into the local `startup` object.

## Not changed

- I did not change the form.
- I did not change the route.
- I did not change matching logic.
- I did not copy source files from `Undaunted-Hub` into this repository.
