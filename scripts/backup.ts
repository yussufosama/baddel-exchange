import { loadEnvFile } from "node:process";
import { DatabaseSync, backup } from "node:sqlite";
import { existsSync } from "node:fs";
import { mkdir, cp, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
if (existsSync(".env")) loadEnvFile(".env");
const url = process.env.DATABASE_URL || "file:../data/baddel.db";
if (!url.startsWith("file:"))
  throw new Error("For PostgreSQL use a managed backup or pg_dump.");
const source = resolve("prisma", url.slice(5));
const folder = resolve(
  "backups",
  new Date().toISOString().replaceAll(":", "-"),
);
await mkdir(folder, { recursive: true });
const database = new DatabaseSync(source, { readOnly: true });
await backup(database, resolve(folder, "baddel.db"));
database.close();
if (existsSync("data/uploads"))
  await cp("data/uploads", resolve(folder, "uploads"), { recursive: true });
const file = await readFile(resolve(folder, "baddel.db"));
const restored = new DatabaseSync(resolve(folder, "baddel.db"), {
  readOnly: true,
});
const integrity = restored.prepare("PRAGMA integrity_check").get();
const foreignKeys = restored.prepare("PRAGMA foreign_key_check").all();
const counts = {
  merchants: restored.prepare("SELECT COUNT(*) AS count FROM Merchant").get(),
  requests: restored.prepare("SELECT COUNT(*) AS count FROM Exchange").get(),
  events: restored.prepare("SELECT COUNT(*) AS count FROM Event").get(),
};
restored.close();
await writeFile(
  resolve(folder, "manifest.json"),
  JSON.stringify(
    {
      createdAt: new Date().toISOString(),
      sha256: createHash("sha256").update(file).digest("hex"),
      integrity,
      foreignKeys,
      counts,
      note: "Database snapshot and private uploads. Keep SESSION_SECRET separately. Pause writes for a fully coordinated database/photo restore.",
    },
    null,
    2,
  ),
);
if (foreignKeys.length)
  throw new Error("Backup foreign key validation failed.");
if (!integrity || Object.values(integrity)[0] !== "ok")
  throw new Error("Backup integrity validation failed.");
console.log(`Verified backup written to ${folder}`);
