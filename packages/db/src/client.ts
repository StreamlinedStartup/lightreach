import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "path";
import * as schema from "./schema";

const dbPath =
  process.env["DATABASE_URL"]?.replace("file:", "") ??
  path.join(process.cwd(), "data.db");

const sqlite = new Database(dbPath);

// WAL mode for better concurrent read performance
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite, { schema });

export type DB = typeof db;
