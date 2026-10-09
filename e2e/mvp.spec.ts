import {
  test,
  expect,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { mkdirSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
const origin = "http://localhost:5173";
const run = Date.now().toString(36);
const slug = `qa-${run}`;
const email = `qa-${run}@example.com`;
const customerEmail = `shopper-${run}@example.com`;
const password = "PrivateTest!2026";
let reference = "";
async function go(page: Page, url: string) {
  await page.goto(url);
  await expect(page.locator("body")).toHaveAttribute("data-hydrated", "true");
}
async function post(request: APIRequestContext, path: string, data: unknown) {
  const response = await request.post(`/api/${path}`, {
    data,
    headers: { Origin: origin },
  });
  const body = await response.json();
  expect(response.ok(), JSON.stringify(body)).toBe(true);
  return body;
}
async function login(
  page: Page,
  staffEmail = "demo@baddel.local",
  staffPassword = "DemoPass!2026",
) {
  await go(page, "/login");
  await page.getByLabel("Email address", { exact: true }).fill(staffEmail);
  await page.getByLabel("Password", { exact: true }).fill(staffPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/app/);
  await expect(
    page.getByRole("heading", { name: /Good morning/ }),
  ).toBeVisible();
}
test.describe.serial("Working MVP", () => {
  test("brand onboarding, inventory, order entry, customer exchange, staff completion", async ({
    page,
    browser,
  }) => {
    test.setTimeout(120000);
    await go(page, "/login");
    await page.getByRole("button", { name: "Create a brand account" }).click();
    await page.getByLabel("Your name", { exact: true }).fill("QA Owner");
    await page.getByLabel("Brand name", { exact: true }).fill("QA Fashion");
    await page.getByLabel("Portal address", { exact: true }).fill(slug);
    await page.getByLabel("Email address", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: /Good morning/ }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Inventory", exact: true }).click();
    await page
      .getByRole("button", { name: "Add product", exact: true })
      .click();
    const productDialog = page.getByRole("dialog");
    await productDialog
      .getByLabel("Product name", { exact: true })
      .fill("QA cotton tee");
    await productDialog
      .getByLabel("Arabic name", { exact: true })
      .fill("تيشيرت تجريبي");
    await productDialog.getByLabel("Price (EGP)", { exact: true }).fill("800");
    await productDialog
      .getByRole("button", { name: "Add product", exact: true })
      .click();
    await expect(
      page.getByText("Product added", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Orders", exact: true }).click();
    await page.getByRole("button", { name: "Add delivered order" }).click();
    const orderDialog = page.getByRole("dialog");
    await orderDialog.getByLabel("Order number", { exact: true }).fill("QA100");
    await orderDialog
      .getByLabel("Customer name", { exact: true })
      .fill("QA Shopper");
    await orderDialog
      .getByLabel("Email address", { exact: true })
      .fill(customerEmail);
    await orderDialog.getByLabel("Phone", { exact: true }).fill("01012345678");
    await orderDialog
      .getByLabel("Address", { exact: true })
      .fill("24 Cairo test street, Cairo");
    await orderDialog
      .getByLabel("Item", { exact: true })
      .selectOption({ label: "QA cotton tee · M · Black" });
    await orderDialog
      .getByLabel("Paid price per item (EGP)", { exact: true })
      .fill("750");
    await orderDialog
      .getByRole("button", { name: "Add delivered order" })
      .click();
    await expect(page.getByText("Order added", { exact: true })).toBeVisible();
    const shopper = await browser.newContext();
    const customer = await shopper.newPage();
    await go(customer, `/portal/${slug}`);
    await customer.getByLabel("Order number", { exact: true }).fill("QA100");
    await customer
      .getByLabel("Email address", { exact: true })
      .fill(customerEmail);
    await customer
      .getByRole("button", { name: "Continue", exact: true })
      .click();
    await expect(
      customer.getByRole("heading", { name: "Verify your order" }),
    ).toBeVisible();
    await customer.getByRole("button", { name: "Verify", exact: true }).click();
    await expect(
      customer.getByRole("heading", { name: "Choose your item" }),
    ).toBeVisible();
    await customer.getByRole("button", { name: /QA cotton tee/ }).click();
    await customer
      .getByRole("button", { name: "Continue", exact: true })
      .click();
    await customer
      .getByRole("button", { name: "Size is too small", exact: true })
      .click();
    await customer
      .getByRole("button", { name: "Continue", exact: true })
      .click();
    await customer.getByRole("button", { name: "L", exact: true }).click();
    await customer
      .getByRole("button", { name: "Continue", exact: true })
      .click();
    await customer.getByRole("checkbox").check();
    await customer
      .getByRole("button", { name: "Submit exchange", exact: true })
      .click();
    await expect(
      customer.getByRole("heading", { name: "We’ve received your request" }),
    ).toBeVisible();
    reference = customer.url().split("/").pop()!;
    await customer.reload();
    await expect(customer.getByText(reference, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Exchanges", exact: true }).click();
    await page.getByRole("button", { name: reference, exact: true }).click();
    const detail = page.getByRole("dialog");
    await detail.getByRole("button", { name: "Approve exchange" }).click();
    await expect(detail.getByText("Approved", { exact: true })).toBeVisible();
    await detail
      .getByLabel("Tracking reference", { exact: true })
      .fill("QA-RETURN-1");
    await detail.getByRole("button", { name: "Schedule collection" }).click();
    await detail.getByRole("button", { name: "Mark return received" }).click();
    await detail
      .getByRole("button", { name: "Pass inspection", exact: true })
      .click();
    await detail
      .getByLabel("Tracking reference", { exact: true })
      .fill("QA-REPLACEMENT-1");
    await detail.getByRole("button", { name: "Dispatch replacement" }).click();
    await detail.getByRole("button", { name: "Mark delivered" }).click();
    await expect(detail.getByRole("alert")).toContainText(
      "Resolve the exchange fee",
    );
    await detail
      .getByLabel("Decision / payment reference / note")
      .fill("QA cash receipt 100");
    await detail
      .getByRole("button", { name: "Confirm payment", exact: true })
      .click();
    await detail.getByRole("button", { name: "Mark delivered" }).click();
    await expect(detail.getByText("Completed", { exact: true })).toBeVisible();
    await customer.reload();
    await expect(customer.locator(".badge")).toHaveText("Completed");
    await detail.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("button", { name: "Reports", exact: true }).click();
    await expect(
      page
        .locator(".stat-card")
        .filter({ hasText: "Merchandise value retained" })
        .getByText("EGP 750", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Process outbox" }).click();
    await expect(page.locator(".notification-status").first()).toHaveText(
      "Demo",
    );
    await shopper.close();
  });
  test("policy changes persist and export is downloadable", async ({
    page,
  }) => {
    await login(page, email, password);
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByLabel("Exchange window (days)").fill("21");
    await page.getByLabel("Shipping fee (EGP)").fill("80.35");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Settings saved")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Shipping fee (EGP)")).toHaveValue("80.35");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Exchanges", exact: true }).click();
    await page.getByRole("link", { name: "Export CSV" }).click();
    expect((await download).suggestedFilename()).toBe("baddel-exchanges.csv");
  });
  test("tenant isolation and unauthenticated endpoints", async ({
    page,
    browser,
    request,
  }) => {
    await login(page, "thread@baddel.local");
    const inaccessible = await page.request.get(`/api/requests/${reference}`);
    expect(inaccessible.status()).toBe(404);
    const guest = await browser.newContext();
    const guestPage = await guest.newPage();
    await go(guestPage, "/app");
    await expect(guestPage).toHaveURL(/\/login/);
    expect((await request.get("/api/dashboard")).status()).toBe(401);
    expect(
      (
        await request.post("/api/auth/logout", {
          data: {},
          headers: { Origin: "https://attacker.example" },
        })
      ).status(),
    ).toBe(403);
    await guest.close();
  });
  test("Arabic mobile portal fits the viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await go(page, "/portal/nile");
    await page.getByRole("button", { name: "Switch language" }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(
      page.getByRole("heading", { name: "ابحث عن طلبك" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    mkdirSync("docs/screenshots", { recursive: true });
    await page.screenshot({
      path: "docs/screenshots/customer-arabic-mobile.png",
      fullPage: true,
    });
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  });
  test("desktop dashboard, customer portal, and home have no browser errors", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await login(page);
    await expect(
      page.getByRole("heading", { name: "Recent exchanges" }),
    ).toBeVisible();
    await page.screenshot({
      path: "docs/screenshots/dashboard-desktop.png",
      fullPage: true,
    });
    await go(page, "/portal/nile");
    await expect(
      page.getByRole("heading", { name: "Find your order" }),
    ).toBeVisible();
    await page.screenshot({
      path: "docs/screenshots/customer-desktop.png",
      fullPage: true,
    });
    await go(page, "/");
    await expect(
      page.getByRole("heading", { name: "A better fit. A better exchange." }),
    ).toBeVisible();
    await page.screenshot({
      path: "docs/screenshots/home-desktop.png",
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
  test("required evidence uploads through the customer interface", async ({
    page,
    browser,
  }) => {
    await login(page, email, password);
    const inventory = await (await page.request.get("/api/inventory")).json();
    const variant = inventory.products[0].variants.find(
      (v: { size: string }) => v.size === "M",
    );
    const shopperEmail = `photo-${run}@example.com`;
    await post(page.request, "orders", {
      number: "PHOTO100",
      customerName: "Photo Shopper",
      email: shopperEmail,
      phone: "01012345678",
      address: "Photo test Cairo address",
      deliveredAt: new Date(Date.now() - 86400000).toISOString(),
      variantId: variant.id,
      quantity: 1,
      paidPrice: 80000,
    });
    const context = await browser.newContext();
    const customer = await context.newPage();
    await go(customer, `/portal/${slug}`);
    await customer.getByLabel("Order number", { exact: true }).fill("PHOTO100");
    await customer
      .getByLabel("Email address", { exact: true })
      .fill(shopperEmail);
    await customer
      .getByRole("button", { name: "Continue", exact: true })
      .click();
    await customer.getByRole("button", { name: "Verify", exact: true }).click();
    await customer.getByRole("button", { name: /QA cotton tee/ }).click();
    await customer
      .getByRole("button", { name: "Continue", exact: true })
      .click();
    await customer
      .getByRole("button", { name: "Item is damaged", exact: true })
      .click();
    await customer
      .getByRole("button", { name: "Continue", exact: true })
      .click();
    await expect(customer.getByRole("alert")).toContainText(
      "A photo is required",
    );
    const buffer = await sharp({
      create: { width: 64, height: 64, channels: 3, background: "#779988" },
    })
      .png()
      .toBuffer();
    await customer
      .locator('input[type="file"]')
      .setInputFiles({ name: "evidence.png", mimeType: "image/png", buffer });
    await expect(customer.locator(".photo-grid img")).toBeVisible();
    await customer
      .getByRole("button", { name: "Continue", exact: true })
      .click();
    await customer.getByRole("button", { name: "L", exact: true }).click();
    await customer
      .getByRole("button", { name: "Continue", exact: true })
      .click();
    await customer.getByRole("checkbox").check();
    await customer
      .getByRole("button", { name: "Submit exchange", exact: true })
      .click();
    await expect(
      customer.getByRole("heading", { name: "We’ve received your request" }),
    ).toBeVisible();
    const photoReference = customer.url().split("/").pop()!;
    await page.getByRole("button", { name: "Exchanges", exact: true }).click();
    await page
      .getByRole("button", { name: photoReference, exact: true })
      .click();
    await expect(
      page.getByRole("dialog").getByRole("img", { name: "Photos" }),
    ).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Close", exact: true })
      .click();
    await context.close();
  });
  test("mobile merchant navigation and Arabic settings fit the screen", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(page.getByLabel("Brand name", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Switch language" }).click();
    await expect(page.getByLabel("اسم البراند", { exact: true })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "docs/screenshots/dashboard-arabic-mobile.png",
      fullPage: true,
    });
  });
});
