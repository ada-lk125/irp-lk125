# Final matcher runtime boundary

The final handoff now has a runtime adapter, but it is not connected to the production route yet. The adapter accepts only a handoff marked `ready-for-runtime-integration`. Before running the matcher, it checks the AI model, matching configuration, implementation commit and, when selected, the curated feedback set.

The no-feedback path rejects any feedback selection. The curated path requires the exact feedback-set hash recorded during evaluation. Both paths call the existing GPT semantic matcher and return the same fields used by the current interface: investor, score breakdown, match reasons and AI insight. The result check also rejects duplicate investors, invalid component scores and rankings that are no longer sorted by total score.

This separation is deliberate. The adapter can be tested now, while the production route stays unchanged until the real metrics and per-query error review produce a final handoff. Once that evidence is available, the route can call this adapter without changing the saved result or frontend response format.
