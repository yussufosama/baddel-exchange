import type { Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db, fail } from "./db.server";
import { eligible, evidenceNeeded, reasons } from "./domain";
type Tx = Prisma.TransactionClient;
export const exchangeInput = z.object({
  itemId: z.string().min(1),
  replacementId: z.string().min(1),
  reason: z.enum(reasons),
  notes: z.string().max(1000).default(""),
  quantity: z.number().int().min(1).max(10).default(1),
  idempotencyKey: z.string().uuid(),
  attachments: z.array(z.string()).max(3).default([]),
  consent: z.literal(true),
  quote: z.object({
    shippingFee: z.number().int().min(0),
    windowDays: z.number().int().min(1),
    evidenceRequired: z.boolean(),
  }),
});
const relations = {
  item: { include: { variant: { include: { product: true } } } },
  order: true,
  events: { orderBy: { createdAt: "asc" as const } },
  attachments: { select: { id: true } },
  shipments: true,
};
export async function requestDetail(
  merchantId: string,
  reference: string,
  orderId?: string,
) {
  const r = await db.exchange.findFirst({
    where: { merchantId, reference, ...(orderId ? { orderId } : {}) },
    include: relations,
  });
  if (!r) fail("Request not found.", 404);
  return r;
}
async function notify(
  tx: Tx,
  r: { merchantId: string; reference: string; order: { email: string } },
  text: string,
) {
  const merchant = await tx.merchant.findUniqueOrThrow({
    where: { id: r.merchantId },
    select: { slug: true },
  });
  const portal = `${process.env.APP_URL || "http://localhost:5173"}/portal/${merchant.slug}`;
  await tx.notification.create({
    data: {
      merchantId: r.merchantId,
      recipient: r.order.email,
      subject: `Exchange ${r.reference}`,
      body: `${text}\n\nVerify your order at ${portal} to view the latest exchange history. Reference: ${r.reference}.`,
    },
  });
}
export async function submitExchange(
  merchantId: string,
  orderId: string,
  raw: unknown,
) {
  const parsed = exchangeInput.safeParse(raw);
  if (!parsed.success)
    fail("Please check the item, replacement, reason, and policy agreement.");
  const input = parsed.data;
  return db.$transaction(
    async (tx) => {
      const existing = await tx.exchange.findUnique({
        where: {
          orderId_idempotencyKey: {
            orderId,
            idempotencyKey: input.idempotencyKey,
          },
        },
      });
      if (existing) return existing;
      const merchant = await tx.merchant.findUniqueOrThrow({
        where: { id: merchantId },
      });
      if (
        input.quote.shippingFee !== merchant.shippingFee ||
        input.quote.windowDays !== merchant.windowDays ||
        input.quote.evidenceRequired !== merchant.evidenceRequired
      )
        fail(
          "The brand’s policy changed. Refresh this page and review the fee before submitting.",
          409,
        );
      const order = await tx.order.findFirst({
        where: { id: orderId, merchantId },
      });
      if (!order) fail("Order not found.", 404);
      const item = await tx.orderItem.findFirst({
        where: { id: input.itemId, orderId },
        include: { variant: { include: { product: true } } },
      });
      if (!item) fail("Item not found.", 404);
      const availability = eligible(
        order.deliveredAt,
        merchant.windowDays,
        item.variant.product.excluded,
        item.quantity - item.committed,
      );
      if (!availability.ok) fail(availability.reason);
      if (input.quantity > item.quantity - item.committed)
        fail("Requested quantity exceeds the remaining purchased quantity.");
      const replacement = await tx.variant.findFirst({
        where: { id: input.replacementId, productId: item.variant.productId },
      });
      if (
        !replacement ||
        replacement.id === item.variantId ||
        replacement.price !== item.variant.price
      )
        fail("Choose a different size or color at the same merchandise price.");
      if (replacement.stock < input.quantity)
        fail("That size has sold out. Please choose another size.", 409);
      const attachments = await tx.attachment.findMany({
        where: {
          id: { in: input.attachments },
          merchantId,
          orderId,
          exchangeId: null,
        },
      });
      if (attachments.length !== input.attachments.length)
        fail("One of the photos is unavailable. Please upload it again.");
      if (
        evidenceNeeded(input.reason, merchant.evidenceRequired) &&
        !attachments.length
      )
        fail("Please upload a clear photo of the issue.");
      const updated = await tx.orderItem.updateMany({
        where: { id: item.id, committed: item.committed },
        data: { committed: { increment: input.quantity } },
      });
      if (updated.count !== 1)
        fail("The item changed. Reload your order.", 409);
      const snapshot = (v: typeof item.variant | typeof replacement) =>
        JSON.stringify({
          name: item.variant.product.name,
          nameAr: item.variant.product.nameAr,
          image: item.variant.product.image,
          size: v.size,
          color: v.color,
          price: item.paidPrice,
        });
      const r = await tx.exchange.create({
        data: {
          merchantId,
          orderId,
          itemId: item.id,
          replacementId: replacement.id,
          quantity: input.quantity,
          reason: input.reason,
          notes: input.notes,
          idempotencyKey: input.idempotencyKey,
          reference: `BD-${randomBytes(4).toString("hex").toUpperCase()}`,
          fee: merchant.shippingFee,
          feeStatus: merchant.shippingFee ? "due" : "waived",
          policySnapshot: JSON.stringify({
            windowDays: merchant.windowDays,
            shippingFee: merchant.shippingFee,
            evidenceRequired: merchant.evidenceRequired,
            workflow: "inspect_before_dispatch",
          }),
          itemSnapshot: snapshot(item.variant),
          replacementSnapshot: snapshot(replacement),
          events: {
            create: {
              merchantId,
              actor: "Customer",
              type: "submitted",
              message: "Customer submitted an exchange request.",
            },
          },
        },
        include: { order: true },
      });
      await tx.attachment.updateMany({
        where: {
          id: { in: input.attachments },
          merchantId,
          orderId,
          exchangeId: null,
        },
        data: { exchangeId: r.id },
      });
      await notify(
        tx,
        r,
        "We received your exchange request. The brand will review it.",
      );
      return r;
    },
    { timeout: 10000 },
  );
}
const actionInput = z.object({
  action: z.enum([
    "approve",
    "reject",
    "cancel",
    "schedule_return",
    "receive_return",
    "pass_inspection",
    "fail_inspection",
    "dispatch",
    "delivered",
    "payment",
    "flag",
    "resolve",
    "close_resolution",
    "note",
  ]),
  version: z.number().int().min(0),
  note: z.string().max(1000).default(""),
  tracking: z.string().max(100).default(""),
  payment: z.enum(["paid", "waived"]).optional(),
});
export async function actOnExchange(
  merchantId: string,
  reference: string,
  actor: string,
  raw: unknown,
) {
  const parsed = actionInput.safeParse(raw);
  if (!parsed.success) fail("Invalid action.");
  const { action, version, note, tracking, payment } = parsed.data;
  return db.$transaction(
    async (tx) => {
      const r = await tx.exchange.findFirst({
        where: { merchantId, reference },
        include: {
          order: true,
          item: { include: { variant: true } },
          shipments: true,
        },
      });
      if (!r) fail("Request not found.", 404);
      if (r.version !== version)
        fail(
          "Another team member updated this request. Refresh before continuing.",
          409,
        );
      const change: Prisma.ExchangeUpdateInput = { version: { increment: 1 } };
      const allowed = (...states: string[]) => {
        if (!states.includes(r.status))
          fail("That action is not available at this stage.", 409);
      };
      if (action === "approve") {
        allowed("submitted");
        const variant = await tx.variant.findFirst({
          where: { id: r.replacementId, product: { merchantId } },
        });
        if (
          !variant ||
          (
            await tx.variant.updateMany({
              where: { id: variant.id, stock: { gte: r.quantity } },
              data: { stock: { decrement: r.quantity } },
            })
          ).count !== 1
        )
          fail(
            "Replacement stock is no longer available. Flag the request for attention.",
            409,
          );
        change.status = "approved";
        change.stockReserved = true;
      } else if (action === "reject" || action === "cancel") {
        allowed("submitted", "approved");
        if (!note.trim()) fail("Please explain this decision to the customer.");
        if (r.stockReserved)
          await tx.variant.update({
            where: { id: r.replacementId },
            data: { stock: { increment: r.quantity } },
          });
        await tx.orderItem.update({
          where: { id: r.itemId },
          data: { committed: { decrement: r.quantity } },
        });
        change.status = action === "reject" ? "rejected" : "cancelled";
        change.stockReserved = false;
      } else if (action === "schedule_return") {
        allowed("approved");
        if (!tracking.trim())
          fail("Enter the manual return tracking reference.");
        await tx.shipment.create({
          data: {
            exchangeId: r.id,
            direction: "return",
            tracking,
            status: "in_transit",
          },
        });
        change.status = "return_in_transit";
      } else if (action === "receive_return") {
        allowed("return_in_transit");
        await tx.shipment.update({
          where: {
            exchangeId_direction: { exchangeId: r.id, direction: "return" },
          },
          data: { status: "received" },
        });
        change.status = "inspection";
      } else if (action === "pass_inspection") {
        allowed("inspection");
        if (r.returnedRestocked)
          fail("This item has already passed inspection.", 409);
        await tx.variant.update({
          where: { id: r.item.variantId },
          data: { stock: { increment: r.quantity } },
        });
        change.returnedRestocked = true;
      } else if (action === "fail_inspection") {
        allowed("inspection");
        if (r.returnedRestocked) fail("Inspection already passed.", 409);
        if (!note.trim()) fail("Describe the inspection problem.");
        change.status = "needs_action";
        change.previousStatus = "inspection";
        change.exception = note;
      } else if (action === "dispatch") {
        allowed("inspection");
        if (!r.returnedRestocked)
          fail("Pass inspection before dispatching the replacement.");
        if (!r.stockReserved) fail("Replacement stock has not been allocated.");
        if (!tracking.trim()) fail("Enter the replacement tracking reference.");
        await tx.shipment.create({
          data: {
            exchangeId: r.id,
            direction: "replacement",
            tracking,
            status: "in_transit",
          },
        });
        change.status = "replacement_in_transit";
      } else if (action === "delivered") {
        allowed("replacement_in_transit");
        if (!["paid", "waived"].includes(r.feeStatus))
          fail("Resolve the exchange fee before completing the request.");
        await tx.shipment.update({
          where: {
            exchangeId_direction: {
              exchangeId: r.id,
              direction: "replacement",
            },
          },
          data: { status: "delivered" },
        });
        change.status = "completed";
        change.completedAt = new Date();
        change.stockReserved = false;
      } else if (action === "payment") {
        if (
          ["rejected", "cancelled", "completed", "resolved"].includes(r.status)
        )
          fail("This request is closed.");
        if (!payment) fail("Choose a payment state.");
        if (!note.trim()) fail("Enter a payment reference or waiver reason.");
        change.feeStatus = payment;
      } else if (action === "flag") {
        allowed(
          "submitted",
          "approved",
          "return_in_transit",
          "inspection",
          "replacement_in_transit",
        );
        if (!note.trim()) fail("Describe the problem.");
        change.status = "needs_action";
        change.previousStatus = r.status;
        change.exception = note;
      } else if (action === "resolve") {
        allowed("needs_action");
        if (!note.trim()) fail("Describe how the issue was resolved.");
        change.status = r.previousStatus || "submitted";
        change.previousStatus = null;
        change.exception = null;
      } else if (action === "close_resolution") {
        allowed("needs_action");
        if (!note.trim())
          fail(
            "Record the agreed resolution, returned-item disposition, and any refund handled outside Baddel.",
          );
        if (!["paid", "waived"].includes(r.feeStatus))
          fail("Resolve the exchange fee before closing this case.");
        if (r.stockReserved && r.previousStatus !== "replacement_in_transit")
          await tx.variant.update({
            where: { id: r.replacementId },
            data: { stock: { increment: r.quantity } },
          });
        if (["submitted", "approved"].includes(r.previousStatus || ""))
          await tx.orderItem.update({
            where: { id: r.itemId },
            data: { committed: { decrement: r.quantity } },
          });
        change.status = "resolved";
        change.exception = null;
        change.stockReserved = false;
        change.completedAt = new Date();
      } else if (action === "note") {
        if (!note.trim()) fail("Enter a note.");
      }
      const updated = await tx.exchange.updateMany({
        where: { id: r.id, merchantId, version },
        data: change as Prisma.ExchangeUpdateManyMutationInput,
      });
      if (updated.count !== 1)
        fail("The request changed. Please refresh.", 409);
      const messages: Record<string, string> = {
        approve: "Exchange approved; replacement stock allocated.",
        reject: "Exchange declined.",
        cancel: "Exchange cancelled.",
        schedule_return: "Return collection recorded.",
        receive_return: "Returned item received for inspection.",
        pass_inspection: "Inspection passed; original item restocked.",
        fail_inspection: "Inspection issue needs attention.",
        dispatch: "Replacement shipment recorded.",
        delivered: "Replacement delivered; exchange completed.",
        payment: `Exchange fee ${payment === "paid" ? "confirmed paid" : "waived"}.`,
        flag: "Request needs attention.",
        resolve: "Issue resolved; workflow resumed.",
        close_resolution:
          "Case closed with a staff-recorded alternative resolution. No automatic refund or courier cancellation was performed.",
        note: "Staff added a note.",
      };
      const message = `${messages[action]}${note ? ` ${note}` : ""}${tracking ? ` Tracking: ${tracking}` : ""}`;
      await tx.event.create({
        data: { merchantId, exchangeId: r.id, actor, type: action, message },
      });
      if (!["note", "payment", "pass_inspection"].includes(action))
        await notify(tx, r, message);
      return tx.exchange.findUniqueOrThrow({ where: { id: r.id } });
    },
    { timeout: 10000 },
  );
}
