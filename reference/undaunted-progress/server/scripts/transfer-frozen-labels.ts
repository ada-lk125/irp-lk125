import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { serialiseBlindCsv } from "../services/blind-labelling-csv";
import { parseBlindLabellingCsv } from "../services/blind-labelling-file";
import { sha256Text } from "../services/blind-labelling-manifest";
import { validateFrozenLabellingRows } from "../services/frozen-labelling";
import { parseFrozenLabelManifest } from "../services/frozen-labelling-manifest";
import { transferFrozenJudgements } from "../services/frozen-label-transfer";
import { validateSourcePackManifest } from "../services/label-freeze";

function values(args: string[], name: string): string[] {
  const result: string[] = [];
  const prefix = `${name}=`;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg.startsWith(prefix)) {
      const value = arg.slice(prefix.length);
      if (!value) throw new Error(`${name} needs a value.`);
      result.push(value);
    } else if (arg === name) {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${name} needs a value.`);
      }
      result.push(value);
      index += 1;
    }
  }
  return result;
}

function one(args: string[], name: string): string {
  const found = values(args, name);
  if (found.length !== 1) {
    throw new Error(`${name} must be provided exactly once.`);
  }
  return found[0];
}

async function protectedOutput(filePath: string): Promise<string> {
  const exportsRoot = path.resolve("exports");
  const resolved = path.resolve(filePath);
  const relative = path.relative(exportsRoot, resolved);
  if (
    relative.length === 0
    || relative.startsWith("..")
    || path.isAbsolute(relative)
    || !path.basename(resolved).endsWith(".local.csv")
  ) {
    throw new Error("Output must stay inside exports/ and end with .local.csv.");
  }
  try {
    await access(resolved);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return resolved;
    throw error;
  }
  throw new Error(`Output already exists and will not be overwritten: ${filePath}`);
}

async function main() {
  const args = process.argv.slice(2);
  const sourcePath = one(args, "--source");
  const sourceManifestPath = one(args, "--source-manifest");
  const labelPaths = values(args, "--labels");
  const labelManifestPaths = values(args, "--label-manifest");
  if (labelPaths.length === 0 || labelPaths.length !== labelManifestPaths.length) {
    throw new Error("Provide one --label-manifest for every --labels file.");
  }
  const outputPath = await protectedOutput(one(args, "--output"));
  const [sourceCsv, sourceManifestText] = await Promise.all([
    readFile(sourcePath, "utf8"),
    readFile(sourceManifestPath, "utf8"),
  ]);
  const source = validateSourcePackManifest({
    raw: JSON.parse(sourceManifestText) as unknown,
    csv: sourceCsv,
    sourcePath,
    expectedPurpose: "supplementary",
  });

  const frozenLabelSets = [];
  for (let index = 0; index < labelPaths.length; index += 1) {
    const [csv, manifestText] = await Promise.all([
      readFile(labelPaths[index], "utf8"),
      readFile(labelManifestPaths[index], "utf8"),
    ]);
    const rows = parseBlindLabellingCsv(csv, path.basename(labelPaths[index]));
    const validation = validateFrozenLabellingRows(rows);
    if (validation.errors.length > 0) {
      throw new Error(validation.errors.join("\n"));
    }
    parseFrozenLabelManifest(JSON.parse(manifestText), {
      csv,
      fileName: path.basename(labelPaths[index]),
      summary: validation.summary,
    });
    frozenLabelSets.push({
      label: path.basename(labelPaths[index]),
      rows,
    });
  }

  const labelledRows = transferFrozenJudgements({
    sourceRows: source.rows,
    frozenLabelSets,
  });
  const csv = serialiseBlindCsv(labelledRows);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, csv, { encoding: "utf8", flag: "wx" });
  console.log(`Transferred ${labelledRows.length} verified judgements.`);
  console.log(`Output SHA-256: ${sha256Text(csv)}`);
  console.log(`- ${outputPath}`);
}

main().catch((error: Error) => {
  console.error(`Frozen label transfer failed: ${error.message}`);
  process.exitCode = 1;
});
