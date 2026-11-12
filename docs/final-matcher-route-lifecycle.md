# Final matcher route lifecycle

The guarded matcher now covers the same order used by the current investor
introduction route. It validates and runs the selected matcher, attempts to
save the result, sends the `complete` progress event, and then attempts the
new-match notification.

Saving and notification are supplied as route dependencies. This keeps
database and notification code outside the matching service, while still
testing their place in the request flow. A failed save or notification is
reported through `onEffectError`; the valid match result remains available,
which matches the current route's non-fatal handling of these side effects.
Matcher or handoff failures stop before either side effect runs.

Run the offline check with:

```bash
npm run irp:check-final-matcher-route-lifecycle
```

The check uses fictional records. It verifies the
`save -> complete -> notify` order, one completion event, unchanged route
fields, input immutability, non-fatal side-effect errors, and rejection before
side effects when the matching configuration does not match the handoff.

The production route has not switched to this lifecycle. That change still
needs the real frozen metrics, error review and approved final matcher
handoff.
