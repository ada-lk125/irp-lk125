# Export runner notes

Date: 2026-06-23  
Source repository: `/Users/lk125/Undaunted-Hub`

## What changed in Undaunted

The Undaunted branch now has a first baseline export runner:

`server/scripts/export-baseline-matches.ts`

The script is outside the production request path. It reads one JSON input file, builds the same local matcher objects as the submit route, calls the existing matcher and writes a JSON file to a local output path.

I copied the current code progress into this IRP repository as well:

- `reference/undaunted-progress/server/scripts/export-baseline-matches.ts`
- `reference/undaunted-progress/server/services/matching-config.ts`

These are progress snapshots, not original baseline files. The original baseline source stays under `reference/undaunted-baseline/`. For example, the original default matching config is still visible inside `reference/undaunted-baseline/server/storage.ts`, while the new helper extracted for the runner is under `reference/undaunted-progress/server/services/matching-config.ts`.

## Sample input

I added a fake input example in this repository at:

`docs/samples/baseline-export-input.sample.json`

The sample is not real Airtable data. It is only there to show the shape that the runner expects.

The matching command in Undaunted is:

```bash
npm run irp:export-baseline -- \
  --input docs/irp/samples/baseline-export-input.sample.json \
  --output exports/baseline-matches.local.json
```

To check the input and output shell without Airtable or OpenAI access, I can use:

```bash
npm run irp:export-baseline -- \
  --input docs/irp/samples/baseline-export-input.sample.json \
  --output exports/baseline-dry-run.local.json \
  --dry-run
```

The output path is ignored by git. I should not commit real generated match outputs unless I later create a tiny anonymised fixture for review.

## Output rows

The runner now validates the required input fields before it calls Airtable or OpenAI. It also writes a smaller match row instead of dumping the full matcher result.

Each exported row keeps:

- rank;
- investor identity and matching fields;
- score breakdown;
- match reasons;
- whether the investor received AI scoring;
- whether the AI result found a hard exclusion;
- AI insight, when present.

In dry-run mode, the export keeps the run metadata and input objects but leaves `progress` and `matches` empty. That lets me check the input shape before using live services.

The current progress snapshot also includes the package script:

`reference/undaunted-progress/package.json`

On 2026-06-24, I added the helper snapshot:

`reference/undaunted-progress/server/services/baseline-export.ts`

The helper keeps input validation, matcher input construction and export row shaping separate from the command-line script.

I also copied the local export shape checker into the progress snapshot:

`reference/undaunted-progress/server/scripts/check-baseline-export-shape.ts`

The checker reads a generated export JSON file and verifies the main sections before I rely on the output for comparison. This is still a local development check; it does not call Airtable, OpenAI or the production route.

The command in Undaunted is:

```bash
npm run irp:check-export-shape -- --input exports/baseline-dry-run.local.json
```

The checker can also write a small local summary:

```bash
npm run irp:check-export-shape -- \
  --input exports/baseline-dry-run.local.json \
  --summary exports/baseline-dry-run-summary.local.json
```

The summary records the run id, model settings and row counts. It stays in the ignored `exports/` folder with the generated export output.

For a non-empty output shape check, I copied an anonymised sample export into this repository:

`docs/samples/baseline-export-output.sample.json`

This file is a hand-written schema sample. It is not a live baseline result and should not be treated as experiment evidence.

At this point, the local checker covers the four main export sections: run metadata, matcher input, progress events and match rows. That should make the first real baseline run easier to inspect, because the output shape can be checked before I compare scores.

On 2026-06-25, I added a local investor fixture:

`docs/fixtures/baseline-investors.sample.json`

The runner snapshot now supports the same fixture through `--investors`, with `--skip-ai` available for a local rule-based run:

```bash
npm run irp:export-baseline -- \
  --input docs/irp/samples/baseline-export-input.sample.json \
  --investors docs/irp/fixtures/baseline-investors.sample.json \
  --output exports/baseline-local-fixture.local.json \
  --skip-ai
```

That command belongs in Undaunted, not this repository. I keep the code snapshot here so the school repository shows the code path changing over time.

The first local fixture run also showed a small shape detail: the matcher can emit a final progress event with `current` and `total` set to `null`. I updated the checker snapshot to allow that while still requiring a phase and message.

I also added named package commands in the Undaunted snapshot:

```bash
npm run irp:export-local-fixture
npm run irp:check-local-fixture
```

Those commands make the local fixture check easier to repeat.

The local summary now records the top match and the min/max total score. That gives me a quick sanity check without committing the generated export.

For the current fixture run, the summary showed four match rows. The top row was `Sample Energy Seed Fund`, with a total score of 61. The score range was 17 to 61.

I am treating that as a plumbing check only. It shows that the local export path can produce and validate rows, but it is not baseline performance evidence because the investor data is fake and `--skip-ai` is enabled.

By the end of 2026-06-25, the local fixture path can run from two package commands, write ignored output files and pass the shape checker. The next useful step is a live baseline run with real service access, using the same output checker before comparing scores.

On 2026-06-26, I started the live-run readiness check. The live command should write to an ignored path such as `exports/baseline-live.local.json`, then the shape checker should write a local summary beside it. I should check the required Airtable and OpenAI environment variables before running it.

I added a small env checker to the progress snapshot:

`reference/undaunted-progress/server/scripts/check-baseline-live-env.ts`

In Undaunted, the command is:

```bash
npm run irp:check-live-env
```

It checks whether the required variables are set, but it does not print secret values or call any external service.

The Undaunted package snapshot now also has named live commands:

```bash
npm run irp:export-live-baseline
npm run irp:check-live-baseline
```

I should only run the live export command after `irp:check-live-env` passes.

The env checker snapshot now supports `--json`, which returns the readiness status without printing secret values.

I also added a progress snapshot for live output path checks:

`reference/undaunted-progress/server/scripts/check-baseline-output-paths.ts`

The Undaunted command is:

```bash
npm run irp:check-live-paths
```

It checks that live outputs stay under `exports/` and use `.local.json` filenames.

By the end of 2026-06-26, I still have not run the live baseline export. The school repository now has the progress snapshots for the runner, export shape checker, live env checker, output path checker, export helper, matching config, matching service and Airtable service. That gives the IRP repository a visible code trail, not just written notes.

## Current limits

The full runner still depends on Airtable investor access and OpenAI access through the existing matcher. It does not use saved feedback yet. That is fine for this step because the first job is to check the output shape.

## End-of-day status

By the end of 2026-06-23, the runner can read the fake sample input, validate the required fields, build the local matcher input objects and write a dry-run export without live services. With Airtable and OpenAI access available, it should run the existing matcher and write ranked rows with score and explanation fields.

The next step is to run a first live baseline sample and inspect the exported fields. I am still not changing the scoring algorithm.
