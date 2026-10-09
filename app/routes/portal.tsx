import { useState, useEffect } from "react";
import { Link, useLoaderData, useNavigate } from "react-router";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ArrowRightLeft,
  Upload,
  X,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { db, demo } from "../lib/db.server";
import { api } from "../lib/client";
import { useLocale } from "../lib/i18n";
import { money, reasonLabels, reasons, evidenceNeeded } from "../lib/domain";
import { Logo, LanguageSwitch, ErrorBox, Badge } from "../components/ui";
import type { Merchant, Order, Exchange, Item, Variant } from "../lib/types";
export async function loader({
  params,
}: {
  params: Record<string, string | undefined>;
}) {
  const m = await db.merchant.findUnique({ where: { slug: params.slug } });
  if (!m) throw new Response("Brand not found", { status: 404 });
  return {
    merchant: {
      id: m.id,
      name: m.name,
      slug: m.slug,
      email: m.email,
      color: m.color,
      windowDays: m.windowDays,
      shippingFee: m.shippingFee,
      evidenceRequired: m.evidenceRequired,
      provider: m.provider,
    },
    demo,
  };
}
interface OrderData {
  order: Order;
  merchant: Merchant;
  eligibility: { id: string; ok: boolean; reason: string }[];
}
export default function Portal() {
  const { merchant, demo } = useLoaderData<typeof loader>();
  const { t, lang } = useLocale();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [number, setNumber] = useState(
    demo && merchant.slug === "nile" ? "46381" : "",
  );
  const [email, setEmail] = useState(
    demo && merchant.slug === "nile" ? "mariam@example.com" : "",
  );
  const [challenge, setChallenge] = useState("");
  const [demoCode, setDemoCode] = useState("");
  const [code, setCode] = useState("");
  const [item, setItem] = useState<Item | null>(null);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [replacement, setReplacement] = useState<Variant | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [photos, setPhotos] = useState<{ id: string; url: string }[]>([]);
  const [consent, setConsent] = useState(false);
  const [key] = useState(() => crypto.randomUUID());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<OrderData>("customer/order")
      .then((data) => {
        if (data.merchant.id === merchant.id) {
          setOrderData(data);
          setStep(2);
        }
      })
      .catch(() => {});
  }, [merchant.id]);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };
  const start = () =>
    run(async () => {
      const result = await api<{ challengeId: string; demoCode?: string }>(
        "customer/start",
        { slug: merchant.slug, number, email },
      );
      setChallenge(result.challengeId);
      setDemoCode(result.demoCode || "");
      setCode(result.demoCode || "");
      setStep(1);
    });
  const verify = () =>
    run(async () => {
      await api("customer/verify", { challengeId: challenge, code });
      const data = await api<OrderData>("customer/order");
      if (data.merchant.id !== merchant.id)
        throw new Error("Order belongs to another brand.");
      setOrderData(data);
      setStep(2);
    });
  const upload = (file: File) =>
    run(async () => {
      if (photos.length >= 3) throw new Error("You can upload up to 3 photos.");
      const form = new FormData();
      form.set("file", file);
      const result = await api<{ attachment: { id: string; url: string } }>(
        "customer/upload",
        form,
      );
      setPhotos((p) => [...p, result.attachment]);
    });
  const submit = () =>
    run(async () => {
      const { request } = await api<{ request: Exchange }>(
        "customer/requests",
        {
          itemId: item?.id,
          replacementId: replacement?.id,
          reason,
          notes,
          quantity,
          attachments: photos.map((p) => p.id),
          idempotencyKey: key,
          consent,
          quote: {
            shippingFee: merchant.shippingFee,
            windowDays: merchant.windowDays,
            evidenceRequired: merchant.evidenceRequired,
          },
        },
      );
      navigate(`/portal/${merchant.slug}/track/${request.reference}`);
    });
  const title =
    step === 0
      ? "Find your order"
      : step === 1
        ? "Verify your order"
        : step === 2
          ? "Choose your item"
          : step === 3
            ? "Why are you exchanging?"
            : step === 4
              ? "Choose your replacement"
              : "Review your exchange";
  const subtitle =
    step === 0
      ? "Enter your order number and the email used at checkout."
      : step === 1
        ? "Enter the six-digit code sent to your email."
        : step === 2
          ? "Select the item you’d like to exchange."
          : step === 3
            ? "Tell us what didn’t work."
            : step === 4
              ? "Same favorite. Better fit."
              : "Check the details before submitting.";
  const next = () => {
    setError("");
    if (step === 2 && item) setStep(3);
    if (step === 3 && reason) {
      if (evidenceNeeded(reason, merchant.evidenceRequired) && !photos.length) {
        setError(t("A photo is required for this reason."));
        return;
      }
      setStep(4);
    }
    if (step === 4 && replacement) setStep(5);
  };
  return (
    <div
      className="portal-page"
      style={{ "--brand": merchant.color } as React.CSSProperties}
    >
      <header className="portal-header">
        <Link to={`/portal/${merchant.slug}`} className="brand-wordmark">
          {merchant.name}
        </Link>
        <LanguageSwitch />
      </header>
      <main className="portal-main">
        <div className="portal-intro">
          <span className="eyebrow">{t("Start an exchange")}</span>
          <h1>{t(title)}</h1>
          <p>{t(subtitle)}</p>
        </div>
        {step >= 2 && (
          <div className="stepper">
            {["Item", "Reason", "Replacement", "Review your exchange"].map(
              (name, i) => (
                <div
                  key={name}
                  className={`step ${step >= i + 2 ? "active" : ""}`}
                >
                  <span>{step > i + 2 ? <Check size={13} /> : i + 1}</span>
                  <small>{t(name)}</small>
                </div>
              ),
            )}
          </div>
        )}
        <ErrorBox message={error} />
        {step === 0 && (
          <section className="portal-card lookup-card">
            <form
              method="post"
              onSubmit={(e) => {
                e.preventDefault();
                void start();
              }}
            >
              <label>
                {t("Order number")}
                <div className="input-prefix">
                  <span>#</span>
                  <input
                    aria-label={t("Order number")}
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    placeholder="46381"
                    required
                    maxLength={30}
                    dir="ltr"
                  />
                </div>
              </label>
              <label>
                {t("Email address")}
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  dir="ltr"
                />
              </label>
              <button className="button full" disabled={busy}>
                {t(busy ? "Please wait…" : "Continue")}
                <ArrowRight size={17} />
              </button>
            </form>
            {demo && merchant.slug === "nile" && (
              <div className="demo-inline">
                <ShieldCheck size={16} />
                <span>
                  {lang === "ar"
                    ? "بيانات طلب تجريبي جاهزة للاستخدام."
                    : "Sample order details are filled in for you."}
                </span>
              </div>
            )}
          </section>
        )}
        {step === 1 && (
          <section className="portal-card lookup-card">
            <div className="verification-icon">
              <Mail size={25} />
            </div>
            <form
              method="post"
              onSubmit={(e) => {
                e.preventDefault();
                void verify();
              }}
            >
              <label>
                {t("Verification code")}
                <input
                  className="code-input"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  required
                  pattern="[0-9]{6}"
                  maxLength={6}
                  dir="ltr"
                />
              </label>
              {demo && demoCode && (
                <p className="demo-code">
                  {lang === "ar"
                    ? "رمز تجريبي محلي — لم يتم إرسال بريد:"
                    : "Local demo code — no email sent:"}{" "}
                  <strong>{demoCode}</strong>
                </p>
              )}
              <button className="button full" disabled={busy}>
                {t(busy ? "Please wait…" : "Verify")}
                <ArrowRight size={17} />
              </button>
            </form>
            <button className="text-link" onClick={() => setStep(0)}>
              {t("Back")}
            </button>
          </section>
        )}
        {step === 2 && orderData && (
          <>
            <div className="order-heading">
              <span>
                #{orderData.order.number} · {orderData.order.customerName}
              </span>
              <button
                className="text-link"
                onClick={() =>
                  run(async () => {
                    await api("auth/logout", {});
                    setOrderData(null);
                    setStep(0);
                    setItem(null);
                    setPhotos([]);
                  })
                }
              >
                {t("Choose another order")}
              </button>
            </div>
            <div className="item-list">
              {orderData.order.items.map((i) => {
                const eligibility = orderData.eligibility.find(
                  (e) => e.id === i.id,
                );
                return (
                  <button
                    key={i.id}
                    disabled={!eligibility?.ok}
                    className={`item-choice ${item?.id === i.id ? "selected" : ""}`}
                    onClick={() => {
                      setItem(i);
                      setQuantity(1);
                      setReplacement(null);
                    }}
                  >
                    <img src={i.variant.product.image} alt="" />
                    <div>
                      <h3>
                        {lang === "ar"
                          ? i.variant.product.nameAr
                          : i.variant.product.name}
                      </h3>
                      <p>
                        {i.variant.color} · {t("Size")} {i.variant.size}
                      </p>
                      {!eligibility?.ok && (
                        <small>{t(eligibility?.reason || "")}</small>
                      )}
                    </div>
                    <strong>{money(i.paidPrice, lang)}</strong>
                    <span className="selection-circle">
                      {item?.id === i.id && <Check size={15} />}
                    </span>
                  </button>
                );
              })}
            </div>
            {item && item.quantity - item.committed > 1 && (
              <label className="quantity-control">
                {t("Quantity")}
                <input
                  type="number"
                  min={1}
                  max={item.quantity - item.committed}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                />
              </label>
            )}
            {orderData.order.requests.length > 0 && (
              <section className="existing-requests">
                <h3>{t("Your exchanges")}</h3>
                {orderData.order.requests.map((r) => (
                  <Link
                    key={r.reference}
                    to={`/portal/${merchant.slug}/track/${r.reference}`}
                  >
                    <span>{r.reference}</span>
                    <Badge status={r.status} />
                    <ArrowRight size={16} />
                  </Link>
                ))}
              </section>
            )}
          </>
        )}
        {step === 3 && (
          <section className="portal-card">
            <div className="reason-grid">
              {reasons.map((r) => (
                <button
                  key={r}
                  className={`reason-choice ${reason === r ? "selected" : ""}`}
                  onClick={() => setReason(r)}
                >
                  <span>{t(reasonLabels[r])}</span>
                  <span className="selection-circle">
                    {reason === r && <Check size={13} />}
                  </span>
                </button>
              ))}
            </div>
            <label>
              {t("Additional details")} <small>({t("Optional")})</small>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                maxLength={1000}
              />
            </label>
            <div className="upload-zone">
              <Upload size={23} />
              <strong>
                {t("Upload a photo")}
                {evidenceNeeded(reason, merchant.evidenceRequired) ? " *" : ""}
              </strong>
              <p>
                {t(
                  "Add up to 3 clear photos. JPG, PNG or WebP, up to 5 MB each.",
                )}
              </p>
              <input
                type="file"
                aria-label={t("Upload a photo")}
                accept="image/jpeg,image/png,image/webp"
                disabled={busy || photos.length >= 3}
                onChange={(e) => {
                  if (e.target.files?.[0]) void upload(e.target.files[0]);
                  e.target.value = "";
                }}
              />
            </div>
            {photos.length > 0 && (
              <div className="photo-grid">
                {photos.map((p) => (
                  <div key={p.id}>
                    <img src={p.url} alt={t("Photos")} />
                    <button
                      aria-label={t("Remove")}
                      onClick={() =>
                        setPhotos(photos.filter((a) => a.id !== p.id))
                      }
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
        {step === 4 && item && (
          <section className="portal-card replacement-card">
            <div className="replacement-product">
              <img src={item.variant.product.image} alt="" />
              <div>
                <h3>
                  {lang === "ar"
                    ? item.variant.product.nameAr
                    : item.variant.product.name}
                </h3>
                <p>{item.variant.color}</p>
                <span className="muted">
                  {t("Current size")}: {item.variant.size}
                </span>
              </div>
            </div>
            <h3>{t("Available sizes")}</h3>
            <div className="size-options">
              {item.variant.product.variants.map((v) => (
                <button
                  key={v.id}
                  className={replacement?.id === v.id ? "selected" : ""}
                  disabled={
                    v.id === item.variantId ||
                    v.stock < quantity ||
                    v.price !== item.variant.price
                  }
                  onClick={() => setReplacement(v)}
                  aria-label={`${v.size}${v.stock < quantity ? " " + t("Sold out") : ""}`}
                >
                  {v.size}
                  {v.stock < quantity && <span>{t("Sold out")}</span>}
                </button>
              ))}
            </div>
            <p className="small muted">
              {t("Stock is allocated after approval.")}
            </p>
          </section>
        )}
        {step === 5 && item && replacement && orderData && (
          <section className="portal-card">
            <div className="review-items">
              {[
                {
                  label: "Returning",
                  size: item.variant.size,
                  color: item.variant.color,
                },
                {
                  label: "Replacement",
                  size: replacement.size,
                  color: replacement.color,
                },
              ].map((v, i) => (
                <div className="review-item" key={v.label}>
                  <span className="eyebrow">{t(v.label)}</span>
                  <img src={item.variant.product.image} alt="" />
                  <strong>
                    {lang === "ar"
                      ? item.variant.product.nameAr
                      : item.variant.product.name}
                  </strong>
                  <span>
                    {v.color} · {t("Size")} {v.size} · ×{quantity}
                  </span>
                  {i === 0 && (
                    <ArrowRightLeft className="review-arrow" size={20} />
                  )}
                </div>
              ))}
            </div>
            <div className="summary-line">
              <span>{t("Exchange shipping fee")}</span>
              <strong>{money(merchant.shippingFee, lang)}</strong>
            </div>
            <div className="address-summary">
              <strong>{t("Collection address")}</strong>
              <p>{orderData.order.address}</p>
              <span dir="ltr">{orderData.order.phone}</span>
            </div>
            <p className="workflow-note">
              {t(
                "Your original item will be collected and inspected before the replacement is sent.",
              )}
            </p>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>
                {t(
                  "I agree to the brand’s exchange policy and the fee shown above.",
                )}
              </span>
            </label>
          </section>
        )}
        {step >= 2 && (
          <div className="portal-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => {
                setError("");
                setStep(step === 2 ? 0 : step - 1);
              }}
            >
              <ArrowLeft size={16} />
              {t("Back")}
            </button>
            <button
              className="button"
              onClick={() => (step === 5 ? void submit() : next())}
              disabled={
                busy ||
                (step === 2 && !item) ||
                (step === 3 && !reason) ||
                (step === 4 && !replacement) ||
                (step === 5 && !consent)
              }
            >
              {t(
                busy
                  ? "Please wait…"
                  : step === 5
                    ? "Submit exchange"
                    : "Continue",
              )}
              <ArrowRight size={16} />
            </button>
          </div>
        )}
        <aside className="policy-note">
          <ShieldCheck size={18} />
          <div>
            <strong>{t("Exchange policy")}</strong>
            <p>
              {merchant.windowDays} {t("days after delivery")} ·{" "}
              {t("Exchange shipping fee")}: {money(merchant.shippingFee, lang)}
            </p>
          </div>
        </aside>
      </main>
      <footer className="portal-footer">
        <span>
          {t("Need help?")}{" "}
          <a href={`mailto:${merchant.email}`}>{t("Contact the brand")}</a>
        </span>
        <Link to="/">
          <ArrowRightLeft size={14} />
          {t("Powered by Baddel")}
        </Link>
      </footer>
      {demo && (
        <div className="demo-ribbon">
          {lang === "ar"
            ? "نسخة تجريبية — بيانات محلية، بدون شحن أو تحصيل حقيقي"
            : "DEMO WORKSPACE · Local data · No live courier bookings or payments"}
        </div>
      )}
    </div>
  );
}
