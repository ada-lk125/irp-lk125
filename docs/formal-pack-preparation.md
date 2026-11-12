# Formal pack preparation

The formal handover now has one preparation command:

```bash
npm run irp:prepare-formal-blind-pack
```

The command first checks that `formal-v1` has not already been created and that all three private scored query files exist. It then writes the CSV and manifest to temporary `.local` paths, runs the full 3-query and 30-row validation, and promotes them to the formal filenames only when every check passes. A failed export or validation removes the temporary files.

An existing formal CSV or manifest stops the run. This keeps a handed-over batch frozen instead of silently replacing it with a different shuffle or hash.

The current checkout does not contain the three private scored inputs, so the command stops and lists the missing paths. The live Airtable and OpenAI variables are not loaded either. I did not replace the missing sources with fictional rows because Chuan's formal labels must refer to real baseline results.

Once the private query inputs and live environment are available, the baseline exports can be generated locally and passed through this command. The scored JSON, formal CSV and manifest remain under the ignored `exports/` directory and must be shared with Chuan through a private channel.
