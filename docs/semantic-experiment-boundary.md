# Semantic experiment boundary

The Week 5 work starts by fixing what the current matcher sends into semantic scoring. I moved the startup and investor context builders out of `matching.ts` without changing their field order or 2,500-character limit. The matcher still uses `gpt-4o-mini`, the semantic weight remains 30%, and the result fields are unchanged.

The context helper can now report which source fields were included, which were missing, the length before truncation and whether truncation occurred. This metadata is for checking input quality. It does not print Airtable values or save private context text.

The planned comparison has three methods:

- rule-only ranking;
- the current GPT semantic route;
- a local text-similarity comparator.

All three methods must use the same three queries and the same investor candidate pool. The primary comparison will not inject historical feedback, because that would make it harder to tell whether a change came from the semantic method or the feedback examples. Feedback remains a separate later experiment.

The current checks are:

```bash
npm run irp:check-semantic-context
npm run irp:check-semantic-experiment-boundary
npm run irp:check-semantic-scoring-mode
npm run irp:check-gpt-semantic-scorer
npm run irp:check-text-similarity-foundation
npm run irp:check-text-similarity-boundaries
npm run irp:check-week-five-semantic-readiness
```

The combined command reruns the Week 4 readiness path before checking the semantic work. It covers the experiment boundary, context construction, all three scoring modes, GPT failure handling and the local similarity rules. It does not call Airtable or OpenAI, and it does not calculate ranking metrics. Formal semantic exports are still needed before this comparison can produce results.

## GPT scorer isolation

On 14 July I moved the GPT request and response handling into `semantic-scorer.ts`. Calling `runMatching(...)` without experiment options still uses the current `gpt-4o-mini` route. An experiment can now inject a scorer or select `rule-only`, which skips the semantic call and leaves `semanticScore` at zero.

The GPT check uses local responses rather than a live API. It covers prompt construction, score limits, missing insight text, retry delays and the fallback after three failed attempts. It also requires `exclusion_found` to be the boolean value `true`; a malformed string such as `"false"` no longer triggers the exclusion cap.

This work makes the current route testable but does not show that one ranking method is better. That claim still needs the same formal queries, saved outputs and Chuan's frozen labels.

## Local text-similarity comparator

On 15 July I added a local comparator based on token-frequency cosine similarity. It lowercases the two context strings, removes fixed field labels and common words, then converts the cosine value to a score from 0 to 100. The matcher only uses this path when `semanticMode` is set to `text-similarity`; existing calls still default to GPT.

The local scorer ignores feedback text and never sets `exclusion_found`. Its diagnostic says how many useful tokens and shared terms were found, without storing the original context. This gives the experiment a cheap, deterministic comparison point.

The method has clear limits. It recognises shared words, not meaning, so it can miss synonyms and cannot reason about investor restrictions. Any performance claim must come from the same formal queries and Chuan's frozen labels, not from the local checks alone.
