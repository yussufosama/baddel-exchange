import { randomInt } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve, basename, sep } from "node:path";
import sharp from "sharp";
import { z } from "zod";
import { db, demo, fail } from "../lib/db.server";
import {
  createSession,
  clearSession,
  requireStaff,
  requireOrder,
  checkOrigin,
  rateLimit,
  digest,
  passwordHash,
  checkPassword,
  session,
} from "../lib/security.server";
import {
  submitExchange,
  actOnExchange,
  requestDetail,
} from "../lib/exchanges.server";
import { eligible } from "../lib/domain";
import { processOutbox } from "../lib/mail.server";
function privatePhotoPath(value: string) {
  const directory = resolve("data", "uploads");
  const path = resolve(directory, value);
  if (!path.startsWith(directory + sep)) fail("Photo not found.", 404);
  return path;
}
const publicMerchant = (m: {
  id: string;
  slug: string;
  name: string;
  color: string;
  email: string;
  windowDays: number;
  shippingFee: number;
  evidenceRequired: boolean;
  provider: string;
}) => ({
  id: m.id,
  slug: m.slug,
  name: m.name,
  color: m.color,
  email: m.email,
  windowDays: m.windowDays,
  shippingFee: m.shippingFee,
  evidenceRequired: m.evidenceRequired,
  provider: m.provider,
});
const ok = (body: unknown, headers?: HeadersInit) =>
  Response.json(body, { headers: { "Cache-Control": "no-store", ...headers } });
