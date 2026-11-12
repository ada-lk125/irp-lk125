# Final submission check

The repository-level check looks at the submitted structure before any
TypeScript dependencies are loaded. It confirms that the project plan,
meeting record, daily notes, baseline matcher, current matcher, standalone
interface and its integration test are tracked. It also checks every package
script target that names a local Node or TypeScript file and every local
Markdown link.

Run it from the repository root:

```bash
node scripts/check-final-submission.mjs
```

The check rejects private `.local` files, generated algorithm exports,
credential files, likely API tokens and tracked files larger than 20 MiB. It
also confirms that the saved baseline matcher and current matcher are
different files, so the repository keeps both the starting point and the
implemented development path.

This command checks the Git submission itself. The implementation checks are
separate:

```bash
cd reference/undaunted-progress
npm ci
npm run irp:check-final-project-readiness
```

The progress snapshot is the runnable algorithm, evaluation workspace and
fictional-data demonstration. It does not duplicate the authenticated shared
Undaunted application or its private Replit environment.
