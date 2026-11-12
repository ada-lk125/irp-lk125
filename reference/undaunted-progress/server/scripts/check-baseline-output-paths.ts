import path from "node:path";

type PathCheck = {
  label: string;
  path: string;
};

function getArgValue(name: string): string | undefined {
  const prefix = `${name}=`;
  const inline = process.argv.find(arg => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);

  const index = process.argv.indexOf(name);
  if (index >= 0) return process.argv[index + 1];
  return undefined;
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function checkLocalExportPath(filePath: string) {
  const exportsRoot = path.resolve("exports");
  const resolved = path.resolve(filePath);
  const relative = path.relative(exportsRoot, resolved);
  const insideExports = relative.length > 0 && !relative.startsWith("..") && !path.isAbsolute(relative);
  const localJson = path.basename(resolved).endsWith(".local.json");

  return {
    ok: insideExports && localJson,
    resolved,
    reason: insideExports
      ? localJson
        ? ""
        : "path must end with .local.json"
      : "path must stay inside exports/",
  };
}

function main() {
  const checks: PathCheck[] = [
    {
      label: "live export",
      path: getArgValue("--output") || "exports/baseline-live.local.json",
    },
    {
      label: "live summary",
      path: getArgValue("--summary") || "exports/baseline-live-summary.local.json",
    },
  ];
  const json = hasFlag("--json");
  const checked = checks.map(check => ({
    ...check,
    ...checkLocalExportPath(check.path),
  }));
  const invalid = checked.filter(check => !check.ok);
  const result = {
    ok: invalid.length === 0,
    checks: checked,
  };

  if (json) {
    console.log(JSON.stringify(result, null, 2));
  }

  if (invalid.length > 0) {
    if (!json) {
      console.error("Baseline output path check failed.");
      for (const check of invalid) {
        console.error(`- ${check.label}: ${check.path} (${check.reason})`);
      }
    }
    process.exitCode = 1;
    return;
  }

  if (json) return;

  console.log("Baseline output path check passed.");
  for (const check of checked) {
    console.log(`${check.label}: ${check.path}`);
  }
}

main();
