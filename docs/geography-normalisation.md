# Geography normalisation

This note records the second implemented part of the Week 4 normalisation variant.

The baseline matcher already had geography compatibility rules, but the lookup expected labels to arrive in the same form as the config. That is a brittle place to lose a match. `UK`, `United Kingdom`, `EU`, `Europe excl UK`, `United States`, `worldwide` and `international` can all be reasonable inputs, but the rule layer should compare them through one stable set of labels.

I extended the normalisation helper so geography labels are cleaned before `computeGeographyMatch(...)` runs. Unknown labels are left alone, so the existing fallback behaviour still handles them. I did not change the geography weight, the compatibility table, the AI prompt, the semantic score, or the frontend result payload.

Current scope:

- `UK`, `GB`, `England` and related labels map to `United Kingdom`;
- `EU` maps to `Europe`;
- `Europe excl UK`, `Europe ex UK` and similar forms map to `Europe (excl. UK)`;
- `United States`, `USA`, `US` and `Canada` map to `North America`;
- `international` maps to `Global`;
- `worldwide` stays as `Worldwide` because the existing config already treats it as a global investor region.

Local validation:

```bash
npm run irp:check-geography-normalisation
npm run irp:check-stage-instrument-normalisation
npm run irp:check-week-four-boundary
```

The geography check tests the alias map and then runs a small in-memory matcher example. A canonical geography input and an alias input must produce the same geography score, total score and match reasons.

This is still preparation work. It does not use live Airtable data and does not claim that the variant improves the real ranking. That comparison comes later, after the private exports and frozen labels are available.
