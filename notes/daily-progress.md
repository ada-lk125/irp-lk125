# Daily progress notes

This file records individual IRP working progress. Meeting notes remain in `logbook/logbook.md`; this file is for day-to-day project work, reading notes and implementation progress.

## 2026-06-15: start baseline file map

This is the first progress entry for 15 June 2026. I am starting with the baseline files only.

Focus:

- Start the week 1 baseline mapping task.
- Identify the files that define the current investor matching workflow.
- Keep `logbook/logbook.md` for meetings only.

Work completed:

- Opened the `Undaunted-Hub` source tree.
- Identified the first five files to read:
  - `client/src/pages/InvestorIntroductions.tsx`
  - `server/routes.ts`
  - `server/services/airtable.ts`
  - `server/services/matching.ts`
  - `server/storage.ts`
- Checked the first request path from the frontend submit handler to the backend route.
- Noted that `server/routes.ts` builds the `fundingRound` and `startup` objects before calling `runMatching(...)`.
- Checked the first score fields returned by `runMatching(...)`.
- Noted that the UI uses `scoreBreakdown`, `matchReasons` and `aiInsight`.

Notes:

- No scoring code was changed.
- No Undaunted source files were copied into the school repository today.
- The baseline map now has the file list, request path and first score output notes.

Next:

- For the next working day, map the submitted form fields into the `fundingRound` and `startup` objects more carefully.

## 2026-06-16: start submit input map

Today I started tracing the submitted form fields into the matcher inputs. I am keeping this separate from the 15 June baseline file map so the notes do not turn into one oversized document.

Focus:

- Check where the investor introduction form fields are defined.
- Compare the frontend form schema with the shared submit API schema.
- Start mapping where the backend route creates `fundingRound` and `startup`.

Work completed:

- Read the submit form schema in `client/src/pages/InvestorIntroductions.tsx`.
- Read the matching submit schema in `shared/routes.ts`.
- Rechecked the submit route in `server/routes.ts`.
- Started a separate input mapping note in `docs/submit-input-map.md`.
- Added the first `fundingRound` field mapping from submitted values to matcher input fields.
- Added the `startup` field mapping used as matcher context.
- Noted that `startupId` is used for saved results, while `websiteUrl` is accepted by the form but not copied into the local matcher input in this route.

Notes:

- No code was changed.
- No source files were copied into this repository today.
- The input map now covers the two local objects passed into `runMatching(...)`.

## 2026-06-17: start rule scoring map

Today I started reading the rule scoring section in `server/services/matching.ts`.

Focus:

- Find the rule scoring entry point.
- List the scoring functions before looking at each one in detail.
- Keep this separate from the semantic scoring step.

Work completed:

- Read `computeRuleBasedScore(...)`.
- Identified the five rule scoring functions it calls.
- Started a separate rule scoring note in `docs/rule-scoring-map.md`.

Notes:

- No matching code was changed.
- No weights were changed.
- The next step is to map the stage and ticket size scoring functions.

## 2026-06-17: stage and ticket size scoring notes

I continued the rule scoring map by reading the first two scoring functions in more detail.

Focus:

- Understand how the baseline handles round stage fit.
- Understand how the baseline handles investor ticket size fit.
- Keep the notes limited to the current scoring behaviour.

Work completed:

- Read `computeStageMatch(...)` and noted the fallback path for missing or unknown stage data.
- Checked the stage distance scores in the default matching config.
- Read `computeTicketSizeMatch(...)` and noted the overlap, hard exclusion and partial overlap paths.
- Added these notes to `docs/rule-scoring-map.md`.

Notes:

- No matching code was changed.
- The next step is to map sector, geography and instrument scoring.

## 2026-06-17: sector, geography and instrument notes

I finished reading the remaining rule scoring functions for the current baseline.

Focus:

- Map how sector overlap is calculated.
- Check how geography compatibility is handled.
- Check how investment instrument matching is scored.

Work completed:

- Read `computeSectorOverlap(...)` and noted the direct, partial and sub-sector matching paths.
- Read `computeGeographyMatch(...)` and noted the configured region compatibility map.
- Read `computeInstrumentMatch(...)` and noted that it uses exact case-insensitive overlap.
- Added the findings to `docs/rule-scoring-map.md`.

Notes:

- No scoring code was changed.
- No semantic scoring code was changed.
- The rule scoring map now covers all five rule scoring fields used before semantic scoring.

## 2026-06-17: documentation index update

I added the rule scoring note to the repository overview so the Week 1 reading work is easier to follow from the front page.

Focus:

- Keep daily notes separate from meeting notes.
- Make the baseline, input mapping and rule scoring notes easy to find.
- Leave the actual matching code unchanged.

Work completed:

- Updated `README.md` with the current Week 1 notes.
- Checked that `docs/rule-scoring-map.md` is listed with the other baseline mapping documents.

Notes:

- No code was changed.
- This closes today's documentation pass for the rule scoring baseline.

## 2026-06-18: start ranking flow map

Today I started reading the part of the matcher that runs after the rule scores are calculated.

Focus:

- Check how score fields are combined into a weighted total.
- Check where preferred investor type affects ranking.
- Keep this separate from the AI candidate and final sorting path for now.

Work completed:

- Read `computeWeightedTotal(...)`.
- Checked the default score weights in `server/storage.ts`.
- Read the preferred investor type multiplier logic in `runMatching(...)`.
- Started `docs/ranking-flow-map.md`.

Notes:

- No matching code was changed.
- No weights were changed.
- The next step is to map AI candidate selection and semantic scoring.

## 2026-06-18: AI candidate path notes

I continued the ranking flow map by reading how candidates enter the semantic scoring step.

Focus:

- Check how the matcher chooses AI candidates.
- Check which text fields are sent into semantic scoring.
- Record the default AI settings without changing them.

Work completed:

- Read the rule-ranked candidate slice in `runMatching(...)`.
- Checked the default AI candidate count, batch size, model name and failure score.
- Read `buildStartupContext(...)`, `buildInvestorContext(...)` and `buildFeedbackContext(...)`.
- Added the semantic scoring path notes to `docs/ranking-flow-map.md`.

Notes:

- No semantic scoring code was changed.
- The next step is to map final result construction, exclusion caps and sorting.

## 2026-06-18: final result flow notes

I finished the main ranking flow map by reading how final match results are assembled.

Focus:

- Check how AI-scored candidates and remaining candidates differ.
- Check how the exclusion cap changes the final score.
- Check which result fields are returned to the UI.

Work completed:

- Read the `MatchResult` construction for AI candidates.
- Read the result construction for remaining candidates.
- Checked the default exclusion cap.
- Confirmed that final results are sorted by `scoreBreakdown.totalScore`.
- Added these notes to `docs/ranking-flow-map.md`.

Notes:

- No matching code was changed.
- The ranking flow map now covers weighted score calculation, AI candidate selection and final result sorting.

## 2026-06-18: ranking flow index update

I added the ranking flow note to the repository overview so today's work is visible from the front page.

Focus:

- Keep the Week 1 baseline notes easy to find.
- Make clear that ranking flow work is separate from meeting notes.
- Leave the matcher implementation unchanged.

Work completed:

- Updated `README.md` with `docs/ranking-flow-map.md`.
- Checked that the 18 June note follows the existing 15-17 June baseline notes.

Notes:

- No code was changed.
- This closes today's four-part documentation pass for the baseline ranking flow.

## 2026-06-19: start Airtable field map

Today I started reading the Airtable service file to map which external fields enter the matcher.

Focus:

- Find the investor parsing entry point.
- Map the investor fields used by rule scoring.
- Check which investor fields are included in semantic context.

Work completed:

