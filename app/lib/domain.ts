export const reasons = [
  "size_small",
  "size_large",
  "wrong_item",
  "damaged",
  "color",
] as const;
export const statuses = [
  "submitted",
  "approved",
  "return_in_transit",
  "inspection",
  "replacement_in_transit",
  "completed",
  "rejected",
  "cancelled",
  "resolved",
  "needs_action",
] as const;
export type Status = (typeof statuses)[number];
export const statusLabels: Record<string, string> = {
  submitted: "Awaiting review",
  approved: "Approved",
  return_in_transit: "Return on the way",
  inspection: "Ready to inspect",
  replacement_in_transit: "Replacement on the way",
  completed: "Completed",
  rejected: "Declined",
  cancelled: "Cancelled",
  resolved: "Resolved by staff",
  needs_action: "Needs attention",
};
export const reasonLabels: Record<string, string> = {
  size_small: "Size is too small",
  size_large: "Size is too large",
  wrong_item: "Received the wrong item",
  damaged: "Item is damaged",
  color: "Prefer another color",
};
export const money = (piastres: number, language = "en") =>
  new Intl.NumberFormat(language === "ar" ? "ar-EG" : "en-EG", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: piastres % 100 ? 2 : 0,
  }).format(piastres / 100);
export function eligible(
  delivered: Date | string | null,
  windowDays: number,
  excluded = false,
  available = 1,
  time = new Date(),
) {
  if (!delivered)
    return { ok: false, reason: "This order has not been delivered yet." };
  const date = new Date(delivered);
  if (date > time)
    return { ok: false, reason: "Delivery date has not arrived yet." };
  if (time.getTime() - date.getTime() > windowDays * 86400000)
    return { ok: false, reason: "The exchange window has ended." };
  if (excluded)
    return { ok: false, reason: "This item is excluded from exchanges." };
  if (available < 1)
    return {
      ok: false,
      reason: "An exchange is already in progress for this item.",
    };
  return { ok: true, reason: "" };
}
export function evidenceNeeded(reason: string, required: boolean) {
  return required && ["wrong_item", "damaged"].includes(reason);
}
