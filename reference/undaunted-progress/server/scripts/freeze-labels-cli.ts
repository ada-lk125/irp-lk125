import { freezeLabels, type FreezeLabelsArgs } from "../services/label-freeze";

function optionalArg(args: string[], name: string): string | undefined {
  const inline = args.find(arg => arg.startsWith(`${name}=`));
  if (inline) {
    const value = inline.slice(name.length + 1);
    if (!value) throw new Error(`${name} needs a value.`);
    return value;
  }
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} needs a value.`);
  }
  return value;
}

function requiredArg(args: string[], name: string): string {
  const value = optionalArg(args, name);
  if (!value) throw new Error(`${name} needs a value.`);
  return value;
}

export async function runFreezeLabelsCli(args: {
  purpose: FreezeLabelsArgs["purpose"];
  label: string;
  expectedRowsPerQuery?: number;
}) {
  try {
    const cliArgs = process.argv.slice(2);
    const result = await freezeLabels({
      purpose: args.purpose,
      workingDirectory: process.cwd(),
      sourcePath: requiredArg(cliArgs, "--source"),
      sourceManifestPath: requiredArg(cliArgs, "--source-manifest"),
      labelledPath: requiredArg(cliArgs, "--labelled"),
      outputPath: requiredArg(cliArgs, "--output"),
      manifestPath: requiredArg(cliArgs, "--manifest"),
      frozenVersion: requiredArg(cliArgs, "--frozen-version"),
      frozenAt: optionalArg(cliArgs, "--frozen-at") || new Date().toISOString(),
      expectedQueryCount: 3,
      expectedRowsPerQuery: args.expectedRowsPerQuery,
    });

    console.log(`${args.label} labels frozen successfully.`);
    console.log(
      `Rows: ${result.manifest.rowCount}; queries: ${result.manifest.queryCount}.`,
    );
    console.log(`Labelled CSV SHA-256: ${result.manifest.sha256}`);
    console.log(`Source pack SHA-256: ${result.manifest.sourcePackSha256}`);
    console.log(`- ${result.outputPath}`);
    console.log(`- ${result.manifestPath}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${args.label} label freeze failed: ${message}`);
    process.exitCode = 1;
  }
}
