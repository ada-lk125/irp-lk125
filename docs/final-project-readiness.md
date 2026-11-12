# Final project readiness

The final readiness command gives the implementation one repeatable offline
check. It starts from the saved baseline and continues through the blind
labelling workflow, normalisation changes, semantic comparison, feedback
ablation, final route boundary and delivery report.

Run it from `reference/undaunted-progress`:

```bash
npm run irp:check-final-project-readiness
```

The command first checks the TypeScript snapshot and runs all automated tests,
including the standalone HTTP interface and its legacy-versus-normalised
comparison endpoint. It then runs the Week 2 and Week 3 readiness path,
followed by the combined Week 4 to Week 7 checks. Fictional fixtures are used
where data is needed, and generated files stay in the ignored `exports/`
directory.

A successful run means the submitted implementation and its offline contracts
are reproducible. It does not reproduce the private evidence automatically.
The four-case, 55-pair local pilot is now complete; its startup-supplied
provenance, mandatory startup-name anonymisation, qualification procedure and
semantic prompt are recorded separately in the protected evaluation manifest.
The private Replit saved-run evidence now freezes the historical 383-investor
scoring snapshot and verifies the four platform outputs. The exact deployment
identifier and original Airtable input order remain unavailable, so a fresh GPT
run is only partially reproducible. The controlled 383-snapshot comparison is
complete: all 56 pooled pairs are labelled, the 17-row return preserves every
protected evidence field, and independent recomputation matches macro P@5 of
0.350 versus 0.500 and macro P@10 of 0.300 versus 0.400. Chuan Ju's final
private-package check subsequently returned `PASS_FINAL` with 56/56 coverage,
zero protected evidence changes, matching macro values and no discrepancies.
That receiver-side sign-off remains separate from this fictional-data offline
implementation check.
The readiness command also rehearses the expert review pack and evaluation
integrity checks on fictional data.
