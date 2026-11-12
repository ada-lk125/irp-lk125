# Blind labelling sample

I generated the CSV sample from the four fictional investors in the local fixture. It is for Chuan to check the column structure and whether each row contains enough evidence for a relevance judgement. It is not the formal labelling set.

The sample files are mirrored in the runnable progress snapshot:

- `reference/undaunted-progress/docs/irp/samples/blind-labelling-pack.sample.csv`
- `reference/undaunted-progress/docs/irp/samples/blind-labelling-pack.sample.manifest.json`

The CSV has 36 columns and one row for each `queryId + investorId` pair. Its four rows are shuffled. The six judgement fields are blank, and the file does not contain rank, scores, organisation names, startup names, match reasons or AI insight.

The generator removes names found in the scored source, along with email addresses, URLs and line breaks in evidence text. Multi-value fields use a pipe surrounded by spaces. Missing values remain blank, and GBP amounts contain digits only.

The manifest records the sample version, timestamp, file name, row count, query count, column count and SHA-256 hash. It does not include the scored input path. The validator recalculates the hash and rereads the CSV before accepting the pack.

Run the complete offline check from `reference/undaunted-progress/`:

```bash
npm run irp:check-week-three-readiness
```

The next handover is a structure review only. Chuan should not see the scored JSON or any information that could reveal the original order.
