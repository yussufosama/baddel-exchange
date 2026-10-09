import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
mkdirSync("data", { recursive: true });
if (!existsSync(".env"))
  writeFileSync(
    ".env",
    readFileSync(".env.example", "utf8").replace(
      "SESSION_SECRET=",
      `SESSION_SECRET=${randomBytes(48).toString("hex")}`,
    ),
  );
if (!existsSync("data/baddel.db")) {
  const db = new DatabaseSync("data/baddel.db");
  db.close();
}
console.log(
  "Local configuration ready. Run npm run db:generate then npm run db:setup.",
);