- Read `getInvestors(...)` and `parseInvestor(...)` in `server/services/airtable.ts`.
- Compared parsed investor fields with the scoring functions in `server/services/matching.ts`.
- Started `docs/airtable-field-map.md`.

Notes:

- No Airtable service code was changed.
- No matching code was changed.
- The next step is to map funding round and startup fields.

## 2026-06-19: funding round and startup fields

I continued the Airtable field map by checking the submit route objects that are passed into `runMatching(...)`.

Focus:

- Map funding round fields used by rule scoring and semantic context.
- Map startup fields used by semantic context.
- Check whether the route writes the submitted round back to Airtable.

Work completed:

- Read the matching submit schema in `shared/routes.ts`.
- Rechecked the form fields in `client/src/pages/InvestorIntroductions.tsx`.
- Read the local `fundingRound` and `startup` objects built in `server/routes.ts`.
- Compared those fields with `upsertFundingRound(...)` in `server/services/airtable.ts`.
- Added these notes to `docs/airtable-field-map.md`.

Notes:

- No route code was changed.
- The current submit route uses local IDs for matching and does not call `upsertFundingRound(...)`.

## 2026-06-19: field checklist and baseline snapshot

I turned the field map into a short checklist so the baseline inputs are easier to review later.

Focus:

- List the baseline field groups already mapped.
- Record field gaps that may matter during evaluation.
- Add the Airtable service source snapshot to the school repository.

Work completed:

- Added a baseline field checklist to `docs/airtable-field-map.md`.
- Noted that `websiteUrl` is accepted but not passed into the local matcher `startup` object.
- Noted that investor ticket size is used by rule scoring but not by investor semantic context.
- Copied `server/services/airtable.ts` into `reference/undaunted-baseline/server/services/airtable.ts`.

Notes:

- No Undaunted source code was changed.
- The copied Airtable service file is a baseline reference snapshot for the school repository.

## 2026-06-19: Airtable field map index update

I added the Airtable field map to the repository overview so today's baseline field work is easy to find.

Focus:

- Keep the Week 1 notes listed in order.
- Make the copied baseline source snapshots visible from the README.
- Keep meeting notes separate from daily work notes.

Work completed:

- Updated `README.md` with `docs/airtable-field-map.md`.
- Added the current baseline source snapshot list to `README.md`.
- Checked that the new source snapshot matches today's Airtable field map work.

Notes:

- No code was changed.
- This closes today's four-part documentation pass for Airtable field mapping.

## 2026-06-20: start result and feedback map

Today I started reading how the baseline stores matching outputs after a run finishes.

Focus:

- Find where the submit route saves match results.
- Check which fields are stored in `match_results`.
- Keep feedback handling separate for the next note.

Work completed:

- Read the result saving call in `server/routes.ts`.
- Read `saveMatchResults(...)` in `server/storage.ts`.
- Checked the `match_results` schema in `shared/schema.ts`.
- Started `docs/result-feedback-map.md`.

Notes:

- No route code was changed.
- No storage code was changed.
- The next step is to map feedback submission and reuse.

## 2026-06-20: feedback loop notes

I continued the result and feedback map by reading how feedback is stored and reused.

Focus:

- Check the feedback endpoint input.
- Check how duplicate feedback is handled.
- Check how feedback enters semantic scoring.

Work completed:

- Read `/api/investor-introductions/feedback` in `server/routes.ts`.
- Read `upsertMatchFeedback(...)` in `server/storage.ts`.
- Checked the `match_feedback` schema in `shared/schema.ts`.
- Rechecked `buildFeedbackContext(...)` in `server/services/matching.ts`.
- Added feedback loop notes to `docs/result-feedback-map.md`.

Notes:

- No route code was changed.
- Feedback with a written reason is reused in the AI system prompt on later matching runs.

## 2026-06-20: output checklist and storage snapshot

I turned the result and feedback map into a short checklist for later experiment planning.

Focus:

- List the baseline outputs already mapped.
- Record output gaps that matter for repeatable comparisons.
- Add the storage source snapshot to the school repository.

Work completed:

- Added a baseline output and feedback checklist to `docs/result-feedback-map.md`.
- Noted that saved match results are replaced rather than kept as a full run history.
- Noted that feedback is reused globally through `getAllMatchFeedback()`.
- Copied `server/storage.ts` into `reference/undaunted-baseline/server/storage.ts`.

Notes:

- No Undaunted source code was changed.
- The copied storage file is a baseline reference snapshot for result saving and feedback reuse.

## 2026-06-20: result and feedback index update

I added the result and feedback map to the repository overview so today's baseline output work is easy to find.

Focus:

- Keep the Week 1 notes listed in order.
- Make the new storage snapshot visible from the README.
- Keep daily work notes separate from meeting notes.

Work completed:

- Updated `README.md` with `docs/result-feedback-map.md`.
- Added `reference/undaunted-baseline/server/storage.ts` to the baseline source snapshot list.
- Checked that the result and feedback note follows the 15-19 June baseline notes.

Notes:

- No code was changed.
- This closes today's four-part documentation pass for result saving and feedback reuse.

## 2026-06-21: start Week 1 baseline definition

Today I started closing the Week 1 baseline mapping work.

Focus:

- Define what I mean by the current matching baseline.
- List the main files covered during 15-20 June.
- Keep this as a checkpoint note before next week's export work.

Work completed:

- Reviewed the Week 1 baseline notes from 15-20 June.
- Started `docs/week-one-baseline-definition.md`.
- Listed the files that define the current submit, scoring, ranking, result saving and feedback path.

Notes:

- No matching code was changed.
- The next step is to list the fields needed for later comparison runs.

## 2026-06-21: comparison field list

I continued the Week 1 baseline definition by listing the fields that should be kept for later comparison runs.

Focus:

- Identify the minimum fields needed to compare ranked outputs.
- Include both score fields and explanation fields.
- Keep the list separate from implementation work.

Work completed:

- Added input identifiers, investor identifiers, score fields and feedback fields to `docs/week-one-baseline-definition.md`.
- Checked the list against the ranking flow and result feedback notes.
- Noted whether an investor was AI-scored or only rule-scored as a field to keep later.

Notes:

- No export code was written today.
- The next step is to record Week 1 gaps and assumptions before closing the week.

## 2026-06-21: Week 1 gaps and assumptions

I added the main baseline gaps and assumptions that came out of this week's reading.

Focus:

- Record known boundaries before next week's export work.
- Keep the note factual rather than proposing code changes.
- Link the assumptions back to the baseline notes from 15-20 June.

Work completed:

- Added local id, saved result replacement and global feedback notes.
- Added field notes for `websiteUrl`, ticket size and non-AI-scored candidates.
- Added assumptions for keeping the UI result shape stable and delaying weight changes.

Notes:

- No matching code was changed.
- These are baseline assumptions for next week's repeatable output work.

## 2026-06-21: Week 1 baseline index update

I added the Week 1 baseline definition note to the repository overview.

Focus:

- Close the first week of baseline mapping.
- Make the checkpoint note easy to find from the README.
- Keep the next step clear: build a repeatable output/export next week.

Work completed:

- Updated `README.md` with `docs/week-one-baseline-definition.md`.
- Checked that the Week 1 notes now cover 15-21 June.
- Confirmed that the source snapshots listed in the README support the baseline notes.

Notes:

- No code was changed.
- Week 1 baseline mapping is ready to support next week's repeatable output work.

## 2026-06-22: start baseline export planning

I started Week 2 by turning the Week 1 baseline map into an export plan.

Focus:

- Keep the current matcher unchanged.
- Define what a repeatable baseline run needs to record.
- Separate source snapshots from new experiment work in the school repository.

Work completed:

