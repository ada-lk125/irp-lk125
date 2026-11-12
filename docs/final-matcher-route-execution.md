# Final matcher route execution

The route integration now has one callable entry point. It accepts the final
handoff, current matching configuration, implementation commit, startup,
funding round and investor records. It runs the guarded matcher and returns
the same three fields as the current API: `startupAirtableId`,
`fundingRoundAirtableId` and `matches`.

The entry point works with either method allowed by the handoff. A curated
method still needs the exact feedback-set hash chosen during evaluation. The
control method receives no feedback. Both paths end with the same `complete`
progress event used by the current matching job.

Run the offline check with:

```bash
npm run irp:check-final-matcher-route-execution
```

The check runs both methods with fictional records. It also checks progress
events, route fields, input immutability and the failure path for a mismatched
configuration. Private feedback text and runtime metadata do not enter the
route result.

This service does not save results, send notifications or change the
production route. Those operations remain where they are now. The production
route can call this entry point after the real final handoff exists.
