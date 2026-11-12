# Final delivery report

The final delivery report gives the implementation and the evaluation evidence
separate status checks. This matters because the code can be complete while
the real frozen comparison is still waiting for scored exports.

The generator reads 14 core matching, evaluation and route-integration files.
It records a SHA-256 for each file and then calculates one hash for the whole
source set. Running the same command in the IRP and Undaunted repositories
should produce the same source-set hash. This gives a direct check that the
personal repository contains the implementation itself, not just notes about
work stored elsewhere.

Run the offline contract check with:

```bash
npm run irp:check-final-delivery-report
```

Generate a status page before the frozen evidence is available with:

```bash
npm run irp:prepare-final-delivery-report -- \
  --created-at 2026-07-31T12:00:00.000Z \
  --html-output exports/final-delivery-status.local.final-delivery.html \
  --manifest-output exports/final-delivery-status.local.final-delivery.json
```

Once the approved handoff and final evidence manifest exist, include both
private files:

```bash
npm run irp:prepare-final-delivery-report -- \
  --created-at 2026-07-31T12:00:00.000Z \
  --handoff exports/final.local.final-matcher.json \
  --evidence-manifest exports/final.local.final-evidence.json \
  --html-output exports/final-delivery-status.local.final-delivery.html \
  --manifest-output exports/final-delivery-status.local.final-delivery.json
```

The page reports three states:

- implementation readiness, based on the core files and repeatable checks;
- frozen evaluation readiness, based on the matching handoff and evidence
  manifest;
- production status, which remains blocked or awaits a separate reviewed
  route registration.

Generated pages stay in the ignored `exports/` directory. The generator checks
the evidence hashes and matching identity before it displays the selected
method, model, configuration, feedback set or implementation commit. Until
those private files exist, it shows a waiting state and makes no claim that the
new method improved the metrics.
