import { mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { spawnSync } from "node:child_process";
export default function setup() {
  mkdirSync("data", { recursive: true });
  const local = new DatabaseSync("data/rules-test.db");
  local.close();
  const result = spawnSync(
    process.execPath,
    ["node_modules/prisma/build/index.js", "migrate", "deploy"],
    {
      env: { ...process.env, DATABASE_URL: "file:../data/rules-test.db" },
      encoding: "utf8",
    },
  );
  if (result.status !== 0) throw new Error(result.stdout + result.stderr);
}
