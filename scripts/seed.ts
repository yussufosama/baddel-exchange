import { db, demo } from "../app/lib/db.server";
import { passwordHash } from "../app/lib/security.server";
import { submitExchange, actOnExchange } from "../app/lib/exchanges.server";
if (!demo) throw new Error("Demo seeding is disabled in live mode.");
if (await db.merchant.findUnique({ where: { slug: "nile" } })) {
  console.log("Demo data already exists; existing requests preserved.");
  await db.$disconnect();
  process.exit(0);
}
const merchant = await db.merchant.create({
  data: {
    id: "merchant-nile",
    slug: "nile",
    name: "NILE STUDIO",
    email: "support@nile.example",
    provider: "demo",
    staff: {
      create: {
        email: "demo@baddel.local",
        name: "Youssef",
        passwordHash: passwordHash("DemoPass!2026"),
      },
    },
  },
});
const product = await db.product.create({
  data: {
    id: "product-tee",
    merchantId: merchant.id,
    name: "Everyday heavyweight tee",
    nameAr: "تيشيرت قطن يومي",
    image: "/products/tee.svg",
    variants: {
      create: ["XS", "S", "M", "L", "XL"].map((size, i) => ({
        id: `tee-${size}`,
        size,
        color: "Off-white",
        price: 80000,
        stock: i === 4 ? 0 : 25,
      })),
    },
  },
  include: { variants: true },
});
await db.product.create({
  data: {
    id: "product-hoodie",
    merchantId: merchant.id,
    name: "Relaxed cotton hoodie",
    nameAr: "هودي قطن بقصة واسعة",
    image: "/products/hoodie.svg",
    variants: {
      create: ["S", "M", "L", "XL"].map((size) => ({
        id: `hoodie-${size}`,
        size,
        color: "Forest green",
        price: 120000,
        stock: 12,
      })),
    },
  },
});
const order = async (number: string, name: string, email: string, days = 3) =>
  db.order.create({
    data: {
      merchantId: merchant.id,
      number,
      customerName: name,
      email,
      phone: "01012345678",
      address: "24 El Nozha Street, Heliopolis, Cairo",
      deliveredAt: new Date(Date.now() - days * 86400000),
      items: {
        create: [
          { variantId: "tee-M", quantity: 1, paidPrice: 80000 },
          { variantId: "hoodie-M", quantity: 1, paidPrice: 120000 },
        ],
      },
    },
    include: { items: true },
  });
await order("46381", "Mariam Hassan", "mariam@example.com");
await order("EXPIRED", "Expired example", "expired@example.com", 30);
const stages = [
  "submitted",
  "approved",
  "return_in_transit",
  "inspection",
  "replacement_in_transit",
  "completed",
  "needs_action",
];
const names = [
  "Salma Ahmed",
  "Omar Mostafa",
  "Nour Ali",
  "Ahmed Adel",
  "Farah Sherif",
  "Yasmin Khaled",
  "Karim Hassan",
];
for (let i = 0; i < stages.length; i++) {
  const o = await order(
    String(46370 + i),
    names[i],
    `customer${i}@example.com`,
  );
  let r = await submitExchange(merchant.id, o.id, {
    itemId: o.items[0].id,
    replacementId: "tee-L",
    reason: i % 2 ? "size_large" : "size_small",
    notes: i === 6 ? "Please call before collection." : "",
    quantity: 1,
    idempotencyKey: crypto.randomUUID(),
    consent: true,
    quote: {
      shippingFee: merchant.shippingFee,
      windowDays: merchant.windowDays,
      evidenceRequired: merchant.evidenceRequired,
    },
  });
  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    r = await actOnExchange(merchant.id, r.reference, "Youssef", {
      action,
      version: r.version,
      ...extra,
    });
  };
  if (i >= 1) await act("approve");
  if (i >= 2)
    await act("schedule_return", { tracking: `MAN-RETURN-${46370 + i}` });
  if (i >= 3) await act("receive_return");
  if (i === 4 || i === 5) {
    await act("pass_inspection");
    await act("dispatch", { tracking: `MAN-REPLACE-${46370 + i}` });
  }
  if (i === 5) {
    await act("payment", { payment: "paid", note: "Demo receipt #1001" });
    await act("delivered");
  }
  if (i === 6)
    await act("fail_inspection", {
      note: "Tag missing. Confirm an alternative resolution with the customer.",
    });
}
const second = await db.merchant.create({
  data: {
    id: "merchant-thread",
    slug: "thread",
    name: "THREAD & CO.",
    email: "support@thread.example",
    provider: "demo",
    color: "#68462e",
    staff: {
      create: {
        email: "thread@baddel.local",
        name: "Thread Owner",
        passwordHash: passwordHash("DemoPass!2026"),
      },
    },
  },
});
await db.product.create({
  data: {
    merchantId: second.id,
    name: "Thread essential tee",
    nameAr: "تيشيرت ثريد",
    image: "/products/tee.svg",
    variants: {
      create: [
        { size: "M", color: "White", price: 70000, stock: 5 },
        { size: "L", color: "White", price: 70000, stock: 5 },
      ],
    },
  },
});
console.log(
  "Demo seeded: brand nile, staff demo@baddel.local / DemoPass!2026; order #46381 / mariam@example.com.",
);
await db.$disconnect();
