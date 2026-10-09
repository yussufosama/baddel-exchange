import { PrismaClient } from "@prisma/client";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";
if (existsSync(resolve(".env"))) loadEnvFile(resolve(".env"));
process.env.DATABASE_URL ||= "file:../data/baddel.db";
const globalDb = globalThis as unknown as { baddelDb?: PrismaClient };
export const db = globalDb.baddelDb ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalDb.baddelDb = db;
export const demo = process.env.APP_MODE !== "live";
export const now = () => new Date();
export function fail(message: string, status = 400): never {
  throw new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