async function json(request: Request) {
  const body = await boundedBody(request, 1024 * 100);
  try {
    return JSON.parse(Buffer.from(body).toString());
  } catch {
    fail("Invalid request body.");
  }
}
async function boundedBody(request: Request, max: number) {
  if (!request.body) fail("Missing request body.");
  const reader = request.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      fail("File or request is too large.", 413);
    }
    parts.push(value);
  }
  return Buffer.concat(parts);
}
function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    fail(parsed.error.issues[0]?.message || "Please check the fields.");
  return parsed.data;
}
async function getHandler(request: Request, path: string) {
  if (path.startsWith("brand/")) {
    const m = await db.merchant.findUnique({
      where: { slug: path.split("/")[1] },
    });
    if (!m) fail("Brand not found.", 404);
    return ok({ merchant: publicMerchant(m), demo });
  }
  if (path === "customer/order") {
    const s = await requireOrder(request);
    const order = await db.order.findFirst({
      where: { id: s.orderId!, merchantId: s.merchantId },
      include: {
        items: {
          include: {
            variant: { include: { product: { include: { variants: true } } } },
          },
        },
        requests: {
          orderBy: { createdAt: "desc" },
          select: { reference: true, status: true, createdAt: true },
        },
      },
    });
    if (!order) fail("Order not found.", 404);
    return ok({
      order,
      merchant: publicMerchant(s.merchant),
      demo,
      eligibility: order.items.map((i) => ({
        id: i.id,
        ...eligible(
          order.deliveredAt,
          s.merchant.windowDays,
          i.variant.product.excluded,
          i.quantity - i.committed,
        ),
      })),
    });
  }
  if (path.startsWith("customer/requests/")) {
    const s = await requireOrder(request);
    return ok({
      merchant: publicMerchant(s.merchant),
      demo,
      request: await requestDetail(
        s.merchantId,
        path.split("/")[2],
        s.orderId!,
      ),
    });
  }
  if (path.startsWith("attachments/")) {
    const id = path.split("/")[1];
    const file = await db.attachment.findUnique({ where: { id } });
    if (!file) fail("Photo not found.", 404);
    const s = await session(request);
    if (
      !s ||
      s.merchantId !== file.merchantId ||
      (!s.staffId && s.orderId !== file.orderId)
    )
      fail("Photo not found.", 404);
    return new Response(await readFile(privatePhotoPath(file.path)), {
      headers: {
        "Content-Type": file.mime,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  const s = await requireStaff(request);
  if (path === "dashboard") {
    const requests = await db.exchange.findMany({
      where: { merchantId: s.merchantId },
      include: {
        order: { select: { number: true, customerName: true } },
        events: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    });
    const notifications = await db.notification.findMany({
      where: { merchantId: s.merchantId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        subject: true,
        status: true,
        attempts: true,
        lastError: true,
        createdAt: true,
      },
    });
    return ok({
      merchant: publicMerchant(s.merchant),
      staff: { name: s.staff!.name, role: s.staff!.role },
      requests,
      notifications,
      demo,
    });
  }
  if (path.startsWith("requests/"))
    return ok({
      request: await requestDetail(s.merchantId, path.split("/")[1]),
    });
  if (path === "inventory")
    return ok({
      products: await db.product.findMany({
        where: { merchantId: s.merchantId },
        include: { variants: true },
        orderBy: { name: "asc" },
      }),
    });
  if (path === "orders")
    return ok({
      orders: await db.order.findMany({
        where: { merchantId: s.merchantId },
        include: {
          items: { include: { variant: { include: { product: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
    });
  if (path === "export") {
    const rows = await db.exchange.findMany({
      where: { merchantId: s.merchantId },
      include: { order: true },
      orderBy: { createdAt: "desc" },
    });
    const cell = (v: unknown) =>
      `"${String(v ?? "")
        .replace(/^[=+@\-\t\r]/, "'$&")
        .replaceAll('"', '""')}"`;
    const csv = [
      "Reference,Order,Customer,Status,Reason,Fee EGP,Payment,Created",
      ...rows.map((r) =>
        [
          r.reference,
          r.order.number,
          r.order.customerName,
          r.status,
          r.reason,
          (r.fee / 100).toFixed(2),
          r.feeStatus,
          r.createdAt.toISOString(),
        ]
          .map(cell)
          .join(","),
      ),
    ].join("\r\n");
    return new Response("\uFEFF" + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="baddel-exchanges.csv"',
        "Cache-Control": "no-store",
      },
    });
  }
  fail("Page not found.", 404);
}
async function postHandler(request: Request, path: string) {
  checkOrigin(request);
  if (path === "auth/logout")
    return ok({ ok: true }, { "Set-Cookie": await clearSession(request) });
  if (path === "auth/login") {
    const body = parse(
      z.object({
        email: z
          .string()
          .email()
          .transform((v) => v.toLowerCase().trim()),
        password: z.string().min(1).max(200),
      }),
      await json(request),
    );
    await rateLimit(`login:${body.email}`, 8, 900);
    await rateLimit("login:global", 100, 900);
    const staff = await db.staff.findUnique({ where: { email: body.email } });
    if (!staff || !checkPassword(body.password, staff.passwordHash))
      fail("Email or password is incorrect.", 401);
    return ok(
      { ok: true },
      {
        "Set-Cookie": await createSession(staff.merchantId, request, {
          staffId: staff.id,
        }),
      },
    );
  }
  if (path === "auth/register") {
    const body = parse(
      z.object({
        name: z.string().min(2).max(60),
        brand: z.string().min(2).max(60),
        slug: z
          .string()
          .regex(
            /^[a-z][a-z0-9-]{2,39}$/,
            "Use 3–40 lowercase letters, numbers, and hyphens for the portal address.",
          ),
        email: z
          .string()
          .email()
          .max(200)
          .transform((v) => v.toLowerCase().trim()),
        password: z
          .string()
          .min(12, "Use at least 12 characters for the password.")
          .max(100),
      }),
      await json(request),
    );
    await rateLimit("register:global", demo ? 100 : 10, 3600);
    const staff = await db.$transaction(async (tx) => {
      if (
        (await tx.staff.findUnique({ where: { email: body.email } })) ||
        (await tx.merchant.findUnique({ where: { slug: body.slug } }))
      )
        fail("That email or portal address is already registered.", 409);
      const m = await tx.merchant.create({
        data: {
          slug: body.slug,
          name: body.brand,
          email: body.email,
          provider: "manual",
        },
      });
      return tx.staff.create({
        data: {
          merchantId: m.id,
          name: body.name,
          email: body.email,
          passwordHash: passwordHash(body.password),
        },
      });
    });
    return ok(
      { ok: true },
      {
        "Set-Cookie": await createSession(staff.merchantId, request, {
          staffId: staff.id,
        }),
      },
    );
  }
  if (path === "customer/start") {
    const body = parse(
      z.object({
        slug: z.string(),
        number: z.string().min(1).max(30),
        email: z
          .string()
          .email()
          .max(200)
          .transform((v) => v.toLowerCase().trim()),
      }),
      await json(request),
    );
    await rateLimit(`verify:${body.slug}:${body.email}`, 5, 600);
    await rateLimit(`verify:brand:${body.slug}`, 80, 600);
    const m = await db.merchant.findUnique({ where: { slug: body.slug } });
    if (!m) fail("Brand not found.", 404);
    const order = await db.order.findFirst({
      where: {
        merchantId: m.id,
        number: body.number.replace(/^#/, ""),
        email: body.email,
      },
    });
    const code = String(randomInt(100000, 1000000));
    const c = await db.challenge.create({
      data: {
        merchantId: m.id,
        orderId: order?.id,
        codeHash: digest(code),
        expiresAt: new Date(Date.now() + 600000),
      },
    });
    if (order)
      await db.notification.create({
        data: {
          merchantId: m.id,
          recipient: order.email,
          subject: "Your Baddel verification code",
          body: `Your code is ${code}. It expires in 10 minutes. Do not share it.`,
        },
      });
    return ok({
      challengeId: c.id,
      message:
        "If these details match an order, a verification code will be sent.",
      ...(demo ? { demoCode: order ? code : undefined } : {}),
    });
  }
  if (path === "customer/verify") {
    const body = parse(
      z.object({
        challengeId: z.string().max(80),
        code: z.string().regex(/^\d{6}$/),
      }),
      await json(request),
    );
    const c = await db.challenge.findUnique({
      where: { id: body.challengeId },
    });
    if (!c || c.consumed || c.expiresAt < new Date() || c.attempts >= 5)
      fail("This code has expired. Request another code.", 401);
    await db.challenge.update({
      where: { id: c.id },
      data: { attempts: { increment: 1 } },
    });
    if (c.codeHash !== digest(body.code) || !c.orderId)
      fail("The code is incorrect.", 401);
    const used = await db.challenge.updateMany({
      where: { id: c.id, consumed: false, attempts: { lte: 5 } },
      data: { consumed: true },
    });
    if (!used.count) fail("Code already used.", 401);
    return ok(
      { ok: true },
      {
        "Set-Cookie": await createSession(c.merchantId, request, {
          orderId: c.orderId,
        }),
      },
    );
  }
  if (path === "customer/requests") {
    const s = await requireOrder(request);
    return ok({
      request: await submitExchange(
        s.merchantId,
        s.orderId!,
        await json(request),
      ),
    });
  }
  if (path === "customer/upload") {
    const s = await requireOrder(request);
    await rateLimit(`upload:${s.id}`, 12, 3600);
    const data = await boundedBody(request, 6 * 1024 * 1024);
    const form = await new Request(request.url, {
      method: "POST",
      headers: { "Content-Type": request.headers.get("Content-Type") || "" },
      body: data,
    }).formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size > 5 * 1024 * 1024 || file.size < 1)
      fail("Upload a JPG, PNG, or WebP photo up to 5 MB.");
    let image: Buffer;
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const metadata = await sharp(buffer, {
        limitInputPixels: 24000000,
      }).metadata();
      if (!["jpeg", "png", "webp"].includes(metadata.format || ""))
        fail("Only JPG, PNG, and WebP photos are accepted.");
      image = await sharp(buffer, { limitInputPixels: 24000000 })
        .rotate()
        .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
    } catch (error) {
      if (error instanceof Response) throw error;
      fail("This is not a valid photo.");
    }
    const dir = resolve("data", "uploads");
    await mkdir(dir, { recursive: true });
    const path = resolve(dir, `${crypto.randomUUID()}.jpg`);
    await writeFile(path, image);
    const a = await db.attachment.create({
      data: {
        merchantId: s.merchantId,
        orderId: s.orderId!,
        path: basename(path),
        mime: "image/jpeg",
        size: image.length,
      },
    });
    return ok({ attachment: { id: a.id, url: `/api/attachments/${a.id}` } });
  }
  const s = await requireStaff(request);
  if (path.startsWith("requests/"))
    return ok({
      request: await actOnExchange(
        s.merchantId,
        path.split("/")[1],
        s.staff!.name,
        await json(request),
      ),
    });
  if (path === "notifications/process")
    return ok(await processOutbox(s.merchantId));
  if (path === "settings") {
    if (s.staff!.role !== "owner")
      fail("Only the owner can change settings.", 403);
    const body = parse(
      z.object({
        name: z.string().min(2).max(60),
        email: z.string().email().max(200),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        windowDays: z.number().int().min(1).max(90),
        shippingFee: z.number().int().min(0).max(100000),
        evidenceRequired: z.boolean(),
      }),
      await json(request),
    );
    await db.$transaction([
      db.merchant.update({ where: { id: s.merchantId }, data: body }),
      db.event.create({
        data: {
          merchantId: s.merchantId,
          actor: s.staff!.name,
          type: "settings",
          message:
            "Brand exchange policy updated. Existing request snapshots remain unchanged.",
        },
      }),
    ]);
    return ok({ ok: true });
  }
  if (path === "inventory") {
    const body = parse(
      z.object({
        name: z.string().min(2).max(80),
        nameAr: z.string().max(100).default(""),
        price: z.number().int().min(1).max(10000000),
        color: z.string().min(1).max(30),
        sizes: z.array(z.string().min(1).max(12)).min(2).max(12),
        stock: z.number().int().min(0).max(100000),
      }),
      await json(request),
    );
    if (new Set(body.sizes).size !== body.sizes.length)
      fail("Sizes must be unique.");
    const product = await db.product.create({
      data: {
        merchantId: s.merchantId,
        name: body.name,
        nameAr: body.nameAr || body.name,
        image: "/products/tee.svg",
        variants: {
          create: body.sizes.map((size) => ({
            size,
            color: body.color,
            price: body.price,
            stock: body.stock,
          })),
        },
      },
    });
    return ok({ product });
  }
  if (path.startsWith("inventory/")) {
    const body = parse(
      z.object({ stock: z.number().int().min(0).max(100000) }),
      await json(request),
    );
    const id = path.split("/")[1];
    const updated = await db.variant.updateMany({
      where: { id, product: { merchantId: s.merchantId } },
      data: body,
    });
    if (!updated.count) fail("Variant not found.", 404);
    return ok({ ok: true });
  }
  if (path === "orders") {
    const body = parse(
      z.object({
        number: z.string().regex(/^[A-Za-z0-9-]{1,30}$/),
        customerName: z.string().min(2).max(80),
        email: z
          .string()
          .email()
          .max(200)
          .transform((v) => v.toLowerCase().trim()),
        phone: z.string().regex(/^\+?\d[\d\s-]{7,19}$/),
        address: z.string().min(5).max(300),
        deliveredAt: z.string().datetime(),
        variantId: z.string(),
        quantity: z.number().int().min(1).max(10),
        paidPrice: z.number().int().min(1).max(10000000),
      }),
      await json(request),
    );
    if (new Date(body.deliveredAt) > new Date())
      fail("Delivery date cannot be in the future.");
    const variant = await db.variant.findFirst({
      where: { id: body.variantId, product: { merchantId: s.merchantId } },
    });
    if (!variant) fail("Variant not found.", 404);
    if (
      await db.order.findUnique({
        where: {
          merchantId_number: { merchantId: s.merchantId, number: body.number },
        },
      })
    )
      fail("That order number already exists.", 409);
    const { variantId, quantity, paidPrice, ...order } = body;
    const result = await db.order.create({
      data: {
        ...order,
        deliveredAt: new Date(body.deliveredAt),
        merchantId: s.merchantId,
        items: { create: { variantId, quantity, paidPrice } },
      },
    });
    return ok({ order: result });
  }
  fail("Action not found.", 404);
}
async function handle(request: Request, path: string) {
  try {
    return request.method === "GET"
      ? await getHandler(request, path)
      : await postHandler(request, path);
  } catch (error) {
    if (error instanceof Response) {
      const headers = new Headers(error.headers);
      headers.set("Cache-Control", "no-store");
      return new Response(error.body, { status: error.status, headers });
    }
    if (error instanceof z.ZodError)
      return ok({ error: "Please check your entries." });
    console.error(
      "API error:",
      error instanceof Error ? error.message : "unknown",
    );
    return Response.json(
      { error: "We could not complete this action. Please try again." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
export async function loader({
  request,
  params,
}: {
  request: Request;
  params: Record<string, string | undefined>;
}) {
  return handle(request, params["*"] || "");
}
export async function action({
  request,
  params,
}: {
  request: Request;
  params: Record<string, string | undefined>;
}) {
  if (request.method !== "POST")
    return new Response("Method not allowed", { status: 405 });
  return handle(request, params["*"] || "");
}
