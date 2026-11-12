# Formal variant export

The Week 4 normalisation work needs its own scored outputs before it can be compared with the frozen baseline labels. I added a private export command for that step:

```bash
npm run irp:export-formal-variants
```

The command reads the same three private query inputs used for the formal baseline:

- `exports/formal-query-input-01.local.json`
- `exports/formal-query-input-02.local.json`
- `exports/formal-query-input-03.local.json`

It writes the normalisation-v1 outputs to:

- `exports/variant-query-01.local.json`
- `exports/variant-query-02.local.json`
- `exports/variant-query-03.local.json`

This avoids manually renaming files after a live run. It also refuses to overwrite an existing variant export, so a later comparison cannot quietly replace an earlier run.

This still does not prove that the variant is better. It only creates the private scored files needed for the next checks. The actual metric comparison still needs the original baseline exports, Chuan's frozen labelled CSV, the frozen manifest, and any supplementary labels for new top-ten investor pairs.
