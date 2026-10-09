import {
  randomBytes,
  createHash,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { createCookie } from "react-router";
import { db, demo, fail } from "./db.server";
const secret = process.env.SESSION_SECRET;
if (!secret || secret.length < 32)
  throw new Error(
    "Run npm run setup first: SESSION_SECRET must have at least 32 characters.",
  );
const cookie = createCookie("baddel_session", {
  httpOnly: true,
  sameSite: "lax",
  secure: !demo,
  path: "/",
  maxAge: 60 * 60 * 12,
  secrets: [secret],
});
export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const token = () => randomBytes(32).toString("hex");
export function passwordHash(value: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(value, salt, 64).toString("hex")}`;
}
export function checkPassword(value: string, stored: string) {
  const [salt, hash] = stored.split(":");
  const candidate = scryptSync(value, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return (
    expected.length === candidate.length && timingSafeEqual(candidate, expected)
  );
}
export async function session(request: Request) {
  const raw = await cookie.parse(request.headers.get("Cookie"));
  if (typeof raw !== "string") return null;
  const s = await db.session.findUnique({
    where: { id: digest(raw) },
    include: { staff: true, merchant: true },
  });
  return s && s.expiresAt > new Date() ? s : null;
}
export async function createSession(
  merchantId: string,
  request: Request,
  extra: { staffId?: string; orderId?: string },
) {
  const old = await session(request);
  if (old) await db.session.deleteMany({ where: { id: old.id } });
  const raw = token();
  await db.session.create({
    data: {
      id: digest(raw),
      merchantId,
      ...extra,
      expiresAt: new Date(Date.now() + 12 * 3600000),
    },
  });
  return cookie.serialize(raw);
}
export async function clearSession(request: Request) {
  const s = await session(request);
  if (s) await db.session.deleteMany({ where: { id: s.id } });
  return cookie.serialize("", { maxAge: 0 });
}
export async function requireStaff(request: Request) {
  const s = await session(request);
  if (!s?.staff || s.staff.merchantId !== s.merchantId)
    fail("Please sign in to your brand dashboard.", 401);
  return s;
}
export async function requireOrder(request: Request, merchantId?: string) {
  const s = await session(request);
  if (!s?.orderId || s.staffId || (merchantId && s.merchantId !== merchantId))
    fail("Verify your order to continue.", 401);
  return s;
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("Origin");
  const expected = new URL(process.env.APP_URL || request.url).origin;
  if (
    !origin ||
    (origin !== expected &&
      !(
        demo &&
        [
          "http://localhost:5173",
          "http://127.0.0.1:5173",
          "http://localhost:3000",
          "http://127.0.0.1:3000",
        ].includes(origin)
      ))
  )
    fail("This request did not come from the application.", 403);
}
export async function rateLimit(key: string, max: number, seconds: number) {
  const id = digest(key);
  const time = new Date();
  const existing = await db.rateLimit.findUnique({ where: { id } });
  if (existing && existing.expiresAt > time) {
    const updated = await db.rateLimit.update({
      where: { id },
      data: { count: { increment: 1 } },
    });
    if (updated.count > max)
      fail("Too many attempts. Please try again later.", 429);
  } else {
    await db.rateLimit.upsert({
      where: { id },
      create: {
        id,
        count: 1,
        expiresAt: new Date(Date.now() + seconds * 1000),
      },
      update: { count: 1, expiresAt: new Date(Date.now() + seconds * 1000) },
    });
  }
}
