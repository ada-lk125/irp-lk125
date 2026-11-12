# Blind labelling data contract

The scored baseline JSON and the blind labelling CSV have different jobs. The JSON keeps rank, score details, match reasons and AI insight for later comparison. The CSV gives Chuan the evidence needed to judge a startup-investor pair without showing how the current matcher ranked it.

The CSV should be generated from the scored export rather than edited by hand. This reduces the chance of leaving a score or ranking clue in the file.

## Row identity

Each row belongs to one `queryId + investorId` pair. A query represents a specific startup and funding round, so the same startup can have a different query for a later round.

The file keeps four stable identifiers: `queryId`, `startupId`, `fundingRoundId` and `investorId`. They must not encode rank or row order. Duplicate pairs are invalid.

## CSV representation

- The file uses UTF-8 and one row per pair.
- Rows are shuffled before handover.
- Line breaks in free text are replaced with spaces.
- Multi-value fields use a pipe surrounded by spaces, for example `Seed | Series A` inside a quoted CSV cell.
- Missing values are blank cells.
- GBP amounts are plain numbers without symbols or thousands separators.
- All six judgement fields are blank in a new labelling pack.

The ordered column list lives in `reference/undaunted-progress/server/services/blind-labelling.ts`. This is Week 3 code written for the IRP. It is kept outside `reference/undaunted-baseline/`, which remains an unchanged record of the original application files.

## Judgements

The relevance scale is fixed:

| Label | Value |
| --- | ---: |
| `strong_fit` | 2 |
| `possible_fit` | 1 |
| `weak_fit` | 0 |

For Precision@5, Precision@10 and MRR, values 1 and 2 count as relevant. NDCG@10 uses `2^relevance_value - 1`, giving gains of 0, 1 and 3.

A row on hold has a blank relevance label and value, `review_status = hold`, and an `uncertainty_note`. If any top-ten row is held or missing, the whole query stays out of the comparison.

## Hidden information

The blind file excludes organisation and startup names, rank, row IDs, original order, every score field, match reasons and AI insight. Names, URLs, email addresses and other direct identifiers must also be removed from free text.

## Handover

Each formal or supplementary batch has its own version, ISO timestamp and SHA-256 file hash. Frozen labels are never overwritten. A later algorithm can add a shuffled supplementary batch for new top-ten investors, but those labels must be completed before its ranks or explanations are revealed.
