# Independently runnable matcher

This directory contains the IRP matcher, evaluation tooling, automated tests,
fictional fixtures and standalone Undaunted-branded demonstration interface.
The untouched starting point is preserved separately in
`../undaunted-baseline/`.

## Install, verify and run

From this directory:

```bash
npm ci
npm run demo:check
npm run irp:check-final-project-readiness
npm start
```

Open <http://127.0.0.1:4173>, or use
<http://127.0.0.1:4173/?autorun=1> to populate the fictional comparison
automatically. Equivalent convenience commands are available from the
repository root.

The local server requires no database, authentication, Airtable access or API
key. It passes the current platform fields used by matching into the real
legacy and `normalisation-v1` implementations. Both profiles use the same
fictional investors and deterministic local text-similarity signal, making the
normalisation change visible without claiming that the fictional ranking is an
evaluation result.

The evidence panel reads `docs/irp/evidence-summary.json`, which contains only
public aggregate statistics. Its final four-case values are the frozen
model-assisted comparison verified independently with `PASS_FINAL`:

- legacy macro P@5/P@10: `0.350` / `0.300`;
- normalisation-v1 macro P@5/P@10: `0.500` / `0.400`; and
- absolute changes: `+0.150` / `+0.100`.

The complete authenticated Undaunted frontend is intentionally not included.
It relies on shared accounts, database records, saved matches, feedback,
notifications and deployment configuration. This interface recreates the
matching input, comparison results and IRP evidence needed for independent
execution and presentation.

## Source boundaries

- `client/` — dependency-free local interface.
- `server/demo.ts` — local HTTP server and comparison endpoint.
- `server/services/` — matcher and experiment services.
- `server/scripts/` — reproducibility and evaluation commands.
- `docs/irp/fixtures/` — fictional inputs used by local tests and the demo.
- `docs/irp/evidence-summary.json` — anonymised aggregate display data.
- `exports/` — ignored private/generated outputs; never commit this directory.

The older blind-labelling, semantic and feedback workflows remain in the
snapshot as reproducibility evidence. The controlling final evaluation is the
Maiko-aligned four-case paired study documented in
`../../docs/2026-08-03-maiko-final-evaluation-protocol.md`.
