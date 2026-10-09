import { describe, expect, it } from "vitest";
import {
  analyticsCsv,
  buildAnalytics,
  defaultAnalyticsFilters,
  readSnapshot,
} from "../app/lib/analytics";
import type { Exchange } from "../app/lib/types";

const now = new Date("2026-10-09T10:00:00Z");
function request(overrides: Partial<Exchange> = {}): Exchange {
  return {
    id: crypto.randomUUID(),
    reference: "BD-TEST",
    order: { number: "100", customerName: "Sample Shopper" },
    item: { variant: { productId: "tee" } },
    itemSnapshot: JSON.stringify({
      name: "Cotton tee",
      nameAr: "تيشيرت",
      size: "M",
      color: "White",
      price: 65035,
    }),
    replacementSnapshot: JSON.stringify({
      name: "Cotton tee",
      size: "L",
      color: "White",
      price: 80000,
    }),
    createdAt: "2026-10-08T10:00:00Z",
    updatedAt: "2026-10-08T10:00:00Z",
    completedAt: null,
    reason: "size_small",
    quantity: 1,
    status: "submitted",
    fee: 6035,
    feeStatus: "due",
    notes: "",
    exception: null,
    ...overrides,
  } as Exchange;
}
describe("Merchant analytics", () => {
  it("uses Cairo calendar days with inclusive current windows and disjoint previous windows", () => {
    const rows = [
      request({ createdAt: "2026-10-02T22:15:00Z" }), // Oct 3 in Cairo, first selected day.
      request({ createdAt: "2026-10-02T12:00:00Z" }), // Previous period.
      request({ createdAt: "2026-09-26T12:00:00Z" }), // First previous day.
      request({ createdAt: "2026-09-25T12:00:00Z" }), // Too old.
      request({ createdAt: "2026-10-10T12:00:00Z" }), // Future calendar day.
      request({ createdAt: "invalid" }),
    ];
    const a = buildAnalytics(
      rows,
      { ...defaultAnalyticsFilters, period: "7" },
      now,
    );
    expect(a.count).toBe(1);
    expect(a.previous).toBe(2);
    expect(a.trend.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(1);
  });
  it("distinguishes multi-unit requests, paid merchandise snapshots, completion and recorded fees", () => {
    const a = buildAnalytics(
      [
        request({
          quantity: 2,
          status: "completed",
          completedAt: "2026-10-09T10:00:00Z",
          feeStatus: "paid",
        }),
        request({
          reason: "damaged",
          status: "resolved",
          completedAt: "2026-10-09T10:00:00Z",
          feeStatus: "waived",
        }),
        request({ status: "cancelled", quantity: 3, feeStatus: "paid" }),
        request({ status: "rejected" }),
      ],
      defaultAnalyticsFilters,
      now,
    );
    expect(a.count).toBe(2);
    expect(a.units).toBe(3);
    expect(a.completed).toBe(1);
    expect(a.averageDays).toBe(1);
    expect(a.retained).toBe(130070);
    expect(a.fees).toBe(6035);
    expect(a.reasons.find((r) => r.reason === "size_small")).toMatchObject({
      count: 1,
      units: 2,
      share: 50,
    });
  });
  it("keeps product identity across name changes and separates identically named products", () => {
    const renamed = request({
      itemSnapshot: JSON.stringify({
        name: "Updated tee",
        size: "M",
        color: "White",
        price: 50000,
      }),
    });
    const a = buildAnalytics(
      [
        request(),
        renamed,
        request({ item: { variant: { productId: "another-tee" } } }),
      ],
      defaultAnalyticsFilters,
      now,
    );
    expect(a.products).toHaveLength(2);
    expect(a.products.find((p) => p.id === "tee")?.count).toBe(2);
    expect(a.sizes.find((s) => s.productId === "tee")?.units).toBe(2);
  });
  it("combines product, reason, status and customer-comment search without changing export scope", () => {
    const rows = [
      request({ notes: "Fit tight around shoulders", reason: "size_small" }),
      request({ notes: "Color", reason: "color" }),
      request({ notes: "Fit tight", status: "cancelled" }),
      request({
        notes: "Fit tight",
        item: { variant: { productId: "other" } },
      }),
    ];
    const a = buildAnalytics(
      rows,
      {
        ...defaultAnalyticsFilters,
        product: "tee",
        reason: "size_small",
        search: "SHOULDERS",
      },
      now,
    );
    expect(a.count).toBe(1);
    expect(analyticsCsv(a.rows)).toContain("Fit tight around shoulders");
    expect(analyticsCsv(a.rows)).not.toContain('"cancelled"');
    expect(
      buildAnalytics(
        rows,
        { ...defaultAnalyticsFilters, status: "cancelled" },
        now,
      ).count,
    ).toBe(1);
  });
  it("prioritizes explicit exceptions and excludes closed or recently updated requests from follow-ups", () => {
    const a = buildAnalytics(
      [
        request({ reference: "OLD", updatedAt: "2026-10-04T10:00:00Z" }),
        request({ reference: "EXCEPTION", status: "needs_action" }),
        request({ reference: "RECENT" }),
        request({
          reference: "DONE",
          status: "completed",
          updatedAt: "2026-10-01T10:00:00Z",
        }),
        request({ reference: "BOUNDARY", updatedAt: "2026-10-07T10:00:00Z" }),
      ],
      defaultAnalyticsFilters,
      now,
    );
    expect(a.queue.map((q) => q.request.reference)).toEqual([
      "EXCEPTION",
      "OLD",
      "BOUNDARY",
    ]);
  });
  it("requires repeated reports for suggestions and cannot combine evidence across products", () => {
    const small = [request(), request({ reason: "size_large" })];
    expect(
      buildAnalytics(small, defaultAnalyticsFilters, now).insights,
    ).toHaveLength(0);
    const a = buildAnalytics(
      [
        ...small,
        request(),
        request({ reason: "damaged" }),
        request({ reason: "damaged" }),
        request({
          reason: "wrong_item",
          item: { variant: { productId: "other" } },
        }),
      ],
      defaultAnalyticsFilters,
      now,
    );
    expect(a.insights.map((i) => i.kind)).toEqual(["size", "damaged"]);
    expect(a.insights[0]).toMatchObject({ count: 3, total: 5 });
  });
  it("handles empty selections and corrupt snapshots without NaN money or fake completion averages", () => {
    const empty = buildAnalytics([], defaultAnalyticsFilters, now);
    expect(empty.averageDays).toBeNull();
    expect(empty.count).toBe(0);
    expect(empty.reasons.every((r) => r.share === 0)).toBe(true);
    expect(readSnapshot("broken").price).toBe(0);
    expect(readSnapshot('{"price":-100}').price).toBe(0);
    expect(
      buildAnalytics(
        [
          request({
            itemSnapshot: "broken",
            status: "completed",
            completedAt: null,
          }),
        ],
        defaultAnalyticsFilters,
        now,
      ).retained,
    ).toBe(0);
  });
  it("escapes CSV formula injection, quotes and multiline customer comments", () => {
    const csv = analyticsCsv([
      request({
        notes: '\t=HYPERLINK("bad")\nsecond line',
        reference: "+FORMULA",
      }),
    ]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"\'+FORMULA"');
    expect(csv).toContain('"\'\t=HYPERLINK(""bad"")\nsecond line"');
  });
  it("bounds all-time trend columns and does not compare all-time with an invented previous period", () => {
    const a = buildAnalytics(
      [request({ createdAt: "2023-01-01T12:00:00Z" }), request()],
      { ...defaultAnalyticsFilters, period: "all" },
      now,
    );
    expect(a.previous).toBeNull();
    expect(a.trend.length).toBeLessThanOrEqual(14);
    expect(a.trend.reduce((sum, b) => sum + b.count, 0)).toBe(2);
  });
});
