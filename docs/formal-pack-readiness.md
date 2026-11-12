# Formal pack acceptance checks

Chuan accepted the four-row anonymised sample and confirmed that its evidence was sufficient. The first formal handover is now fixed at three queries, with the baseline top ten for each query. A complete pack therefore has 30 unique `queryId + investorId` pairs.

The pack validator can now check these handover conditions as well as the existing 36-column contract. For a formal run, it verifies the manifest purpose, the number of queries, the number of rows in each query and the total row count. The existing checks for blank judgements, direct identifiers, duplicate pairs and the SHA-256 hash still run.

Use the formal check only after the private files have been generated:

```bash
npm run irp:check-formal-blind-pack
```

The command expects the private CSV and manifest under `reference/undaunted-progress/exports/`. Both filenames end in `.local`, so Git ignores them. The scored JSON and original ranking stay private as well.

No formal data is stored in this note. At this point, the repository contains the executable acceptance rules, not Chuan's labelling file.