- Added `docs/week-two-baseline-export-plan.md`.
- Started the matching export plan from the existing route, matcher, storage and Airtable files.
- Confirmed that source snapshots should stay under `reference/undaunted-baseline/`.

Notes:

- No scoring code was changed.
- The next step is to refine the output field list before writing export code.

## 2026-06-22: baseline export field list

I refined the export plan by listing the first fields that should travel from the baseline run into an experiment output.

Focus:

- Use the existing submit schema as the input field source.
- Keep investor identity fields close to the score fields.
- Record enough run metadata to make two exports comparable later.

Work completed:

- Added startup, funding round, investor, score and explanation fields to `docs/week-two-baseline-export-plan.md`.
- Checked the list against `shared/routes.ts` and `server/services/matching.ts`.
- Added `runId`, timestamp, AI settings and score weights to the planned metadata.

Notes:

- No export script was written yet.
- The next step is to decide the storage format and the place where generated outputs should live locally.

## 2026-06-22: export output boundary

I added the first boundary for baseline export outputs.

Focus:

- Keep generated run outputs out of git by default.
- Use JSON first because the matching result has nested score and explanation fields.
- Leave room for a later CSV version if Chuan needs spreadsheet review.

Work completed:

- Added local output ignore rules in `.gitignore`.
- Updated `docs/week-two-baseline-export-plan.md` with the export storage boundary.
- Noted that any committed sample should be small and anonymised.

Notes:

- This is still planning and repository hygiene work.
- No real Airtable export or generated match output was committed.

## 2026-06-22: README index update

I updated the repository overview so the Week 2 export work is visible from the README.

Focus:

- Make the new baseline export plan easy to find.
- Bring the baseline snapshot list up to date.
- Keep the school repository structure clear before adding experiment code.

Work completed:

- Added `docs/week-two-baseline-export-plan.md` to the README.
- Listed the runtime config, shared helper and schema snapshot files already copied from Undaunted.
- Kept the note separate from `logbook.md`, which is only for meetings.

Notes:

- No generated export output was added.
- The next step is to turn the plan into a small implementation path.

## 2026-06-22: implementation path for export runner

I closed today's planning work by writing the first implementation path for the baseline export runner.

Focus:

- Keep the first code change small.
- Put the Undaunted script outside the production request path.
- Keep copied baseline source separate from any later experiment wrapper in the school repository.

Work completed:

- Planned `server/scripts/export-baseline-matches.ts` as the next Undaunted code file.
- Listed the first script behaviour: read input JSON, build matcher input objects, run the existing matcher and write JSON output.
- Recorded where the script snapshot should go in `irp-lk125` after it exists.

Notes:

- I did not write the export script today.
- No matching score, weight or AI prompt was changed.

## 2026-06-23: export runner skeleton

I started the baseline export runner in the Undaunted repository.

Focus:

- Keep the first code change outside the production request path.
- Reuse the existing matcher instead of copying scoring logic.
- Avoid the database-backed storage layer for the first script shape.

Work completed:

- Added `server/scripts/export-baseline-matches.ts` in Undaunted.
- Built the same local `fundingRound` and `startup` objects used by the submit route.
- Planned the first JSON output with run metadata, input objects, progress events and matches.

Notes:

- No scoring rule, weight or AI prompt was changed.
- I have not copied this script into the school repository yet; I will do that as a separate source snapshot once the first shape is reviewed.

## 2026-06-23: export runner code snapshot and sample input

I added the first export runner code snapshot to the school repository, then added a fake sample input shape in both repositories.

Focus:

- Make code progress visible in `irp-lk125`, not only in the supervisor repository.
- Keep original baseline files and changed progress files in different folders.
- Show the script input shape without using real Airtable data.
- Keep generated export outputs ignored.
- Record that the runner still needs Airtable and OpenAI access when it actually runs.

Work completed:

- Copied the current runner code to `reference/undaunted-progress/server/scripts/export-baseline-matches.ts`.
- Copied the new config helper to `reference/undaunted-progress/server/services/matching-config.ts`.
- Added `docs/export-runner-notes.md`.
- Added `docs/samples/baseline-export-input.sample.json`.
- Updated the README so the export runner notes are easy to find.
- Added matching Undaunted notes under `docs/irp/2026-06-23-export-runner-notes.md`.

Notes:

- `reference/undaunted-baseline/` remains the original source snapshot area.
- `reference/undaunted-progress/` is for changed code snapshots that should evolve through commits.
- The sample is fictional and safe to commit.
- The runner still needs real Airtable and OpenAI access to produce a full match export.

## 2026-06-23: export row shape

I refined the export runner so the output is closer to an evaluation table.

Focus:

- Validate the required input fields before running the matcher.
- Export smaller match rows instead of the full matcher object.
- Keep rank, score fields, AI status and explanation fields together.
- Keep the code progress snapshot in `irp-lk125` up to date.

Work completed:

- Added input validation for `startupName`, `description` and `roundStage`.
- Added ranked export rows with investor fields, scores, reasons and AI flags.
- Updated the progress snapshot under `reference/undaunted-progress/`.

Notes:

- The production submit route was not changed.
- This still does not change the scoring algorithm.
- I did not commit generated export output.

## 2026-06-23: dry-run path

I added a dry-run path to the export runner so I can check the input shape without using Airtable or OpenAI.

Focus:

- Make the script easier to test locally.
- Keep the live matcher path unchanged.
- Update the school repository code snapshot after the Undaunted code changed.

Work completed:

- Added the `--dry-run` flag to `server/scripts/export-baseline-matches.ts`.
- Made dry-run exports write run metadata and input objects while leaving `matches` empty.
- Updated the `reference/undaunted-progress/` script snapshot after the code change.

Notes:

- Dry-run output is written under ignored local output paths.
- No generated export output was committed.

## 2026-06-23: named export command

I added a named package command for the baseline export runner.

Focus:

- Make the runner easier to call during later experiments.
- Keep the command visible in the IRP progress snapshot.
- Avoid changing the production app path.

Work completed:

- Added `irp:export-baseline` to the Undaunted `package.json` scripts.
- Updated the export runner notes to use the package command.
- Copied the updated package file into `reference/undaunted-progress/package.json`.

Notes:

- This only changes the developer command for the script.
- It does not change matching behaviour.

## 2026-06-23: end-of-day runner status

I closed the day by recording what the export runner can and cannot do yet.

Focus:

- Keep the final note factual.
- Make the next day easy to continue.
- Keep the IRP README aligned with the code snapshots now in the repository.

Work completed:

- Added the package snapshot to the README progress source list.
- Updated `docs/export-runner-notes.md` with the end-of-day runner status.
- Confirmed that the next step is a live baseline sample, not an algorithm change.

Notes:

- No generated export output was committed.
- The runner is ready for a first live sample once the required Airtable and OpenAI access is available.

## 2026-06-24: export shape helper

I started today by separating the export shape logic from the runner script.

Focus:

- Keep the command-line script small.
- Move input validation and row shaping into a reusable helper.
- Keep the IRP code snapshot aligned with the Undaunted code change.

Work completed:

- Added `server/services/baseline-export.ts` in Undaunted.
- Updated `server/scripts/export-baseline-matches.ts` to use the helper.
- Copied both files into `reference/undaunted-progress/`.
- Added `docs/irp/2026-06-24-export-shape-helper.md` in Undaunted and updated the local IRP notes.

Notes:

- No scoring rule, weight or AI prompt was changed.
- The next step is to test this helper path with the existing fake sample input.

## 2026-06-24: export shape check

I added a local check for the JSON produced by the baseline export runner.

Focus:

- Check the exported structure before using live baseline results.
- Keep the checker independent from Airtable and OpenAI.
- Copy the code progress into the IRP repository, not only the written notes.

Work completed:

