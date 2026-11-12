# Supplementary batch rules

A later algorithm may place an investor in a query's evaluated top ten even though that pair was not in the formal baseline pack. The supplementary selector now compares the later candidate set with every frozen `queryId + investorId` pair and keeps only the new pairs.

The pair identity includes the query. The same investor in a different funding-round query still needs a separate judgement. A pair already present in the frozen file is not relabelled, including a pair currently on hold.

Before a selected row leaves the service, all six judgement fields are cleared. The later rank and scores are not part of the projected row, and the file-level exporter will shuffle the selected rows before handover.

Run the offline rule check with:

```bash
npm run irp:check-supplementary-rules
```

The check uses the fictional sample in memory. It confirms that existing pairs are skipped, new pairs are retained, a repeated candidate pair is rejected, and no judgement value carries into the supplementary batch.
