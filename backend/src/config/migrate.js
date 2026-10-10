import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import pool from "./db.js";

const __dirname = path.dirname(
  fileURLToPath(import.meta.url)
);

/*
 * v6.1 — automatic migration runner.
 *
 * On every backend boot, applies any SQL migration files in
 * ./migrations that have not been applied yet, tracked in the
 * schema_migrations table.
 *
 * All migration files are written idempotently
 * (IF NOT EXISTS), so re-running is always safe.
 *
 * This removes the need to hand-run migrations in the
 * Neon SQL editor after each deploy.
 */
export async function runMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const dir = path.join(__dirname, "migrations");

  if (!fs.existsSync(dir)) {
    console.log("[migrate] no migrations directory, skipping");
    return;
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const done = await pool.query(
      "SELECT 1 FROM schema_migrations WHERE name = $1",
      [file]
    );

    if (done.rows.length > 0) continue;

    console.log(`[migrate] applying ${file} ...`);
    const sql = fs.readFileSync(
      path.join(dir, file),
      "utf8"
    );
    await pool.query(sql);
    await pool.query(
      "INSERT INTO schema_migrations (name) VALUES ($1)",
      [file]
    );
    console.log(`[migrate] applied ${file}`);
  }

  console.log("[migrate] all migrations up to date");
}
