# ClimateTech investor matching IRP

This is Lingxin Kong's independent IRP repository. It preserves the original
Undaunted matcher, contains the optimised matcher and evaluation tooling, and
provides a standalone Undaunted-branded interface for demonstrating the
algorithm without the supervisor repository or any private service.

The university-provided repository structure and GitHub Actions workflows have
not been removed or altered.

## Run the standalone interface

Requirements: Node.js 20 or later and npm.

```bash
npm run setup
npm start
```

Open <http://127.0.0.1:4173>. For a presentation-ready comparison that runs as
soon as the page loads, open <http://127.0.0.1:4173/?autorun=1>.

The page:

- accepts the current platform fields used by the matcher;
- runs the preserved `legacy` and optimised `normalisation-v1` paths;
- uses four fictional investors and deterministic local text similarity;
- displays ranking movement and score breakdowns; and
- reports the final anonymised aggregate evaluation result.

No API key, Airtable connection, database, login or private startup data is
needed. The complete authenticated Undaunted product was not copied because it
depends on shared production infrastructure. The local interface reproduces
the investor-matching interaction needed to run and present this IRP.

## Verify the submission

After setup, run:

```bash
npm run check:submission
npm run check:standalone
npm run check
```

`check:submission` audits repository structure, required files, package-script
targets, local Markdown links, accidental private outputs and credential-like
text. `check:standalone` checks the local server and both matcher profiles.
`check` runs the complete offline implementation and reproducibility suite.

## Final result

The controlling evaluation is a paired, algorithm-blinded, model-assisted
four-case study on the verified historical snapshot of 383 investors. Across
56 pooled startup-investor pairs:

| Metric | Legacy | Normalisation v1 | Absolute change |
| --- | ---: | ---: | ---: |
| Macro P@5 | 0.350 | 0.500 | +0.150 |
| Macro P@10 | 0.300 | 0.400 | +0.100 |

Chuan Ju independently ran the frozen private v3 verifier and returned
`PASS_FINAL` with no discrepancies. These are descriptive results for four
real cases assessed using the frozen Claude Opus 5 qualification procedure.
They are not human expert review, a population estimate or a byte-exact replay
of the historical `gpt-4o-mini` semantic calls.

The public aggregate shown by the interface is stored in
`reference/undaunted-progress/docs/irp/evidence-summary.json`. Real startup,
investor, review and generated result records remain private under ignored
`exports/` paths and are not part of the Git repository.

## Repository map

- `reference/undaunted-baseline/` — preserved starting-point matcher and
  relevant source snapshot.
- `reference/undaunted-progress/` — independently runnable matcher, local
  interface, fixtures, experiments and tests.
- `docs/` — methodology, experiment decisions, evaluation protocol and final
  report support.
- `deliverables/` — project plan and compiled submission artefacts.
- `logbook/` and `notes/` — meetings and dated research record.
- `scripts/check-final-submission.mjs` — repository-level submission audit.

Historical experiment scripts and notes are retained deliberately: they
document the path from baseline investigation to the frozen final method and
support reproducibility. Generated dependencies, operating-system metadata and
private outputs are excluded by `.gitignore`.
