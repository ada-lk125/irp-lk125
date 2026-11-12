# Week 2 baseline export plan

Date: 2026-06-22  
Source repository: `/Users/lk125/Undaunted-Hub`

## Why I am doing this

Week 1 gave me a map of the current baseline matching path. I now need a way to run that baseline and keep the result in a format that can be checked later.

The aim is not to improve the ranking yet. The aim is to make the existing ranking easier to repeat, inspect and compare.

## Starting point

The current matcher already returns the main information I need:

- investor details;
- score breakdown;
- match reasons;
- AI insight when the investor was sent through the semantic layer.

The missing part is a structured export around that result. If the output is consistent, Chuan can use it for labelling and I can use it for later algorithm comparisons.

## Early scope

The first export plan should cover:

- what input identifies a baseline run;
- which startup and funding round fields should be saved;
- which investor fields should be saved;
- which score and explanation fields should be kept for evaluation.

I am keeping this as design work first. Code changes should follow the field list, not the other way round.

## Fields to carry forward

The first useful export should keep the submitted input fields that become the local `fundingRound` and `startup` objects:

- `startupName`
- `description`
- `climateProblem`
- `solutionDescription`
- `businessModel`
- `targetMarket`
- `competitors`
- `roundStage`
- `amountRaising`
- `minTicketSize`
- `investmentTypes`
- `roundGeography`
- `roundSectors`
- `tweetPitch`
- `tractionSummary`
- `unfairAdvantage`
- `preferredInvestorTypes`

For each ranked investor, I need the identity fields, the score fields and the explanation fields:

- `investor.id`
- `investor.organisation`
- `investor.investorType`
- `investor.investmentStage`
- `investor.sectorFocus`
- `investor.subSectors`
- `investor.regionalFocus`
- `investor.minTicketSize`
- `investor.maxTicketSize`
- `investor.investmentInstruments`
- `scoreBreakdown.stageMatch`
- `scoreBreakdown.ticketSizeMatch`
- `scoreBreakdown.sectorOverlap`
- `scoreBreakdown.geographyMatch`
- `scoreBreakdown.instrumentMatch`
- `scoreBreakdown.semanticScore`
- `scoreBreakdown.totalScore`
- `matchReasons`
- `aiInsight`

The export also needs run metadata. At minimum, I want to record `runId`, `createdAt`, the source input, the AI model name, `aiCandidateCount` and the score weights. Without that, a later comparison would not show which baseline settings produced the output.

## Output storage boundary

I will start with JSON because the matcher result already has nested fields. Flattening too early would make the first export harder to check.

Generated outputs should not be committed by default. The repository should keep:

- the source code used to create the export;
- the field documentation;
- small fake examples if I need to show the shape.

It should not keep full real Airtable exports or large generated result files. I added a `.gitignore` so local `exports/`, `outputs/`, `.env` files and local JSON/CSV runs stay out of the school repository.

## Files I expect to use

- `server/services/matching.ts`
- `server/routes.ts`
- `server/storage.ts`
- `server/services/airtable.ts`
- `shared/routes.ts`
- `shared/schema.ts`

The school repository keeps source snapshots under `reference/undaunted-baseline/`. New experiment code will be separated from those snapshots when it is added.

## Next implementation step

The first code step should be a small script in the Undaunted repository:

`server/scripts/export-baseline-matches.ts`

The script should:

1. Read one input JSON file.
2. Build the same local `fundingRound` and `startup` objects as the submit route.
3. Run the existing matcher.
4. Write one JSON export file to a local ignored output folder.

When that script is ready, I should copy it into the school repository as a source snapshot under:

`reference/undaunted-baseline/server/scripts/export-baseline-matches.ts`

If I add my own experiment wrapper later, it should live outside `reference/undaunted-baseline/`, because that folder is for copied baseline source.