- Added `server/scripts/check-baseline-export-shape.ts` in Undaunted.
- Added the `irp:check-export-shape` package command.
- Copied the checker and updated package snapshot into `reference/undaunted-progress/`.
- Updated the export runner notes with the new check command.

Notes:

- The checker only validates the output sections and row shape.
- No scoring rule, weight or AI prompt was changed.

## 2026-06-24: local check summary

I extended the export shape check so it can write a short local summary after a successful check.

Focus:

- Keep a compact run summary for later baseline comparison work.
- Avoid committing generated export results.
- Keep the IRP code snapshot aligned with the Undaunted script.

Work completed:

- Added an optional `--summary` flag to `server/scripts/check-baseline-export-shape.ts`.
- Copied the updated checker into `reference/undaunted-progress/`.
- Updated the runner notes with the summary command.

Notes:

- The summary file is written under the ignored `exports/` folder.
- The summary records metadata and counts only; it is not a scored experiment result.

## 2026-06-24: non-empty export sample

I added an anonymised output sample so the shape checker can inspect a match row, not only an empty dry-run export.

Focus:

- Check the score fields that each exported match row should keep.
- Make the sample clearly separate from real baseline evidence.
- Keep the IRP repository updated with both the sample and the code that checks it.

Work completed:

- Added `docs/irp/samples/baseline-export-output.sample.json` in Undaunted.
- Copied the sample into `docs/samples/baseline-export-output.sample.json`.
- Extended `server/scripts/check-baseline-export-shape.ts` to inspect score fields, match reasons and AI flags inside each row.
- Synced the updated checker into `reference/undaunted-progress/`.

Notes:

- The sample is hand-written and anonymised.
- It is for schema checking only, not for reporting performance.

## 2026-06-24: end-of-day export check status

I closed the day by tightening the remaining part of the export shape check.

Focus:

- Make sure progress events are checked as structured rows.
- Keep the verification step local and repeatable.
- Leave the scoring algorithm unchanged until the baseline output path is stable.

Work completed:

- Extended `server/scripts/check-baseline-export-shape.ts` to check `progress` events.
- Synced the updated checker into `reference/undaunted-progress/`.
- Reran the dry-run export check and the non-empty sample output check.

Notes:

- The checker now covers run metadata, matcher input, progress events and match rows.
- Generated summaries remain local ignored files.
- No scoring rule, weight or AI prompt was changed today.

## 2026-06-25: local investor fixture

I started the next step by adding a small anonymised investor fixture.

Focus:

- Prepare a local investor set before trying another live baseline run.
- Keep fake test data separate from real Airtable data.
- Update both repositories at the same time.

Work completed:

- Added `docs/irp/fixtures/baseline-investors.sample.json` in Undaunted.
- Copied the same fixture into `docs/fixtures/baseline-investors.sample.json` in this repository.
- Updated the repository index so the fixture is easy to find later.

Notes:

- The fixture has fake investor profiles only.
- It is for offline runner checks, not for reporting baseline performance.
- No scoring rule, weight or AI prompt was changed.

## 2026-06-25: fixture runner path

I connected the baseline export runner to the local investor fixture.

Focus:

- Run the export path without Airtable access.
- Keep the local check separate from a live baseline run.
- Show the code change in the IRP repository through a progress snapshot.

Work completed:

- Added `--investors` support to `server/scripts/export-baseline-matches.ts`.
- Added `--skip-ai` for local rule-based checks.
- Copied the updated runner into `reference/undaunted-progress/server/scripts/export-baseline-matches.ts`.
- Updated the shape checker so final progress events can use `null` counts.
- Updated the export runner notes with the local fixture command.

Notes:

- `--skip-ai` is only for local checks.
- A live baseline run should still use Airtable investor data and the normal AI candidate setting.
- No scoring rule, weight or AI prompt was changed.

## 2026-06-25: named fixture commands

I added named package commands for the local fixture run.

Focus:

- Make the local check easier to repeat.
- Keep generated exports out of git.
- Keep the package snapshot in this repository aligned with Undaunted.

Work completed:

- Added `irp:export-local-fixture` in Undaunted.
- Added `irp:check-local-fixture` in Undaunted.
- Copied the updated `package.json` into `reference/undaunted-progress/package.json`.
- Updated the runner notes with the shorter commands.

Notes:

- The commands still write generated files under the ignored `exports/` folder.
- This is a repeatability change, not an algorithm change.

## 2026-06-25: local summary fields

I made the local check summary a bit more useful.

Focus:

- See the top match without opening the full export file.
- Keep generated output local.
- Keep the IRP code snapshot aligned with the checker change.

Work completed:

- Added `topMatch` to the local summary output.
- Added `scoreRange` with the min and max total score.
- Copied the updated checker into `reference/undaunted-progress/`.
- Updated the runner notes with the new summary fields.

Notes:

- The summary is still generated under `exports/`.
- No generated result file was committed.
- No scoring rule, weight or AI prompt was changed.

## 2026-06-25: local fixture run reading

I recorded how I am reading the local fixture run.

Focus:

- Keep the generated export out of git.
- Record the useful summary numbers.
- Avoid treating fake fixture scores as baseline evidence.

Work completed:

- Added a short run note in Undaunted for the local fixture check.
- Recorded the top match from the summary: `Sample Energy Seed Fund`, total score 61.
- Recorded the score range: 17 to 61.
- Updated the export runner notes in this repository.

Notes:

- This is a plumbing check.
- The investor data is fake and `--skip-ai` is enabled.
- No scoring rule, weight or AI prompt was changed.

## 2026-06-25: end-of-day local fixture status

I closed the day by recording the local fixture path status.

Focus:

- Keep the end state clear before moving to live data.
- Confirm that the school repository has the matching code snapshots.
- Avoid committing generated exports.

Work completed:

- Updated the Undaunted run note with the end-of-day status.
- Updated the export runner notes in this repository.
- Confirmed that the local fixture path runs through package commands and ignored output files.

Notes:

- The next useful step is a live baseline run with real service access.
- The same shape checker should be used before comparing live scores.
- No scoring rule, weight or AI prompt was changed today.

## 2026-06-26: live run readiness

I started the live baseline run checklist.

Focus:

- Check what needs to be ready before using real service access.
- Keep live generated outputs out of git.
- Continue using the same output shape checker.

Work completed:

- Added a live-run readiness note in Undaunted.
- Listed the Airtable and OpenAI environment variables to check before running.
- Recorded the intended live output and summary paths under `exports/`.
- Updated the export runner notes in this repository.

Notes:

- I did not run a live baseline export in this step.
- No generated live output was committed.
- No scoring rule, weight or AI prompt was changed.

## 2026-06-26: live env check command

I added a small command for checking live-run environment variables.

Focus:

- Check readiness before touching live services.
- Avoid printing secret values.
- Keep the IRP progress snapshot aligned with the Undaunted code.

Work completed:

- Added `server/scripts/check-baseline-live-env.ts` in Undaunted.
- Added the `irp:check-live-env` package command.
- Copied both code and package snapshots into `reference/undaunted-progress/`.
- Updated the export runner notes with the command.

Notes:

- The command only checks whether variables are set.
- It does not call Airtable or OpenAI.
- No scoring rule, weight or AI prompt was changed.

## 2026-06-26: named live commands

I added named commands for the live baseline export path.

Focus:

- Avoid copying long live-run commands by hand.
- Keep the live output paths under `exports/`.
- Make the package snapshot in this repository match Undaunted.

Work completed:

- Added `irp:export-live-baseline` in Undaunted.
- Added `irp:check-live-baseline` in Undaunted.
- Copied the updated `package.json` into `reference/undaunted-progress/`.
- Updated the export runner notes with the named live commands.

