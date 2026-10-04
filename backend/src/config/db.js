import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("❌ DATABASE_URL is not configured.");
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on("error", (error) => {
  console.error("❌ PostgreSQL Pool Error:", {
    message: error?.message || "Unknown database error",
    code: error?.code || "NO_CODE",
    name: error?.name || "UnknownError",
    detail: error?.detail || null,
    hint: error?.hint || null,
  });
});

pool.on("connect", () => {
  console.log("✅ PostgreSQL connection established");
});

export default pool;