import { reasonLabels } from "./domain";
import type { Exchange, Snapshot } from "./types";

const dayMs = 86400000;
const cairoDate = new Intl.DateTimeFormat("en", {
  timeZone: "Africa/Cairo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const closed = new Set(["completed", "cancelled", "rejected", "resolved"]);
export interface AnalyticsFilters {
  period: "7" | "30" | "90" | "all";
  product: string;
  reason: string;
  status: string;
  search: string;
}
export const defaultAnalyticsFilters: AnalyticsFilters = {
  period: "30",
  product: "all",
  reason: "all",
  status: "valid",
  search: "",
};
export function readSnapshot(value: string): Snapshot {
  try {
    const item = JSON.parse(value);
    if (!item || typeof item !== "object") throw new Error();
    return {
      name: typeof item.name === "string" ? item.name : "Unknown product",
      nameAr: typeof item.nameAr === "string" ? item.nameAr : "منتج غير معروف",
      image: typeof item.image === "string" ? item.image : "",
      size: typeof item.size === "string" ? item.size : "—",
      color: typeof item.color === "string" ? item.color : "—",
      price:
        Number.isSafeInteger(item.price) && item.price >= 0 ? item.price : 0,
    };
  } catch {
    return {
      name: "Unknown product",
      nameAr: "منتج غير معروف",
      image: "",
      size: "—",
      color: "—",
      price: 0,
    };
  }
}
export function productKey(r: Exchange) {
  return r.item?.variant.productId || readSnapshot(r.itemSnapshot).name;
}
function calendarDay(value: string | Date) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return NaN;
  const parts = cairoDate.formatToParts(date);
  const part = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(part("year"), part("month") - 1, part("day")) / dayMs;
}
function dayKey(day: number) {
  return new Date(day * dayMs).toISOString().slice(0, 10);
}
export function buildAnalytics(
  all: Exchange[],
  filters: AnalyticsFilters,
  now = new Date(),
) {
  const today = calendarDay(now);
  const days = filters.period === "all" ? null : Number(filters.period);
  const start = days ? today - days + 1 : -Infinity;
  const requestDays = new Map(all.map((r) => [r.id, calendarDay(r.createdAt)]));
  const matches = (r: Exchange) => {
    const item = readSnapshot(r.itemSnapshot);
    const replacement = readSnapshot(r.replacementSnapshot);
    const haystack = [
      r.reference,
      r.order.number,
      r.order.customerName,
      item.name,
      item.nameAr,
      item.size,
      item.color,
      replacement.size,
      r.notes,
      reasonLabels[r.reason],
    ]
      .join(" ")
      .toLocaleLowerCase();
    return (
      (filters.product === "all" || productKey(r) === filters.product) &&
      (filters.reason === "all" || r.reason === filters.reason) &&
      (filters.status === "all" ||
        (filters.status === "valid"
          ? !["cancelled", "rejected"].includes(r.status)
          : r.status === filters.status)) &&
      haystack.includes(filters.search.trim().toLocaleLowerCase())
    );
  };
  const scoped = all.filter(matches);
  const rows = scoped
    .filter((r) => {
      const day = requestDays.get(r.id)!;
      return day >= start && day <= today;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const previous = days
    ? scoped.filter((r) => {
        const day = requestDays.get(r.id)!;
        return day >= start - days && day < start;
      }).length
    : null;
  const done = rows.filter((r) => r.status === "completed");
  const completionDays = done.flatMap((r) => {
    const duration = r.completedAt
      ? (new Date(r.completedAt).getTime() - new Date(r.createdAt).getTime()) /
        dayMs
      : NaN;
    return Number.isFinite(duration) && duration >= 0 ? [duration] : [];
  });
  const reasons = [
    ...Object.keys(reasonLabels),
    ...new Set(rows.map((r) => r.reason).filter((r) => !reasonLabels[r])),
  ]
    .map((reason) => {
      const matching = rows.filter((r) => r.reason === reason);
      return {
        reason,
        count: matching.length,
        units: matching.reduce((sum, r) => sum + r.quantity, 0),
        share: rows.length ? (matching.length / rows.length) * 100 : 0,
      };
    })
    .sort((a, b) => b.count - a.count);
  const groupProducts = new Map<
    string,
    {
      id: string;
      item: Snapshot;
      count: number;
      units: number;
      value: number;
      reasons: Record<string, number>;
    }
  >();
  const groupSizes = new Map<
    string,
    {
      productId: string;
      name: string;
      nameAr: string;
      from: string;
      to: string;
      color: string;
      toColor: string;
      count: number;
      units: number;
    }
  >();
  for (const r of rows) {
    const item = readSnapshot(r.itemSnapshot);
    const replacement = readSnapshot(r.replacementSnapshot);
    const id = productKey(r);
    const product = groupProducts.get(id) || {
      id,
      item,
      count: 0,
      units: 0,
      value: 0,
      reasons: {},
    };
    product.count++;
    product.units += r.quantity;
    product.value += item.price * r.quantity;
    product.reasons[r.reason] = (product.reasons[r.reason] || 0) + 1;
    groupProducts.set(id, product);
    const sizeKey = JSON.stringify([
      id,
      item.size,
      item.color,
      replacement.size,
      replacement.color,
    ]);
    const size = groupSizes.get(sizeKey) || {
      productId: id,
      name: item.name,
      nameAr: item.nameAr,
      from: item.size,
      to: replacement.size,
      color: item.color,
      toColor: replacement.color,
      count: 0,
      units: 0,
    };
    size.count++;
    size.units += r.quantity;
    groupSizes.set(sizeKey, size);
  }
  const products = [...groupProducts.values()]
    .map((p) => ({
      ...p,
      topReason:
        Object.entries(p.reasons).sort((a, b) => b[1] - a[1])[0]?.[0] || "",
    }))
    .sort((a, b) => b.units - a.units || b.count - a.count);
  const sizes = [...groupSizes.values()].sort((a, b) => b.units - a.units);
  const first = days
    ? start
    : rows.length
      ? rows.reduce(
          (earliest, r) => Math.min(earliest, requestDays.get(r.id)!),
          today,
        )
      : today;
  const bucketDays = Math.max(1, Math.ceil((today - first + 1) / 14));
  const trend = Array.from(
    { length: Math.ceil((today - first + 1) / bucketDays) },
    (_, i) => {
      const from = first + i * bucketDays;
      const to = Math.min(today, from + bucketDays - 1);
      const matching = rows.filter(
        (r) => requestDays.get(r.id)! >= from && requestDays.get(r.id)! <= to,
      );
      return { from: dayKey(from), to: dayKey(to), count: matching.length };
    },
  );
  const queue = rows
    .filter((r) => !closed.has(r.status))
    .map((r) => ({
      request: r,
      idleDays: Math.max(
        0,
        (now.getTime() - new Date(r.updatedAt).getTime()) / dayMs,
      ),
    }))
    .filter((r) => r.request.status === "needs_action" || r.idleDays >= 2)
    .sort(
      (a, b) =>
        Number(b.request.status === "needs_action") -
          Number(a.request.status === "needs_action") ||
        b.idleDays - a.idleDays,
    );
  const insights: {
    kind: "size" | "damaged" | "wrong_item" | "color";
    count: number;
    total: number;
    productId: string;
    name: string;
    nameAr: string;
  }[] = [];
  for (const p of products) {
    const fit = (p.reasons.size_small || 0) + (p.reasons.size_large || 0);
    if (fit >= 3)
      insights.push({
        kind: "size",
        count: fit,
        total: p.count,
        productId: p.id,
        name: p.item.name,
        nameAr: p.item.nameAr,
      });
    for (const kind of ["damaged", "wrong_item", "color"] as const) {
      if ((p.reasons[kind] || 0) >= 2)
        insights.push({
          kind,
          count: p.reasons[kind],
          total: p.count,
          productId: p.id,
          name: p.item.name,
          nameAr: p.item.nameAr,
        });
    }
  }
  return {
    rows,
    reasons,
    products,
    sizes,
    trend,
    queue,
    insights: insights.sort((a, b) => b.count - a.count),
    previous,
    count: rows.length,
    units: rows.reduce((sum, r) => sum + r.quantity, 0),
    completed: done.length,
    retained: done.reduce(
      (sum, r) => sum + readSnapshot(r.itemSnapshot).price * r.quantity,
      0,
    ),
    fees: rows
      .filter((r) => r.feeStatus === "paid")
      .reduce((sum, r) => sum + r.fee, 0),
    averageDays: completionDays.length
      ? completionDays.reduce((a, b) => a + b, 0) / completionDays.length
      : null,
  };
}

export function analyticsCsv(rows: Exchange[]) {
  const cell = (v: unknown) =>
    `"${String(v ?? "")
      .replace(/^[\s]*[=+@\-]/, "'$&")
      .replaceAll('"', '""')}"`;
  const headers = [
    "Reference",
    "Order",
    "Status",
    "Reason",
    "Product",
    "Original size",
    "Original color",
    "Replacement size",
    "Replacement color",
    "Quantity",
    "Merchandise value EGP",
    "Fee EGP",
    "Fee status",
    "Customer comment",
    "Requested at",
  ];
  return (
    "\uFEFF" +
    [
      headers,
      ...rows.map((r) => {
        const item = readSnapshot(r.itemSnapshot),
          replacement = readSnapshot(r.replacementSnapshot);
        return [
          r.reference,
          r.order.number,
          r.status,
          reasonLabels[r.reason] || r.reason,
          item.name,
          item.size,
          item.color,
          replacement.size,
          replacement.color,
          r.quantity,
          ((item.price * r.quantity) / 100).toFixed(2),
          (r.fee / 100).toFixed(2),
          r.feeStatus,
          r.notes,
          r.createdAt,
        ];
      }),
    ]
      .map((row) => row.map(cell).join(","))
      .join("\r\n")
  );
}
