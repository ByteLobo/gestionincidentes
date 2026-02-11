import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  // Fail fast for API routes relying on DB if env is missing.
  console.warn("DATABASE_URL is not set; database calls will fail.");
}

export const db = new Pool({
  connectionString,
});
