# Airtable field map

Target project week: 15-21 June 2026  
Day task: map Airtable fields that feed the baseline matcher.  
Source repository: `/Users/lk125/Undaunted-Hub`

This note continues the Week 1 baseline work. I am now checking which Airtable fields become matcher inputs.

## Files checked

| Source file | What I looked for |
| --- | --- |
| `server/services/airtable.ts` | Airtable interfaces, investor parsing and field names. |
| `server/services/matching.ts` | Which parsed investor fields are used by scoring and semantic context. |

## Investor data entry point

Investor records enter through `getInvestors(...)`.

The path is:

- fetch records from `INVESTORS_TABLE`;
- parse each record with `parseInvestor(...)`;
- cache the parsed list for 30 minutes;
- pass the parsed investors into `runMatching(...)`.

## Investor fields used by rule scoring

| Parsed field | Airtable field | Used for |
| --- | --- | --- |
| `investmentStage` | `Investment Stage` | Stage match. |
| `minTicketSize` | `Minimum Ticket Size GBP` | Ticket size match. |
| `maxTicketSize` | `Maximum Ticket Size GBP` | Ticket size match. |
| `sectorFocus` | `Sector Focus` | Sector overlap. |
| `subSectors` | `Sub-Sectors` | Sector overlap fallback. |
| `regionalFocus` | `Regional Focus` | Geography match. |
| `investmentInstruments` | `Investment Instruments` | Instrument match. |
| `investorType` | `Investor Type` | Preferred investor type multiplier. |

Most list fields pass through `toArray(...)`, so a single Airtable value and an Airtable array both become a string array.

## Investor fields used by semantic context

The investor semantic context uses:

- `organisation`;
- `description`;
- `investmentThesis`;
- `sectorFocus`;
- `subSectors`;
- `hqLocation`;
- `regionalFocus`;
- `investorType`.

One thing to note later: ticket size affects rule scoring, but it is not currently included in the investor semantic context.

## Funding round fields from the submit route

The investor introduction route builds a local `fundingRound` object before calling `runMatching(...)`.

| Matcher field | Submit input field | Used for |
| --- | --- | --- |
| `startupName` | `startupName` | Context and result saving. |
| `roundStage` | `roundStage` | Stage match. |
| `amountRaising` | `amountRaising` | Ticket size match. |
| `minTicketSize` | `minTicketSize` | Ticket size match. |
| `investmentTypes` | `investmentTypes` | Instrument match. |
| `roundGeography` | `roundGeography` | Geography match and startup context. |
| `roundSectors` | `roundSectors` | Sector match and startup context. |
| `tweetPitch` | `tweetPitch` | Startup context for semantic scoring. |
| `tractionSummary` | `tractionSummary` | Startup context for semantic scoring. |
| `unfairAdvantage` | `unfairAdvantage` | Startup context for semantic scoring. |
| `preferredInvestorTypes` | `preferredInvestorTypes` | Investor type multiplier and startup context. |

`upsertFundingRound(...)` can write these main round fields into Airtable, but the current matching submit route uses local IDs and does not call that write function.

## Startup fields from the submit route

The route also builds a local `startup` object.

| Matcher field | Submit input field | Used for |
| --- | --- | --- |
| `name` | `startupName` | Startup context. |
| `description` | `description` | Startup context. |
| `climateProblem` | `climateProblem` | Startup context. |
| `solutionDescription` | `solutionDescription` | Startup context. |
| `businessModel` | `businessModel` | Startup context. |
| `targetMarket` | `targetMarket` | Startup context. |
| `competitors` | `competitors` | Startup context. |

The submit schema accepts `websiteUrl`, but this route does not copy it into the local `startup` object sent to `runMatching(...)`.

## Baseline field checklist

Fields already mapped for the baseline:

- investor rule scoring fields;
- investor semantic context fields;
- funding round rule scoring fields;
- funding round semantic context fields;
- startup semantic context fields.

Points to keep in mind later:

- `websiteUrl` is accepted by the submit schema but is not passed into the local matcher `startup` object;
- investor ticket size affects rule scoring but is not part of `buildInvestorContext(...)`;
- `upsertFundingRound(...)` exists, but the current submit route does not use it for the matching job;
- list-style Airtable fields depend on `toArray(...)`, so empty, single-value and array values need checking during data review.

These are notes for later evaluation and normalisation work. I am not proposing code changes here.

## Baseline source snapshot

I added a copy of `server/services/airtable.ts` under `reference/undaunted-baseline/server/services/airtable.ts`.

That snapshot gives the school repository the source file behind this field map without moving the whole Undaunted project into the submission repo.

## Not changed

- I did not change Airtable service code.
- I did not change matching code.
- I did not rename any fields.
