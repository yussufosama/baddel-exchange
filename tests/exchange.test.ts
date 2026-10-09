import { describe, it, expect, afterAll, vi } from "vitest";
import { db } from "../app/lib/db.server";
import {
  submitExchange,
  actOnExchange,
  requestDetail,
} from "../app/lib/exchanges.server";
import { eligible } from "../app/lib/domain";
import {
  createSession,
  requireStaff,
  requireOrder,
  passwordHash,
  checkPassword,
  checkOrigin,
  rateLimit,
} from "../app/lib/security.server";
import { loader, action } from "../app/routes/api";
import { deliverEmail, processOutbox } from "../app/lib/mail.server";
import sharp from "sharp";
async function fixture(quantity = 1, stock = 5, days = 2) {
  const merchant = await db.merchant.create({
    data: {
      name: "Test brand",
      slug: `test-${crypto.randomUUID()}`,
      email: "brand@example.com",
      shippingFee: 6035,
    },
  });
  const product = await db.product.create({
    data: {
      merchantId: merchant.id,
      name: "Tee",
      nameAr: "تيشيرت",
      image: "/products/tee.svg",
      variants: {
        create: [
          { size: "M", color: "Black", price: 80000, stock: 5 },
          { size: "L", color: "Black", price: 80000, stock },
          { size: "XL", color: "Black", price: 80000, stock: 0 },
          { size: "S", color: "Black", price: 90000, stock: 5 },
        ],
      },
    },
    include: { variants: true },
  });
  const order = await db.order.create({
    data: {
      merchantId: merchant.id,
      number: "1001",
      customerName: "Test Customer",
      email: "customer@example.com",
      phone: "01012345678",
      address: "Cairo address",
      deliveredAt: new Date(Date.now() - days * 86400000),
      items: {
        create: {
          variantId: product.variants.find((v) => v.size === "M")!.id,
          quantity,
          paidPrice: 65000,
        },
      },
    },
    include: { items: true },
  });
  return {
    merchant,
    product,
    order,
    item: order.items[0],
    replacement: product.variants.find((v) => v.size === "L")!,
  };
}
async function submitted(
  f: Awaited<ReturnType<typeof fixture>>,
  extra: Record<string, unknown> = {},
) {
  return submitExchange(f.merchant.id, f.order.id, {
    itemId: f.item.id,
    replacementId: f.replacement.id,
    reason: "size_small",
    consent: true,
    quote: {
      shippingFee: f.merchant.shippingFee,
      windowDays: f.merchant.windowDays,
      evidenceRequired: f.merchant.evidenceRequired,
    },
    idempotencyKey: crypto.randomUUID(),
    ...extra,
  });
}
async function error(promise: Promise<unknown>, status = 400) {
  try {
    await promise;
    throw new Error("Expected rejection");
  } catch (e) {
    expect(e).toBeInstanceOf(Response);
    expect((e as Response).status).toBe(status);
  }
}
const request = (
  path: string,
  cookie = "",
  body?: unknown,
  origin = "http://localhost:5173",
) =>
  new Request(`http://localhost:5173/api/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Cookie: cookie,
      ...(body === undefined
        ? {}
        : { "Content-Type": "application/json", Origin: origin }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
const cookiePair = (header: string) => header.split(";")[0];
describe("Eligibility", () => {
  it("rejects undelivered, future, expired, excluded, and committed items", () => {
    expect(eligible(null, 14).ok).toBe(false);
    expect(eligible(new Date(Date.now() + 1000), 14).ok).toBe(false);
    expect(eligible(new Date(Date.now() - 15 * 86400000), 14).ok).toBe(false);
    expect(eligible(new Date(), 14, true).ok).toBe(false);
    expect(eligible(new Date(), 14, false, 0).ok).toBe(false);
    expect(eligible(new Date(), 14).ok).toBe(true);
  });
});
describe("Exchange submission", () => {
  it("requires renewed consent when a merchant changes the displayed fee", async () => {
    const f = await fixture();
    await db.merchant.update({
      where: { id: f.merchant.id },
      data: { shippingFee: 9035 },
    });
    await error(submitted(f), 409);
    expect(await db.exchange.count({ where: { orderId: f.order.id } })).toBe(0);
    expect(
      (await db.orderItem.findUniqueOrThrow({ where: { id: f.item.id } }))
        .committed,
    ).toBe(0);
  });
  it("preserves discounted paid price, exact fees, policy, and quantity", async () => {
    const f = await fixture(2);
    const r = await submitted(f, { quantity: 2 });
    expect(JSON.parse(r.itemSnapshot).price).toBe(65000);
    expect(r.fee).toBe(6035);
    expect(JSON.parse(r.policySnapshot).shippingFee).toBe(6035);
    expect(
      (await db.orderItem.findUniqueOrThrow({ where: { id: f.item.id } }))
        .committed,
    ).toBe(2);
  });
  it("makes retrying the same submission idempotent", async () => {
    const f = await fixture();
    const key = crypto.randomUUID();
    const a = await submitted(f, { idempotencyKey: key });
    const b = await submitted(f, { idempotencyKey: key });
    expect(a.id).toBe(b.id);
    expect(await db.exchange.count({ where: { orderId: f.order.id } })).toBe(1);
  });
  it("blocks duplicate requests with a new key", async () => {
    const f = await fixture();
    await submitted(f);
    await error(submitted(f));
  });
  it("blocks quantities above the remaining purchase", async () => {
    const f = await fixture();
    await error(submitted(f, { quantity: 2 }));
  });
  it("rejects expired orders server side", async () => {
    await error(submitted(await fixture(1, 5, 30)));
  });
  it("rejects unavailable variants", async () => {
    const f = await fixture(1, 0);
    await error(submitted(f), 409);
  });
  it("rejects same variant and price-changing variants", async () => {
    const f = await fixture();
    await error(submitted(f, { replacementId: f.item.variantId }));
    await error(
      submitted(f, {
        replacementId: f.product.variants.find((v) => v.size === "S")!.id,
      }),
    );
  });
  it("requires evidence for damaged items", async () => {
    const f = await fixture();
    await error(submitted(f, { reason: "damaged" }));
  });
  it("rejects attachments and replacement variants from another merchant", async () => {
    const f = await fixture();
    const other = await fixture();
    const attachment = await db.attachment.create({
      data: {
        merchantId: other.merchant.id,
        orderId: other.order.id,
        path: "test",
        mime: "image/jpeg",
        size: 10,
      },
    });
    await error(submitted(f, { attachments: [attachment.id] }));
    await error(submitted(f, { replacementId: other.replacement.id }));
  });
  it("does not change request terms when policy changes", async () => {
    const f = await fixture();
    const r = await submitted(f);
    await db.merchant.update({
      where: { id: f.merchant.id },
      data: { shippingFee: 99999, windowDays: 1 },
    });
    const persisted = await db.exchange.findUniqueOrThrow({
      where: { id: r.id },
    });
    expect(persisted.fee).toBe(6035);
    expect(JSON.parse(persisted.policySnapshot).windowDays).toBe(14);
  });
});
describe("Workflow and inventory", () => {
  it("allocates the last replacement unit to only one concurrent approval", async () => {
    const f = await fixture(1, 1);
    const second = await db.order.create({
      data: {
        merchantId: f.merchant.id,
        number: "1002",
        customerName: "Second Customer",
        email: "second@example.com",
        phone: "01012345678",
        address: "Cairo address",
        deliveredAt: new Date(),
        items: {
          create: {
            variantId: f.item.variantId,
            quantity: 1,
            paidPrice: 80000,
          },
        },
      },
      include: { items: true },
    });
    const a = await submitted(f);
    const b = await submitted({ ...f, order: second, item: second.items[0] });
    const results = await Promise.allSettled([
      actOnExchange(f.merchant.id, a.reference, "Owner", {
        action: "approve",
        version: 0,
      }),
      actOnExchange(f.merchant.id, b.reference, "Owner", {
        action: "approve",
        version: 0,
      }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      (await db.variant.findUniqueOrThrow({ where: { id: f.replacement.id } }))
        .stock,
    ).toBe(0);
    expect(
      await db.exchange.count({
        where: { merchantId: f.merchant.id, status: "approved" },
      }),
    ).toBe(1);
  });
  it("completes collection, inspection, dispatch, payment and delivery", async () => {
    const f = await fixture();
    let r = await submitted(f);
    const act = async (action: string, extra: Record<string, unknown> = {}) =>
      (r = await actOnExchange(f.merchant.id, r.reference, "Owner", {
        action,
        version: r.version,
        ...extra,
      }));
    await act("approve");
    expect(
      (await db.variant.findUniqueOrThrow({ where: { id: f.replacement.id } }))
        .stock,
    ).toBe(4);
    await act("schedule_return", { tracking: "RET-1" });
    await act("receive_return");
    await error(act("dispatch", { tracking: "REP-1" }));
    await act("pass_inspection");
    expect(
      (await db.variant.findUniqueOrThrow({ where: { id: f.item.variantId } }))
        .stock,
    ).toBe(6);
    await error(act("pass_inspection"), 409);
    await act("dispatch", { tracking: "REP-1" });
    await error(act("delivered"));
    await act("payment", { payment: "paid", note: "Receipt 1" });
    await act("delivered");
    expect(r.status).toBe("completed");
    expect(r.completedAt).not.toBeNull();
    expect(await db.shipment.count({ where: { exchangeId: r.id } })).toBe(2);
    expect(
      await db.notification.count({ where: { merchantId: f.merchant.id } }),
    ).toBeGreaterThan(1);
  });
  it("restores allocated stock and purchased quantity when cancelled", async () => {
    const f = await fixture();
    const r = await submitted(f);
    const a = await actOnExchange(f.merchant.id, r.reference, "Owner", {
      action: "approve",
      version: 0,
    });
    await actOnExchange(f.merchant.id, r.reference, "Owner", {
      action: "cancel",
      version: a.version,
      note: "Customer requested cancellation.",
    });
    expect(
      (await db.variant.findUniqueOrThrow({ where: { id: f.replacement.id } }))
        .stock,
    ).toBe(5);
    expect(
      (await db.orderItem.findUniqueOrThrow({ where: { id: f.item.id } }))
        .committed,
    ).toBe(0);
  });
  it("rechecks stock at approval and keeps the request pending on failure", async () => {
    const f = await fixture();
    const r = await submitted(f);
    await db.variant.update({
      where: { id: f.replacement.id },
      data: { stock: 0 },
    });
    await error(
      actOnExchange(f.merchant.id, r.reference, "Owner", {
        action: "approve",
        version: 0,
      }),
      409,
    );
    expect(
      (await db.exchange.findUniqueOrThrow({ where: { id: r.id } })).status,
    ).toBe("submitted");
  });
  it("rejects stale and repeated staff actions", async () => {
    const f = await fixture();
    const r = await submitted(f);
    await actOnExchange(f.merchant.id, r.reference, "Owner", {
      action: "approve",
      version: 0,
    });
    await error(
      actOnExchange(f.merchant.id, r.reference, "Owner", {
        action: "approve",
        version: 0,
      }),
      409,
    );
    expect(
      (await db.variant.findUniqueOrThrow({ where: { id: f.replacement.id } }))
        .stock,
    ).toBe(4);
  });
  it("records and resumes an exception without losing the stage", async () => {
    const f = await fixture();
    const r = await submitted(f);
    const a = await actOnExchange(f.merchant.id, r.reference, "Owner", {
      action: "flag",
      version: 0,
      note: "Need a customer confirmation.",
    });
    expect(a.previousStatus).toBe("submitted");
    const b = await actOnExchange(f.merchant.id, r.reference, "Owner", {
      action: "resolve",
      version: a.version,
      note: "Customer confirmed.",
    });
    expect(b.status).toBe("submitted");
    expect(b.exception).toBeNull();
  });
  it("closes an alternative resolution without pretending a refund happened", async () => {
    const f = await fixture();
    const r = await submitted(f);
    let a = await actOnExchange(f.merchant.id, r.reference, "Owner", {
      action: "flag",
      version: 0,
      note: "Customer wants refund.",
    });
    a = await actOnExchange(f.merchant.id, r.reference, "Owner", {
      action: "payment",
      version: a.version,
      payment: "waived",
      note: "No collection fee.",
    });
    a = await actOnExchange(f.merchant.id, r.reference, "Owner", {
      action: "close_resolution",
      version: a.version,
      note: "Merchant refunded externally, receipt 10.",
    });
    expect(a.status).toBe("resolved");
    expect(
      (await db.orderItem.findUniqueOrThrow({ where: { id: f.item.id } }))
        .committed,
    ).toBe(0);
  });
});
describe("Access boundaries and web protections", () => {
  it("rejects an expired authenticated session", async () => {
    const f = await fixture();
    const cookie = cookiePair(
      await createSession(f.merchant.id, request("x"), { orderId: f.order.id }),
    );
    await db.session.updateMany({
      where: { orderId: f.order.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await error(requireOrder(request("customer/order", cookie)), 401);
  });
  it("validates and privately stores actual image uploads", async () => {
    const f = await fixture();
    const cookie = cookiePair(
      await createSession(f.merchant.id, request("x"), { orderId: f.order.id }),
    );
    const photo = await sharp({
      create: { width: 10, height: 10, channels: 3, background: "#fff" },
    })
      .png()
      .toBuffer();
    const form = new FormData();
    form.set("file", new File([photo], "photo.png", { type: "image/png" }));
    const response = await action({
      request: new Request("http://localhost:5173/api/customer/upload", {
        method: "POST",
        headers: { Cookie: cookie, Origin: "http://localhost:5173" },
        body: form,
      }),
      params: { "*": "customer/upload" },
    });
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.attachment.url).toMatch(/^\/api\/attachments\//);
    const download = await loader({
      request: request(`attachments/${result.attachment.id}`, cookie),
      params: { "*": `attachments/${result.attachment.id}` },
    });
    expect(download.status).toBe(200);
    expect(download.headers.get("Content-Type")).toBe("image/jpeg");
    expect(download.headers.get("Cache-Control")).toBe("private, no-store");
    const bad = new FormData();
    bad.set("file", new File(["<svg/>"], "fake.png", { type: "image/png" }));
    const invalid = await action({
      request: new Request("http://localhost:5173/api/customer/upload", {
        method: "POST",
        headers: { Cookie: cookie, Origin: "http://localhost:5173" },
        body: bad,
      }),
      params: { "*": "customer/upload" },
    });
    expect(invalid.status).toBe(400);
  });
  it("does not expose a request to another tenant or order", async () => {
    const f = await fixture();
    const other = await fixture();
    const r = await submitted(f);
    await error(requestDetail(other.merchant.id, r.reference), 404);
    await error(requestDetail(f.merchant.id, r.reference, other.order.id), 404);
  });
  it("requires authentication for the merchant dashboard", async () => {
    const response = await loader({
      request: request("dashboard"),
      params: { "*": "dashboard" },
    });
    expect(response.status).toBe(401);
  });
  it("does not allow a customer session to perform merchant actions", async () => {
    const f = await fixture();
    const cookie = cookiePair(
      await createSession(f.merchant.id, request("customer/verify"), {
        orderId: f.order.id,
      }),
    );
    await error(requireStaff(request("dashboard", cookie)), 401);
    expect(
      (await requireOrder(request("customer/order", cookie))).orderId,
    ).toBe(f.order.id);
  });
  it("does not allow photo access across tenants", async () => {
    const f = await fixture();
    const other = await fixture();
    const photo = await db.attachment.create({
      data: {
        merchantId: other.merchant.id,
        orderId: other.order.id,
        path: "never-read.jpg",
        mime: "image/jpeg",
        size: 10,
      },
    });
    const cookie = cookiePair(
      await createSession(f.merchant.id, request("x"), { orderId: f.order.id }),
    );
    const response = await loader({
      request: request(`attachments/${photo.id}`, cookie),
      params: { "*": `attachments/${photo.id}` },
    });
    expect(response.status).toBe(404);
  });
  it("rejects cross-origin actions", async () => {
    const response = await action({
      request: request("auth/logout", "", {}, "https://attacker.example"),
      params: { "*": "auth/logout" },
    });
    expect(response.status).toBe(403);
    expect(() =>
      checkOrigin(
        new Request("http://localhost:5173/api/auth/logout", {
          method: "POST",
        }),
      ),
    ).toThrow();
  });
  it("verifies hashed passwords and rejects incorrect ones", () => {
    const h = passwordHash("A long private password");
    expect(h).not.toContain("private");
    expect(checkPassword("A long private password", h)).toBe(true);
    expect(checkPassword("incorrect", h)).toBe(false);
  });
  it("limits repeated attempts", async () => {
    const key = crypto.randomUUID();
    await rateLimit(key, 1, 60);
    await error(rateLimit(key, 1, 60), 429);
  });
  it("consumes an order verification code only once", async () => {
    const f = await fixture();
    const start = await action({
      request: request("customer/start", "", {
        slug: f.merchant.slug,
        number: f.order.number,
        email: f.order.email,
      }),
      params: { "*": "customer/start" },
    });
    const c = await start.json();
    expect(c.demoCode).toMatch(/^\d{6}$/);
    const body = { challengeId: c.challengeId, code: c.demoCode };
    const verified = await action({
      request: request("customer/verify", "", body),
      params: { "*": "customer/verify" },
    });
    expect(verified.status).toBe(200);
    expect(verified.headers.get("Set-Cookie")).toContain("HttpOnly");
    const repeat = await action({
      request: request("customer/verify", "", body),
      params: { "*": "customer/verify" },
    });
    expect(repeat.status).toBe(401);
  });
});
describe("Durable notification outbox", () => {
  it("processes demo updates without sending external email", async () => {
    const f = await fixture();
    await submitted(f);
    const before = await db.notification.count({
      where: { merchantId: f.merchant.id, status: "queued" },
    });
    expect(before).toBeGreaterThan(0);
    const result = await processOutbox(f.merchant.id);
    expect(result.processed).toBe(before);
    expect(
      await db.notification.count({
        where: { merchantId: f.merchant.id, status: "demo" },
      }),
    ).toBe(before);
    expect((await processOutbox(f.merchant.id)).processed).toBe(0);
  });
  it("recovers an expired worker lease", async () => {
    const f = await fixture();
    const n = await db.notification.create({
      data: {
        merchantId: f.merchant.id,
        recipient: "test@example.com",
        subject: "Status",
        body: "Test",
        status: "sending",
        attempts: 1,
        nextAttemptAt: new Date(Date.now() - 1000),
      },
    });
    await processOutbox(f.merchant.id);
    expect(
      (await db.notification.findUniqueOrThrow({ where: { id: n.id } })).status,
    ).toBe("demo");
  });
  it("does not send an expired verification code", async () => {
    const f = await fixture();
    const n = await db.notification.create({
      data: {
        merchantId: f.merchant.id,
        recipient: "test@example.com",
        subject: "Your Baddel verification code",
        body: "Code",
        createdAt: new Date(Date.now() - 11 * 60000),
      },
    });
    await processOutbox(f.merchant.id);
    expect(
      (await db.notification.findUniqueOrThrow({ where: { id: n.id } })).status,
    ).toBe("expired");
  });
  it("uses provider idempotency keys and checks errors without external delivery", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-only-key");
    vi.stubEnv("EMAIL_FROM", "test@example.com");
    const job = {
      id: "job-test",
      recipient: "customer@example.com",
      subject: "Exchange update",
      body: "Test update",
    };
    const transport = vi.fn(async () =>
      Response.json({ id: "provider-123" }),
    ) as unknown as typeof fetch;
    expect(await deliverEmail(job, transport)).toBe("provider-123");
    const args = vi.mocked(transport).mock.calls[0];
    expect(args[0]).toBe("https://api.resend.com/emails");
    expect(
      (args[1]?.headers as Record<string, string>)["Idempotency-Key"],
    ).toBe("baddel-job-test");
    await expect(
      deliverEmail(job, async () =>
        Response.json({ error: "Failed" }, { status: 500 }),
      ),
    ).rejects.toThrow("500");
    vi.unstubAllEnvs();
  });
});
afterAll(async () => {
  await db.$disconnect();
});
