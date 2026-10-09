import { mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { spawnSync, spawn } from "node:child_process";
import { resolve } from "node:path";
const url = process.env.DATABASE_URL || "file:../data/baddel.db";
if (!url.startsWith("file:"))
  throw new Error(
    "This MVP image uses SQLite. PostgreSQL requires a separate migration and generated Prisma client.",
  );
mkdirSync(resolve("data"), { recursive: true });
const db = new DatabaseSync(resolve("prisma", url.slice(5)));
db.close();
const migrated = spawnSync(
  process.execPath,
  ["node_modules/prisma/build/index.js", "migrate", "deploy"],
  { stdio: "inherit", env: process.env },
);
if (migrated.status !== 0) process.exit(migrated.status || 1);
const child = spawn(process.execPath, ["scripts/start.mjs"], {
  stdio: "inherit",
  env: process.env,
});
child.on("exit", (code) => process.exit(code || 0));
process.on("SIGINT", () => child.kill());
process.on("SIGTERM", () => child.kill());