Notes:

- I did not run the live export command.
- The live export command should only run after `irp:check-live-env` passes.
- No scoring rule, weight or AI prompt was changed.

## 2026-06-26: env check JSON output

I updated the live env checker so it can return a structured status.

Focus:

- Make readiness checks easier to inspect.
- Keep secret values out of command output.
- Update the IRP code snapshot, not only the notes.

Work completed:

- Added `--json` support to `server/scripts/check-baseline-live-env.ts`.
- Copied the updated script into `reference/undaunted-progress/server/scripts/check-baseline-live-env.ts`.
- Updated the export runner notes with the new flag.

Notes:

- The checker still does not call Airtable or OpenAI.
- The JSON output reports counts and missing variable names only.
- No scoring rule, weight or AI prompt was changed.

## 2026-06-26: live output path check

I added a small path check before any live baseline run.

Focus:

- Keep live outputs in ignored local paths.
- Make the path rule executable instead of only writing it in notes.
- Sync the new TypeScript script into the IRP progress snapshot.

Work completed:

- Added `server/scripts/check-baseline-output-paths.ts` in Undaunted.
- Added the `irp:check-live-paths` package command.
- Copied the new script and updated package snapshot into `reference/undaunted-progress/`.
- Updated the export runner notes with the path check command.

Notes:

- The script checks paths only.
- It does not run the matcher or call external services.
- No scoring rule, weight or AI prompt was changed.

## 2026-06-26: end-of-day live readiness status

I closed the day by checking that the live-readiness work is visible in this repository as code, not only notes.

Focus:

- Keep a visible code trail in the IRP repository.
- Separate original baseline snapshots from progress snapshots.
- Stop before running live services without confirmed environment variables.

Work completed:

- Confirmed that `reference/undaunted-progress/` now includes the runner, export shape checker, live env checker and output path checker.
- Confirmed that the progress snapshot also includes `baseline-export.ts`, `matching-config.ts`, `matching.ts` and `airtable.ts`.
- Updated the export runner notes with the end-of-day status.

Notes:

- I did not run the live baseline export today.
- The next step is to run live export only after the env and path checks pass.
- No scoring rule, weight or AI prompt was changed today.

## 2026-06-29: blind labelling input contract

I prepared the baseline output for Chuan's blind relevance labelling work. The scored JSON and the future CSV now have separate contracts, so the labelling file can hide the current ranking without losing the evidence needed for a judgement.

Work completed:

- Added stable query, startup and funding-round identifiers to the export input.
- Added investor description, HQ location and investment thesis to the scored export.
- Added a TypeScript contract for the 36 blind CSV columns, relevance values and blocked fields.
- Added a two-round query-set loader and duplicate checks.
- Added one command that reruns the existing fixture path and checks the Week 3 input contract.
- Mirrored the new services, scripts and samples in `reference/undaunted-progress/`.

The checks use anonymised local data. I did not generate a formal blind CSV, call live services or change the matcher, its weights or its AI prompt.

## 2026-06-30: blind CSV sample

I turned the scored fixture output into a separate CSV for Chuan's structure review. The conversion keeps the evidence fields but removes ranking information before anything is written to disk.

Work completed:

- Added a field projection from scored JSON to the fixed 36-column blind row.
- Added CSV escaping, direct-identifier removal and random row shuffling.
- Added a pack manifest with version, timestamp, counts and SHA-256.
- Added a validator that rereads the CSV and checks blank labels, unique pairs, amount formats and the manifest hash.
- Added the same services and scripts to the runnable IRP progress snapshot.
- Generated a four-row anonymised sample for review.

The sample contains fictional local data only. I did not commit a live or formal labelling pack, and I did not change the matching scores or ranking logic.

## 2026-07-01: formal pack acceptance checks

Chuan accepted the anonymised sample. I converted the agreed size of the first formal handover into checks that run against the private CSV and manifest.

Work completed:

- Extended the pack validator with optional checks for purpose, query count and rows per query.
- Added a command for the agreed three-query pack with ten baseline rows per query.
- Mirrored the validator and package command in the runnable IRP progress snapshot.

The formal CSV, its manifest and the scored source remain in ignored local paths. This repository records the code change without exposing the ranking or Chuan's future labels.

## 2026-07-01: formal export input checks

I added a separate formal export command for the three accepted queries. It uses fixed local paths so the scored sources and generated handover stay outside Git.

Work completed:

- Required ten projected rows from each scored query before a formal pack can be written.
- Rejected duplicate query IDs across the three inputs.
- Required private scored filenames to end in `.local.json`.
- Added the same export checks and command to the runnable IRP progress snapshot.

The command stops before writing output when an input is incomplete or repeated. I have not committed a scored source or a formal labelling file.

## 2026-07-01: private formal pack preparation

I added one command that joins the formal export and validation steps. It uses temporary files so an incomplete run cannot replace the handover files.

Work completed:

- Checked that all three private scored query files exist before starting.
- Wrote the CSV and manifest to pending local paths.
- Promoted the files to their formal names only after the 3-query, 30-row check passed.
- Removed pending files after a failed export or validation.
- Refused to overwrite an existing formal version after handover.
- Added the same preparation script to the runnable IRP progress snapshot.

The local run currently stops because the three private scored inputs and live environment are not present. I did not create fictional formal rows. The next run needs the real query inputs and locally loaded credentials; none of those values or generated files belong in Git.

## 2026-07-02: frozen label rules

I started the label-freezing work with checks that can run without live access or Chuan's real CSV.

Work completed:

- Added the fixed mapping between the three relevance labels and values 0, 1 and 2.
- Checked the separate rules for completed judgements and held rows.
- Marked a query incomplete when any row is held or invalid.
- Rejected blank stable IDs and repeated query-investor pairs.
- Added the same service and offline check to the runnable IRP progress snapshot.

The offline check changes only the fictional sample in memory. It does not create a labelled file or claim that Chuan's labels have been received.

## 2026-07-02: supplementary pair selection

I added the selection step for investors that enter an evaluated top ten after the first algorithm change.

Work completed:

- Compared later candidates with the full frozen `queryId + investorId` set.
- Kept only pairs that have not already been judged or placed on hold.
- Treated the same investor in a different query as a separate pair.
- Cleared all judgement fields before a new pair can enter a supplementary batch.
- Rejected duplicate pairs in either the candidate set or frozen label set.
- Added the same service and offline check to the runnable IRP progress snapshot.

This step selects rows in memory only. The private supplementary CSV and its versioned manifest will be written after the file-level frozen-label checks are in place.

## 2026-07-02: frozen file and supplementary workflow

I connected the row rules to the private file workflow. The check now compares a returned labelled CSV with the original blank pack before it records a frozen version.

Work completed:

- Added an exact 36-column CSV reader for blank and labelled packs.
- Rejected missing pairs, new pairs and changes to IDs or evidence fields in a returned file.
- Added a frozen manifest that records the source hash, labelled hash, version and completeness counts.
- Prevented an existing frozen manifest from being overwritten.
- Connected supplementary export to the frozen file so it keeps only unseen query-investor pairs.
- Added the same runnable services and scripts to `reference/undaunted-progress/`.

The joint workflow check uses fictional rows in memory and writes no generated files. The real formal pack, returned labels and supplementary batch remain private and are still waiting for live access and the formal handover.

## 2026-07-03: baseline label join

I added the connection between a scored baseline export and the frozen relevance labels. The join uses `queryId + investorId`, keeps the baseline match payload beside the judgement, and reports missing or unused pairs instead of dropping them quietly.

I then added the first comparison gate on top of the join. A query only enters the comparison set when every evaluated top-ranked investor pair has a usable frozen judgement. If a top-ranked row is on hold, has no label, or is missing from the frozen file, the whole query stays out of the metrics.

