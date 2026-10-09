import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";

const run = Date.now().toString(36);
const email = `analytics-${run}@example.com`;
const password = "AnalyticsTest!2026";
const origin = "http://localhost:5173";
let teeId = "",
  hoodieId = "",
  reference = "";
test.beforeAll(async ({ request }) => {
  const response = await request.post("/api/auth/register", {
    headers: { Origin: origin },
    data: {
      name: "Analytics Owner",
      brand: "Analytics QA",
      slug: `analytics-${run}`,
      email,
      password,
    },
  });
  expect(response.ok()).toBe(true);
  const { merchant } = await (await request.get("/api/dashboard")).json();
  const db = new PrismaClient();
  try {
    const products = [];
    for (const name of ["Analytics cotton tee", "Analytics hoodie"]) {
      products.push(
        await db.product.create({
          data: {
            merchantId: merchant.id,
            name,
            nameAr:
              name === "Analytics cotton tee"
                ? "تيشيرت التحليلات"
                : "هودي التحليلات",
            image: "/products/tee.svg",
            variants: {
              create: [
                { size: "M", color: "White", price: 80000, stock: 10 },
                { size: "L", color: "White", price: 80000, stock: 10 },
              ],
            },
          },
          include: { variants: true },
        }),
      );
    }
    [teeId, hoodieId] = products.map((p) => p.id);
    for (let i = 0; i < 6; i++) {
      const product = products[i === 3 || i === 4 ? 1 : 0];
      const order = await db.order.create({
        data: {
          merchantId: merchant.id,
          number: `A-${i}`,
          customerName: "Analytics Shopper",
          email: "analytics-shopper@example.com",
          address: "Fictional QA address",
          phone: "01012345678",
          deliveredAt: new Date(Date.now() - 5 * 86400000),
          items: {
            create: {
              variantId: product.variants[0].id,
              quantity: 2,
              paidPrice: 65035,
            },
          },
        },
        include: { items: true },
      });
      const status = [
        "completed",
        "submitted",
        "needs_action",
        "inspection",
        "submitted",
        "cancelled",
      ][i];
      const snapshot = {
        name: product.name,
        nameAr: product.nameAr,
        image: product.image,
        size: "M",
        color: "White",
        price: 65035,
      };
      const r = await db.exchange.create({
        data: {
          merchantId: merchant.id,
          orderId: order.id,
          itemId: order.items[0].id,
          replacementId: product.variants[1].id,
          reference: `BD-AN-${run}-${i}`,
          idempotencyKey: crypto.randomUUID(),
          reason: [
            "size_small",
            "size_large",
            "size_small",
            "damaged",
            "damaged",
            "color",
          ][i],
          status,
          quantity: i === 0 ? 2 : 1,
          fee: 6035,
          feeStatus: i === 0 ? "paid" : "due",
          notes: i === 3 ? "Torn sleeve on arrival" : "Fit review",
          exception: i === 2 ? "Tag review required" : null,
          policySnapshot: JSON.stringify({ shippingFee: 6035, windowDays: 14 }),
          itemSnapshot: JSON.stringify(snapshot),
          replacementSnapshot: JSON.stringify({ ...snapshot, size: "L" }),
          createdAt: new Date(Date.now() - 4 * 86400000),
          updatedAt: new Date(Date.now() - (i === 1 ? 3 : 0) * 86400000),
          completedAt: i === 0 ? new Date(Date.now() - 86400000) : null,
        },
      });
      if (i === 2) reference = r.reference;
    }
  } finally {
    await db.$disconnect();
  }
});
async function login(page: Page) {
  await page.goto("/login");
  await expect(page.locator("body")).toHaveAttribute("data-hydrated", "true");
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/app/);
  await page.goto("/app?view=reports");
  await expect(page.getByLabel("Date range")).toBeVisible();
}
test("merchant sees quantities, product reasons, sizing patterns and exception-first follow-ups", async ({
  page,
}) => {
  await login(page);
  const cards = page.locator(".exchange-analytics .stat-card");
  await expect(cards.nth(0).locator("strong")).toHaveText("5");
  await expect(cards.nth(1).locator("strong")).toHaveText("6");
  await expect(cards.nth(2).locator("strong")).toHaveText("20%");
  await expect(
    page.getByRole("heading", { name: "Products driving exchanges" }),
  ).toBeVisible();
  await expect(page.locator(".analytics-insights article")).toHaveCount(2);
  await expect(page.locator(".analytics-queue button").first()).toContainText(
    reference,
  );
  await page.locator(".analytics-queue button").first().click();
  await expect(page.getByRole("dialog")).toContainText("Tag review required");
});
test("filters survive refresh, export only matching comments and reset from an empty selection", async ({
  page,
}) => {
  await login(page);
  await page.getByLabel("Product filter").selectOption(hoodieId);
  await page.getByLabel("Reason filter").selectOption("damaged");
  await page
    .getByRole("textbox", { name: "Search analytics" })
    .fill("Torn sleeve");
  await expect(page.locator(".analytics-comments tbody tr")).toHaveCount(1);
  await page.reload();
  await expect(page.getByLabel("Product filter")).toHaveValue(hoodieId);
  await expect(
    page.getByRole("textbox", { name: "Search analytics" }),
  ).toHaveValue("Torn sleeve");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export filtered data" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("baddel-analytics.csv");
  const csv = await readFile((await download.path())!, "utf8");
  expect(csv).toContain("Torn sleeve on arrival");
  expect(csv).not.toContain("Analytics cotton tee");
  await page
    .getByRole("textbox", { name: "Search analytics" })
    .fill("no matches expected");
  await expect(
    page.getByRole("button", { name: "Export filtered data" }),
  ).toBeDisabled();
  await expect(
    page.getByText(
      "No exchange requests match these filters. Try another period or reset the filters.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset filters" }).click();
  await expect(page.locator(".analytics-comments tbody tr")).toHaveCount(5);
  await page.getByLabel("Request status").selectOption("all");
  await expect(page.locator(".analytics-comments tbody tr")).toHaveCount(6);
});
test("Arabic mobile analytics remain usable and fit the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.getByRole("button", { name: "Switch language" }).click();
  await expect(
    page.getByRole("heading", { name: "لماذا يطلب العملاء الاستبدال؟" }),
  ).toBeVisible();
  await page.getByLabel("فلتر المنتج").selectOption(teeId);
  await expect(page.getByLabel("فلتر المنتج")).toHaveValue(teeId);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("another brand's dashboard cannot see analytics products, comments or requests", async ({
  page,
}) => {
  await login(page);
  const newEmail = `empty-${run}@example.com`;
  const response = await page.request.post("/api/auth/register", {
    headers: { Origin: origin },
    data: {
      name: "Empty Owner",
      brand: "Empty Analytics QA",
      slug: `empty-${run}`,
      email: newEmail,
      password,
    },
  });
  expect(response.ok()).toBe(true);
  await page.goto("/app?view=reports");
  await expect(
    page.locator(".exchange-analytics .stat-card").first().locator("strong"),
  ).toHaveText("0");
  await expect(page.getByLabel("Product filter").locator("option")).toHaveCount(
    1,
  );
  const dashboard = await (await page.request.get("/api/dashboard")).json();
  expect(dashboard.requests).toEqual([]);
  await expect(
    page.getByText("Torn sleeve on arrival", { exact: true }),
  ).toHaveCount(0);
});
