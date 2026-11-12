# Week 2 optimisation notes

## Export runner argument checks

I reviewed the baseline export runner after the Week 2 pass and found one small risk in the command line parsing. If I typed `--input` without a value, the script could treat the next flag as the input path and then fail later with a less useful file error.

I tightened that path first. The runner now has a short help message and checks that `--input`, `--output` and `--investors` have real values when they are used.

This does not change the matching score, the AI prompt or the production route. It just makes the local export command harder to misuse.

## Stable local run metadata

The local fixture command now passes a fixed `--run-id` and `--created-at` value. Before this, every local fixture run produced a new timestamp-based run id, which made the output harder to compare by eye.

The live command still uses the current time unless I pass these options on purpose. This keeps real runs traceable while making the fake local fixture check more repeatable.

## Stricter export shape checks

I tightened the shape checker so it catches a few problems earlier. It now checks that `run.createdAt` can be parsed as a date and that match ranks are consecutive from 1.

The checker also creates the summary output folder before writing the summary file. That keeps the command usable when I send the summary to a fresh local folder under `exports/`.

## Local investor fixture checks

The runner now validates local investor fixture rows before it calls the matcher. It checks that each row has an `id`, an `organisation` and the array fields used by the rule-based matching path.

This only applies when I pass `--investors`. Live Airtable loading still uses the existing Airtable parser.

## Snapshot file check

I added a small file check for the Week 2 export runner snapshot. It checks that the package files, TypeScript config, sample input, sample output, local fixture, runner scripts and helper services are all present.

The check does not run matching. It is just a quick guard against copying only part of the export path into the IRP repository.

## Safer live output paths

I tightened the live output path checker. It now resolves each output path and confirms that it stays inside the local `exports/` directory.

This matters because a string like `exports/../baseline.local.json` looks local at first glance but points outside the export folder. The checker now rejects that case, as well as absolute paths and files that do not end in `.local.json`.

## Export schema version

The export now writes `run.schemaVersion` with the value `baseline-export-v1`. The shape checker requires the same value.

This gives later comparison work a simple guardrail. If I compare outputs from two algorithms, I can first check that both files use the same export schema.

## Week 2 readiness check

I added one combined readiness command for the Week 2 baseline export path. It runs the snapshot file check, live output path check, local fixture export and local fixture shape check.

The command does not call Airtable or OpenAI. It is a local check that the Week 2 export path is still wired together before I move on to algorithm changes.
