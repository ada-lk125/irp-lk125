# Frozen file workflow

Chuan owns the completed label file and its frozen manifest. The algorithm repository does not create or replace either file. Once Chuan returns them privately, the producer-side workflow treats both as read-only inputs and checks the manifest hash before using any label.

Update, 31 July 2026: this was the original Week 3 ownership boundary. The
repository now includes local formal and supplementary freeze commands for
independent integrity verification, but using them does not assign
authoritative ownership. The project owner still needs to confirm whether
Chuan or Lingxin produces the authoritative manifest and metric receipt.

The reader matches rows by `queryId + investorId`, so shuffled row order is allowed, but every original pair must still be present exactly once. Startup evidence, investor evidence and stable IDs must remain unchanged from the blank pack. Only the six judgement columns may differ.

The supplementary export uses Chuan's frozen labelled CSV and manifest as required inputs. It rejects a mismatched file hash, projects each later top-ten result through the same blind 36-column contract, removes pairs already present in the frozen set, clears all judgement fields and shuffles the remaining rows:

```bash
npm run irp:export-supplementary-blind-pack
```

All private inputs and generated files use `.local.csv` or `.local.json` paths under `exports/`. They remain outside Git. The offline workflow check uses the fictional tracked sample in memory and writes no files:

```bash
npm run irp:check-frozen-workflow
```

The offline check builds a fictional receiver manifest inside the test only. It does not provide a second production freeze path. A real supplementary run still depends on the private files returned by Chuan.