The offline check uses the tracked anonymous samples and completes fictional labels in memory. It now checks the complete case, a held-row case and a missing-label case. It does not create a comparison file or claim that the private formal labels are available.

I then added the runnable comparison step in both repositories. It checks the frozen manifest against Chuan's labelled CSV, joins the three scored baseline exports by `queryId + investorId`, and writes the usable rows to an ignored `.local.json` file. The output records which frozen label version and hash were used, so a later metric report can be traced back to one fixed judgement set.

The runner refuses paths outside `exports/` and will not overwrite an earlier comparison file. I added those guards to the offline check and included the check in the Week 3 readiness command. The real comparison is still pending because the live exports and returned frozen labels are not available; I have not substituted fictional IDs or committed generated data.

## 2026-07-06: Week 4 rule variant boundary

Today I started the Week 4 algorithm-change work by setting the boundary for the first normalisation variant.

Focus:

- Move from baseline/export preparation into a small rule-layer experiment.
- Keep the first variant limited to label normalisation before scoring.
- Keep Chuan's frozen labels and final evaluation input as her side of the workflow.

Work completed:

- Added `docs/week-four-rule-variant-plan.md`.
- Synced the current sector taxonomy helper into `reference/undaunted-progress/shared/sector-taxonomy.ts`.
- Updated the progress snapshot check so the taxonomy helper is treated as part of the matcher source boundary.
- Updated the local `matching.ts` snapshot so round sectors pass through the investor taxonomy map before sector scoring.

Notes:

- I did not change scoring weights, the AI prompt, the semantic scoring path, or the frontend result shape.
- I did not commit private Airtable records, labels, scored exports, ranks, scores, or manifests.
- The next step is to add a local normalisation check before changing more rule-scoring behaviour.

## 2026-07-06: executable rule boundary check

I added a small check for the matcher settings that should stay fixed while the first Week 4 rule variant is prepared.

Focus:

- Make the Week 4 boundary executable, not only written in a note.
- Check the baseline weights and AI settings before changing rule inputs.
- Check that the sector taxonomy map behaves as expected.

Work completed:

- Added `reference/undaunted-progress/server/scripts/check-week-four-rule-boundary.ts`.
- Added the `irp:check-week-four-boundary` command.
- Updated the Week 4 plan with the command and what it checks.

Notes:

- The check does not call Airtable or OpenAI.
- The check does not generate exports or private files.
- No new metric runner was added, because Chuan owns the frozen-label evaluation input.

## 2026-07-07: stage and instrument normalisation

Today I implemented the first small part of the Week 4 rule variant.

Focus:

- Clean stage and investment instrument labels before they enter rule scoring.
- Keep the scoring weights, AI path and result payload unchanged.
- Make the same code visible in the school repository so the implementation progress is not only recorded as notes.

Work completed:

- Added `matching-normalisation.ts` for stage and instrument aliases.
- Connected the normalised stage values to the existing stage scoring path.
- Connected the normalised instrument values to the existing instrument overlap path.
- Added `check-stage-instrument-normalisation.ts` to test both the normalisation helper and the matcher scoring path.
- Ran the new check and the Week 4 boundary check locally.

Notes:

- This is a rule-input cleanup, not a new metric claim.
- No private Airtable records, formal CSVs, labels, scored exports or manifests were committed.
- Live comparison still depends on real baseline exports and Chuan's frozen labels.

## 2026-07-08: geography normalisation

Today I added the next small rule-input cleanup for the Week 4 variant.

Focus:

- Clean round geography and investor regional focus labels before geography scoring.
- Keep the existing geography score values and fallback paths.
- Keep the same implementation visible in the IRP repository and the supervisor repository.

Work completed:

- Extended `matching-normalisation.ts` with geography aliases.
- Connected the normalised geography labels to `computeGeographyMatch(...)`.
- Added `check-geography-normalisation.ts` as an offline matcher check.
- Ran the geography check, the stage/instrument check and the Week 4 boundary check locally.

Notes:

- This does not change scoring weights, AI candidate selection, semantic scoring or the result shape.
- I did not commit live Airtable data, generated exports, private labels or manifests.
- The real comparison still depends on the private baseline exports and Chuan's frozen labels.

## 2026-07-09: variant comparison input check

Today I added a guard for comparing a baseline export with a later normalisation variant.

Focus:

- Check that a baseline export and a variant export describe the same query.
- Count which investors enter or leave the evaluated top-k set.
- Avoid duplicating Chuan's metrics work.

Work completed:

- Added `variant-comparison.ts` for export identity and top-k set checks.
- Added `check-variant-comparison-inputs.ts` with an offline self-check.
- Added the `irp:check-variant-comparison-inputs` command.
- Ran the new check together with the Week 4 normalisation and boundary checks.

Notes:

- The check does not read labels, calculate metrics or write a comparison file.
- It does not call Airtable or OpenAI.
- Real baseline and variant exports should stay under ignored `exports/*.local.json` paths.
- Chuan still owns the frozen labels and the final labelled evaluation input.

## 2026-07-10: Week 4 readiness check

Today I tied the Week 4 local checks together into one command.

Focus:

- Keep the first normalisation variant narrow and testable.
- Make the current algorithm work visible as code in the IRP repository, not only as notes.
- Leave the labelled metrics workflow separate from Chuan's branch.

Work completed:

- Added `check-week-four-readiness.ts`.
- Added the `irp:check-week-four-readiness` command.
- Ran the combined check in the IRP copy and the supervisor repository.

Notes:

- The combined check runs the Week 4 boundary, stage/instrument normalisation, geography normalisation and variant input checks.
- It does not call Airtable or OpenAI.
- It does not create or commit private baseline exports, formal CSV files, labels or manifests.
- The real baseline-versus-variant result still depends on private exports and Chuan's frozen labels.

## 2026-07-12: formal variant export guard

I added one more Week 4 preparation step before trying to calculate real metrics.

Focus:

- Keep baseline exports and normalisation-v1 exports separate.
- Avoid manual file renaming when the live Replit run is ready.
- Make the variant export step visible in the IRP repository as code.

Work completed:

- Added `export-formal-variants.ts`.
- Added the `irp:export-formal-variants` command.
- Added the new variant export script to the Week 4 readiness source-file check.

Notes:

- The command writes `variant-query-01.local.json` through `variant-query-03.local.json`.
- It refuses to overwrite existing variant outputs.
- It still depends on the private formal query inputs, so I did not run it with real data locally.
- This is not a metrics calculation. The metric comparison still needs the real baseline exports, frozen labels and any supplementary labels.

## 2026-07-13: semantic context and experiment boundary

Today I started the Week 5 semantic comparison by fixing the current input and experiment boundaries before changing the scorer.

Focus:

- Keep the Week 4 normalisation work unchanged.
- Record exactly which startup, funding round and investor fields enter semantic scoring.
- Separate the semantic method from historical feedback in the primary comparison.

Work completed:

- Moved the startup and investor context builders into `semantic-context.ts` without changing their output.
- Added field coverage metadata for included fields, missing fields, source length and truncation.
- Added checks for field order, empty inputs and the existing 2,500-character limit.
- Defined the rule-only, GPT semantic and text-similarity comparison methods.
- Added a combined Week 5 readiness command that also reruns the Week 4 checks.

Notes:

- No Airtable or OpenAI request was made.
- No private context, scored export, label or manifest was committed.
- The matcher still uses `gpt-4o-mini` with the same semantic weight and exclusion cap.
- The text-similarity scorer is the next implementation step; no result claim has been made yet.

## 2026-07-14: GPT semantic scoring path

Today I separated the GPT request from the main matching function and made the semantic route testable without a live API call.

