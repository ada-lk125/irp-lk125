# Algorithm and evaluation decision log

This log supports the final report and viva. Every material choice should be
explainable from a problem, an alternative, evidence and a limitation.

| ID | Decision | Rationale | Alternative not selected | Evidence/status |
|---|---|---|---|---|
| D01 | Preserve the original matcher separately from the developed snapshot. | A fixed starting point is required for a defensible before/after comparison. | Rely only on Git history. | Baseline and progress matcher hashes are distinct and checked. |
| D02 | Keep `legacy` and `normalisation-v1` as explicit profiles. | Both profiles can run on exactly the same inputs, code boundary and investor pool. | Maintain two drifting applications. | Automated normalisation and demo checks pass. |
| D03 | Normalise known stage, geography and instrument aliases before rule scoring. | Equivalent labels otherwise receive different scores. | Fuzzy-normalise every field. | Focused alias/canonical tests pass; broader claims need expert evaluation. |
| D04 | Use investor ID as the explicit tie-break for new comparisons. | Large rule-score ties made source row order an implicit ranking factor. | Preserve input-order ties for new evidence. | Reverse-order deterministic checks pass; historical runs remain unchanged. |
| D05 | Keep local text similarity as the credential-free deterministic demo signal. | The personal repository must run without private APIs while exercising the real matcher path. | Make the demo require GPT. | Standalone HTTP integration test passes. |
| D06 | Treat GPT as an authorised optional formal mode. | GPT may add semantic value but introduces key access, model version, cost and nondeterminism. | Silent fallback when the key/model fails. | Formal GPT exporter refuses missing keys and exhausted fallback output. |
| D07 | Keep historical feedback as a separate ablation. | Mixing feedback into the main optimisation comparison would confound the causal interpretation. | Present feedback-enhanced output as the only optimised method. | Feedback workflow exists; authorised ratings remain pending. |
| D08 | Replace the 57-row supplementary blind-label gate as the final main study. | Maiko's 3 August direction is a paired case study on complete real funding rounds reviewed by knowledgeable people. | Continue treating the pooled pilot as the critical path. | New expert-review protocol and code are implemented; old study remains supplementary. |
| D09 | Use thumbs up/down plus a mandatory comment for final review. | This matches the platform interaction and produces an interpretable binary outcome with qualitative failure reasons. | Ask reviewers to invent a numeric scale. | Expert review CSV enforces `up`/`down` and a comment. |
| D10 | Use P@5/P@10 and paired deltas as final primary metrics. | They follow directly from binary Top-10 judgements and remain interpretable with two or three cases. | Headline MRR/NDCG without complete graded relevance. | Evaluator calculates only the justified primary quantities and agreement. |
| D11 | Hide method, rank and score in the reviewer CSV but preserve them in a private manifest. | This reduces presentation bias while retaining reproducible rank-aware analysis. | Put method and score beside the judgement columns. | Manifest hashes immutable evidence fields and binds each item to its system rank. |
| D12 | Build a minimal standalone UI rather than copy the production frontend. | The production UI is coupled to authentication, database state, notifications and private deployment services. | Copy the whole Undaunted application. | Root-level start/test commands run the local matcher on fictional data. |

## Decisions still requiring confirmation

| ID | Pending decision | Default until confirmed | Owner |
|---|---|---|---|
| P01 | Exact final review depth. | Top 10, because Maiko proposed “top 10, something like that”. | Maiko |
| P02 | Authoritative baseline source. | Use the source-identical local `legacy` profile, cross-checked against the platform output. | Maiko and Lingxin |
| P03 | Second reviewer. | Proceed with Maiko; add Cathal if he confirms. Never claim two reviewers early. | Maiko/Cathal |
| P04 | Formal semantic mode/model. | Deterministic text similarity unless an authorised GPT key and frozen model are available. | Lingxin/Maiko |
| P05 | Authorised investor snapshot. | No formal run until the source and hash are frozen. | Lingxin/Maiko |

## Viva checklist for every final change

For each optimisation, be ready to answer:

1. What concrete baseline failure motivated it?
2. Which input, score or ranking stage changed?
3. Which variables were held fixed?
4. Which automated check proves the code path works?
5. Which human evidence tests ranking quality?
6. What alternative explanation or confound remains?
7. What would falsify the claim that the change helped?
