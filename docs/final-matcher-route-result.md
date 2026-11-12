# Final matcher route result

The guarded matcher can now produce the same result object as the current investor-introductions route. The object contains `startupAirtableId`, `fundingRoundAirtableId` and `matches`. Each match keeps the investor, seven score fields, match reasons and AI insight already read by the interface.

The check runs the guarded matcher with fictional records, serialises the result to JSON and reads it back. It then rebuilds the same investor lookup used by the interface and checks score ordering, IDs and explanation fields. Runtime metadata such as the selected method and configuration hash stays outside the route response.

This code does not switch the production route. It gives that later change a small, tested bridge once the real handoff selects a method. Saved results and the current frontend can continue using their existing shape.
