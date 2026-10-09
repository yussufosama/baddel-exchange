import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { spawn } from "node:child_process";
import { PrismaClient } from "@prisma/client";
if (existsSync(".env")) loadEnvFile(".env");
if (!["demo", "live"].includes(process.env.APP_MODE || "demo"))
  throw new Error("APP_MODE must be demo or live.");
if ((process.env.SESSION_SECRET || "").length < 32)
  throw new Error("Run npm run setup or configure SESSION_SECRET.");
if (process.env.APP_MODE === "live") {
  if (!process.env.APP_URL?.startsWith("https://"))
    throw new Error("Live mode requires an HTTPS APP_URL.");
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)
    throw new Error(
      "Configure transactional email before enabling live verification.",
    );
  const db = new PrismaClient();
  const count = await db.merchant.count({ where: { provider: "demo" } });
  await db.$disconnect();
  if (count)
    throw new Error(
      "Live mode cannot run against seeded demo merchants. Use a new database.",
    );
}
const child = spawn(
  process.execPath,
  ["node_modules/@react-router/serve/bin.js", "build/server/index.js"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "production",
      HOST: process.env.APP_MODE === "live" ? "0.0.0.0" : "127.0.0.1",
      PORT: process.env.PORT || "3000",
    },
  },
);
child.on("exit", (code) => process.exit(code || 0));
process.on("SIGINT", () => child.kill());
process.on("SIGTERM", () => child.kill());