Work completed:

- Moved OpenAI request, retry and response parsing into `semantic-scorer.ts`.
- Added an optional scorer input to `runMatching(...)` while keeping GPT as the default production path.
- Added a `rule-only` mode that does not call the semantic scorer.
- Added offline checks for scoring mode selection, prompt shape, score limits, exclusions and failed responses.
- Extended the Week 5 readiness command to run the new checks.

The IRP copy and the supervisor repository contain the same implementation. No Airtable record, API response, scored export or frozen label was committed. This prepares the matcher for a controlled comparison; it does not yet provide ranking metrics or evidence that one semantic method performs better.

## 2026-07-15: local text-similarity comparator

Today I added the third method in the Week 5 comparison. It is a local token-frequency cosine score, so it can run without OpenAI and return the same answer for the same two context strings.

Work completed:

- Added text normalisation, tokenisation and cosine similarity functions.
- Connected `text-similarity` to `runMatching(...)` as an explicit mode.
- Removed fixed context labels and common words before scoring.
- Added diagnostics for token counts and shared terms.
- Checked empty input, score bounds and feedback isolation.
- Added the local checks to the Week 5 readiness command.

The matcher still defaults to GPT, and the result shape used by the UI is unchanged. This local method is only a comparison point. It cannot understand synonyms or identify hard investor exclusions. No private context, scored export, label or manifest was committed.

## 2026-07-16: shared-pool semantic comparison runner

Today I turned the three separate scoring modes into one repeatable comparison path.

Work completed:

- Added a comparison identity with the query IDs, candidate count and a stable candidate-pool hash.
- Ran `rule-only`, `gpt-semantic` and `text-similarity` against the same investor candidates.
- Kept the fixed Week 5 configuration and removed feedback from the primary comparison.
- Added a private JSON export with top-ten completeness, path and overwrite checks.
- Extended the Week 5 readiness command to cover the full comparison path.

The new code is present in both repositories. The offline checks use fictional inputs and do not produce performance metrics. Real comparison files will stay under ignored `exports/*.local.json` paths, and Chuan's frozen labels and metric calculation remain separate from this producer-side work.

## 2026-07-17: semantic signal and ranking review

Today I finished the local review path for the Week 5 semantic comparison.

Work completed:

- Added a text coverage audit for missing startup and investor fields, empty investor contexts and truncation.
- Added pairwise top-10 and top-5 overlap, same-rank counts and average rank movement for the three methods.
- Added semantic score range and hard exclusion checks without copying investor identifiers or profile text into the review.
- Added a protected command that accepts three private query comparisons and writes one local review file.
- Extended the Week 5 readiness command to include the new audit and review checks.

The review describes differences between the rankings; it does not say which ranking is better. That decision still needs Chuan's frozen labels and the agreed ranking metrics. Historical feedback also remains outside the primary comparison, so no feedback rule has been selected yet.

## 2026-07-21: controlled feedback comparison

Today I connected the curated feedback set to a separate GPT comparison run while keeping the Week 5 no-feedback result as the control.

Work completed:

- Built a feedback context from useful positive and negative review reasons.
- Kept investor names, startup names and internal IDs out of that context.
- Added a runner that checks the query, candidate pool, matching configuration and feedback-set hashes before scoring.
- Ran the control and curated paths against the same inputs and returned two top-ten lists.
- Added the context and runner checks to the Week 6 readiness command.

The checks use fictional records and do not claim a metric improvement. Real feedback stays private, and Chuan still owns the frozen-label metrics and error analysis used to decide whether this variant should be kept.

## 2026-07-22: protected feedback comparison export

Today I added the saved output for the no-feedback and curated-feedback comparison.

Work completed:

- Defined one export schema for the two top-ten runs.
- Kept ranks, investor IDs, score details and explanations for later private evaluation.
- Stored feedback and experiment versions as hashes and counts rather than copying the feedback context.
- Restricted output to ignored `exports/*.local.json` paths and refused overwrites.
- Added protected writing and checked that concurrent writes cannot replace one another.
- Added the export test to the Week 6 readiness command in both repositories.

The offline checks use fictional rows and temporary files. No real feedback, scored result or frozen label was committed. The export is ready for Chuan's evaluation workflow once the private grouping and real query runs are available.

## 2026-07-23: three-query feedback comparison batch

Today I connected the single-query feedback comparison to the fixed three-query evaluation set.

Work completed:

- Added a batch input check for the three query IDs, startup and funding round pairs, investor candidates and candidate-pool hashes.
- Ran each query in definition order, with separate no-feedback and curated-feedback top-ten runs.
- Kept one matching configuration and one curated feedback set across the batch.
- Added a private manifest with one SHA-256 value for each query result file.
- Checked the three files before publishing the manifest and refused overwrites.
- Added the batch and manifest checks to the Week 6 readiness command in both repositories.

The offline run uses fictional records and does not say whether curated feedback improves the ranking. Real query files and feedback stay under ignored local paths. Chuan's frozen labels are still needed before the four agreed ranking metrics can be compared.

## 2026-07-24: frozen metric handoff and feedback decision

Today I completed the receiver side of the three-query feedback comparison.

Work completed:

- Added checks for Chuan's `frozen-ranking-metrics-v1` output, including three-query coverage, 30 judged pairs and the agreed metric definitions.
- Bound the no-feedback and curated metric files to the comparison batch, matching configuration and feedback set with SHA-256 values.
- Checked each query's startup and funding round identity and confirmed that summary metrics match the per-query macro means.
- Rechecked all three scored comparison files against the batch manifest before preparing a decision.
- Added a decision summary for the changes in Precision@5, Precision@10, MRR and NDCG@10.
- Kept the selection rule conservative: consistent improvement moves the curated run to error review, while mixed, unchanged or regressed results keep the control.
- Added a protected command that writes the receipt and decision only to ignored local files and refuses overwrites.
- Extended the Week 6 readiness check in both repositories.

The checks use fictional metrics and temporary files. I did not add a second metric calculator or copy Chuan's frozen labels into this repository. The actual decision is still waiting for her two authoritative metric files and the follow-up error review.

## 2026-07-25: feedback ablation intake gate

Today I aligned the Week 6 handover with Chuan's revised `feedback-ablation-intake-v1` receiver contract.

Work completed:

- Mapped the internal control and treatment modes to `no_feedback_gpt` and `curated_feedback`.
- Added a 60-row ranked CSV contract covering three queries, two methods and ranks 1-10.
- Recorded one candidate-pool SHA-256 per query and bound the intake CSV, comparison batch and frozen-label files by SHA-256.
- Kept scores, match reasons, AI insight, investor names and feedback text out of the handover CSV.
- Added a coverage gate that stops before metrics when any top-ten pair needs supplementary blind labelling or a frozen query is incomplete.
- Added protected local writers, fictional contract checks and the new gate to Week 6 readiness in both repositories.

No real intake or metric file was generated. The live comparison still waits for the replacement third query, the formal-v3 frozen labels and the corresponding private two-method comparison batch.

## 2026-07-27: final evaluation evidence path

Today I prepared the last step that will turn the private feedback ablation into evidence that can be inspected without opening raw exports.

Work completed:

- Added one command that accepts the canonical three-query batch and Chuan's two frozen metric files.
- Rechecks the query identities, batch files, metric definitions and per-query macro means before drawing the result.
- Produces a grouped chart for Precision@5, Precision@10, MRR and NDCG@10.
- Shows per-query changes as Q1, Q2 and Q3 so real query, startup and funding round identifiers do not appear in the SVG.
- Writes a sidecar manifest containing the metric hashes, AI model, matching configuration hash and implementation commit.
- Added output-path, overwrite, identity-leakage and incomplete-query checks.
- Added a Week 7 readiness command that runs the existing producer checks and the visualisation checks together.

