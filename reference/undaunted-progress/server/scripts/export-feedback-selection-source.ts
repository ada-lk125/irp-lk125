import pg from "pg";
import {
  buildFeedbackSelectionSource,
  writeFeedbackSelectionSource,
  type MatchFeedbackSourceRow,
} from "../services/feedback-selection-source";

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL must be set.");
}
const pool = new Pool({ connectionString: databaseUrl });

function getArgValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} needs a value.`);
  }
  return value;
}

async function readMatchFeedback(): Promise<MatchFeedbackSourceRow[]> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const result = await client.query<{
      id: number;
      investor_id: string;
      investor_name: string | null;
      funding_round_id: string;
      startup_name: string | null;
      rating: string;
      reason: string | null;
      created_at: Date | null;
    }>(`
      SELECT
        id,
        investor_airtable_id AS investor_id,
        investor_name,
        funding_round_airtable_id AS funding_round_id,
        startup_name,
        rating,
        reason,
        created_at
      FROM match_feedback
      ORDER BY created_at DESC NULLS LAST, id ASC
    `);
    await client.query("COMMIT");
    return result.rows.map((row) => ({
      id: row.id,
      investorId: row.investor_id,
      investorName: row.investor_name,
      fundingRoundId: row.funding_round_id,
      startupName: row.startup_name,
      rating: row.rating,
      reason: row.reason,
      createdAt: row.created_at,
    }));
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original read failure.
    }
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const output =
    getArgValue(args, "--output") ??
    "exports/feedback-selection-source.local.json";
  const createdAt = getArgValue(args, "--created-at");
  const rows = await readMatchFeedback();
  const source = buildFeedbackSelectionSource({ rows, createdAt });
  const written = await writeFeedbackSelectionSource({
    source,
    filePath: output,
  });

  console.log(`Wrote private read-only feedback source: ${written}`);
  console.log(`Source rows: ${source.summary.sourceCount}`);
  console.log(`Eligible human reasons: ${source.summary.eligibleCount}`);
  console.log(
    `Eligible balance: ${source.summary.eligibleUpCount} up / ${source.summary.eligibleDownCount} down`,
  );
  console.log(`Rows without reasons: ${source.summary.missingReasonCount}`);
}

main()
  .catch((error) => {
    console.error(
      `Feedback selection source export failed: ${
        error instanceof Error ? error.message : error
      }`,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
