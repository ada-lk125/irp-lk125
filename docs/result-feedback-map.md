# Result and feedback map

Target project week: 15-21 June 2026  
Day task: map saved match outputs and feedback inputs in the baseline system.  
Source repository: `/Users/lk125/Undaunted-Hub`

This note continues the Week 1 baseline work. I am now checking what the system keeps after a matching run finishes.

## Files checked

| Source file | What I looked for |
| --- | --- |
| `server/routes.ts` | Where match results are saved after the background job finishes. |
| `server/storage.ts` | Storage methods for saved match results. |
| `shared/schema.ts` | Database fields for saved match results. |

## Result saving entry point

The submit route calls `runMatching(...)` and then saves the output with:

`storage.saveMatchResults(userId, submittedStartupId, localId, input, matches)`

The save happens after matching has finished. If saving fails, the route logs the error but still lets the matching job complete.

## Saved result fields

`saveMatchResults(...)` writes to `match_results`.

| Stored field | Source |
| --- | --- |
| `userId` | Current authenticated user. |
| `startupId` | Submitted startup id, or `null`. |
| `fundingRoundAirtableId` | Local funding round id for this submit run. |
| `formValues` | Original submit input. |
| `matches` | Full match result array returned by `runMatching(...)`. |

Before writing the new row, older saved results for the same user and startup are deleted. If no startup id is present, older saved results for that user are deleted.

## Fields preserved inside matches

The `matches` JSON keeps:

- `investor`;
- `scoreBreakdown`;
- `matchReasons`;
- optional `aiInsight`.

This matters for later comparison runs because the saved row keeps the original form values and the ranked output together.

## Feedback submission

Feedback is submitted through `/api/investor-introductions/feedback`.

The input includes:

- `investorAirtableId`;
- optional `investorName`;
- `fundingRoundAirtableId`;
- optional `startupName`;
- optional `startupId`;
- `rating`, either `up` or `down`;
- optional `reason`;
- optional `totalScore`.

The route sends this input to `storage.upsertMatchFeedback(...)`.

## Feedback storage behaviour

`upsertMatchFeedback(...)` checks whether feedback already exists for the same investor and funding round.

If it finds an existing row, it updates:

- `rating`;
- `reason`;
- `totalScore`.

If it does not find one, it inserts a new row.

## Feedback reused by matching

At the start of a new matching job, the submit route loads all feedback with `getAllMatchFeedback()`.

Only feedback entries with a `reason` are passed into `runMatching(...)`.

`buildFeedbackContext(...)` then separates:

- down-rated feedback as negative examples;
- up-rated feedback as positive examples.

The default limit is 15 examples from each side. The resulting text is appended to the AI system prompt before semantic scoring.

## Baseline output and feedback checklist

Outputs already mapped:

- background matching job result;
- latest saved match result;
- saved `formValues`;
- saved `matches` JSON;
- feedback submission;
- feedback reuse in semantic scoring.

Points to keep in mind later:

- saved match results are replaced for the same user and startup, so old runs are not kept as a full experiment history;
- `matches` is saved as JSON, which is useful for inspection but not yet a structured experiment export;
- feedback is reused globally through `getAllMatchFeedback()`, not filtered to only the current startup;
- only feedback with a written `reason` is passed into semantic scoring.

These notes help define what extra export structure may be needed in the next project week.

## Baseline source snapshot

I added a copy of `server/storage.ts` under `reference/undaunted-baseline/server/storage.ts`.

That snapshot gives the school repository the storage code behind result saving and feedback reuse without copying the whole Undaunted project.

## Not changed

- I did not change route code.
- I did not change storage code.
- I did not change the schema.