The committed check uses fictional values only. It confirms that the final evidence path works, but it does not claim that curated feedback improves the matcher. That conclusion still depends on the private Replit exports, Chuan's frozen metrics and the final qualitative error review.

## 2026-07-28: evidence-bound final matcher handoff

Today I added the gate between the private evaluation and the final runtime integration.

Work completed:

- Bound the metric receipt, decision, visualisation manifest and per-query error review by SHA-256.
- Recorded the AI model, matching configuration hash and implementation commit requested for the final matcher handoff.
- Kept the existing interface fields explicit: investor, score breakdown, match reasons and AI insight.
- Allowed curated feedback to move forward only after consistent metric improvement and an approving error review.
- Kept the no-feedback GPT run when the evidence is mixed or the review does not approve the curated method.
- Added private path and overwrite protection, plus an offline check with fictional evidence.
- Added the handoff check to the Week 7 readiness command in both repositories.
- Added a guarded runtime adapter for the selected no-feedback or curated-feedback method.
- Checked the runtime model, configuration, implementation commit and feedback-set hash against the handoff.
- Checked duplicate investors, component score ranges, total-score ordering and the fields used by the current interface.

No final method has been selected in the repository, and the production route still uses its existing path. The real handoff still waits for the private Replit comparison, Chuan's frozen metrics and her per-query error summary.

## 2026-07-29: route result compatibility

Today I checked how the guarded matcher can enter the existing result flow without changing the interface.

Work completed:

- Added a small bridge from the guarded runtime to the current route result object.
- Kept the existing startup ID, funding round ID and match array fields.
- Checked the investor lookup key, seven score values, match reasons and AI insight used by the frontend.
- Ran the result through a JSON round-trip to cover the saved-match path.
- Rejected extra route fields, duplicate investors and invalid runtime identity.

The production route has not changed. The real handoff still decides which method can use this bridge.

I also added an anonymous view of the final ranking changes:

- Compares the baseline and selected route results on the same query and candidate pool.
- Shows only aliases such as `I001`, with no private IDs, names, scores or explanations.
- Separates movement from improvement: the SVG shows who moved, while frozen metrics and the error review decide whether the move was useful.
- Binds the chart to its source hashes, model, matching configuration and implementation commit.
- Keeps generated SVG and manifest files inside ignored `exports/` paths.

## 2026-07-30: guarded route execution

Today I joined the final matcher boundary to one route-level call.

Work completed:

- Added one entry point that accepts an approved handoff and the records already loaded by the current route.
- Runs either the no-feedback control or the approved curated-feedback method without changing the result fields.
- Emits the current `complete` progress event after the guarded result has passed validation.
- Keeps saving, notifications and production route changes outside the service.
- Tests both allowed methods, input immutability, private-value omission and rejected configurations.

The production route still uses the existing matcher. It should switch only after the real frozen metrics and error review produce a final handoff.

I also prepared one local page for the final review:

- Combines the frozen metric chart with anonymous ranking movement for Q1, Q2 and Q3.
- Shows the selected method, model, matching configuration, feedback set and implementation commit together.
- Rechecks every source hash and refuses duplicate queries, active SVG content, Airtable identifiers and files outside `exports/`.
- Produces a static HTML file and provenance manifest without changing the live frontend.

The committed tests use fictional values. The real page will be generated only after Chuan's frozen metric files and the approved final handoff are available.

## 2026-07-31: final route lifecycle

Today I connected the guarded matcher to the rest of the route lifecycle
without changing the production route.

Work completed:

- Added injected save and notification steps around the validated route result.
- Kept the current order: save the result, send one completion event, then notify the founder.
- Preserved a valid match when saving or notification fails, while reporting which side effect failed.
- Stopped before saving or notification when the matcher configuration or handoff is invalid.
- Added the lifecycle check to the Week 7 readiness command in both repositories.

The formal-v3 labels are available locally in the Undaunted workspace, but the
two scored feedback exports, frozen metric files and final handoff are not
present. The production route therefore remains unchanged.

I also added a final delivery status report:

- It hashes 14 core implementation files and records the commands used to
  check the final workflow.
- The same report runs in both repositories, so the source-set hash can show
  whether the submitted IRP code matches the Undaunted implementation.
- It keeps implementation, frozen evaluation and production activation as
  separate statuses.
- It accepts the final handoff and evidence manifest only when their hashes and
  evaluation identity match.
- It writes a static HTML page and JSON manifest to ignored `exports/` paths.

The current local report can show that the implementation is ready. It still
shows the evaluation as waiting and production as blocked because the real
scored feedback exports and frozen metric evidence are not available.

The final implementation check now has one entry point. It reruns the
TypeScript snapshot, Week 2 and Week 3 baseline and blind-labelling checks, and
the Week 4 to Week 7 algorithm and integration checks. This makes the final
offline path easier to reproduce without treating missing private evaluation
evidence as a successful result.

I also added a dependency-free submission check at the repository root. It
checks the required tracked files, IRP package script targets, local Markdown
links, file sizes and private-output rules. It confirms that the baseline and
current matcher snapshots are both present and different. The top-level README
now starts with the final status and the two commands needed to repeat these
checks.

## 2026-07-31: final repository audit and standalone demonstration

I audited the individual and supervisor repositories before starting the
report and presentation phase.

Work completed:

- Replaced broken application scripts in the individual snapshot with a
  working local HTTP demonstration.
- Added a responsive interface that compares the real legacy and
  normalisation-v1 matcher paths using fictional data and deterministic text
  similarity.
- Added integration tests for the page, health route, comparison endpoint,
  normalisation output and invalid input.
- Removed production-frontend dependencies that the individual snapshot did
  not import and added direct test/type dependencies.
- Extended final readiness and submission checks to cover the interface and
  all local package script targets.
- Documented the formal-v3 baseline cross-check, metric ceilings,
  candidate-selection ties and the ordered final evidence plan.
- Reran the complete IRP readiness path in both repositories. The supervisor
  branch passed its IRP checks with a matching local `esbuild` binary; its
  wider product typecheck and database-dependent test suites still have
  shared-repository issues outside the matcher scope.

The interface is a reproducible algorithm demonstration, not proof of improved
ranking. Real paired variant outputs, supplementary blind labels, a frozen
metric receipt and an approved final handoff are still required before an
improvement or production activation can be claimed.

I then completed the controlled normalisation pilot and the downstream
evaluation receiver:

- Made investor-ID tie-breaking explicit for new experiments while preserving
  historical input-order behaviour.
- Ran paired `legacy` and `normalisation-v1` comparisons on the same three
  queries and 354-investor snapshot for rule-only and deterministic local text
  similarity.
- Generated a deterministic pooled blind pack: 62 distinct pairs, five
  already covered by formal-v3 and 57 new judgements required.
- Added supplementary freeze, safe label-transfer and paired metric commands.
  They reject changed evidence, incomplete labels, holds, malformed hashes,
  dirty formal runs and missing Top-10 coverage.
- Added a public aggregate evidence panel to the standalone interface. It
  shows the verified baseline, pilot overlaps and current gate without private
  investor records.
- Confirmed that GPT comparison fails before writing when no authorised key is
  present, and that the metric evaluator fails before writing when only the
  existing 30 labels are supplied.
- Reran both complete readiness paths successfully. For the individual
  repository I used a temporary Git index so the submission audit could test
  the new files without staging or committing the real worktree.

The remaining blockers are external evidence, not missing implementation:
57 blind judgements, an authorised GPT key if GPT is included, Maiko's four
feedback ratings for the separate feedback ablation, and confirmation of who
owns the authoritative frozen receipt.
