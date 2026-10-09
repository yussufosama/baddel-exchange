import { useEffect } from "react";
import { Link, useParams } from "react-router";
import {
  CheckCircle2,
  ArrowRightLeft,
  Package,
  RefreshCw,
  Clock,
  Truck,
} from "lucide-react";
import { useRemote } from "../lib/client";
import { useLocale } from "../lib/i18n";
import { money, statusLabels } from "../lib/domain";
import {
  LanguageSwitch,
  Badge,
  Loading,
  ErrorBox,
  date,
} from "../components/ui";
import type { Exchange, Snapshot, Merchant } from "../lib/types";
export default function Tracking() {
  const { slug, reference } = useParams();
  const { t, lang } = useLocale();
  const { data, error, loading, refresh } = useRemote<{
    request: Exchange;
    merchant: Merchant;
    demo: boolean;
  }>(`customer/requests/${reference}`);
  const r = data?.request;
  useEffect(() => {
    if (!r) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 30000);
    return () => clearInterval(timer);
  }, [r?.id, refresh]);
  const descriptions: Record<string, string> = {
    submitted:
      "The brand will review your request before arranging collection.",
    approved: "Your exchange is approved. The brand will arrange collection.",
    return_in_transit: "Your original item is being returned to the brand.",
    inspection:
      "The brand is inspecting your returned item before sending the replacement.",
    replacement_in_transit:
      "Your replacement has been dispatched. Check the shipment reference below.",
    completed: "Your replacement was delivered and this exchange is complete.",
    rejected:
      "The brand declined this request. Check the history for the reason.",
    cancelled: "This exchange was cancelled. Check the history for details.",
    resolved:
      "The brand recorded an alternative resolution. Check the history for details.",
    needs_action: "The brand is following up on an issue with this exchange.",
  };
  const a = r ? (JSON.parse(r.itemSnapshot) as Snapshot) : null;
  const b = r ? (JSON.parse(r.replacementSnapshot) as Snapshot) : null;
  const stages = [
    "submitted",
    "approved",
    "return_in_transit",
    "inspection",
    "replacement_in_transit",
    "completed",
  ];
  const current = r
    ? stages.indexOf(
        r.status === "needs_action"
          ? r.previousStatus || "submitted"
          : r.status,
      )
    : -1;
  return (
    <div
      className="portal-page"
      style={
        { "--brand": data?.merchant.color || "#175c4a" } as React.CSSProperties
      }
    >
      <header className="portal-header">
        <Link to={`/portal/${slug}`} className="brand-wordmark">
          {data?.merchant.name || t("Track your exchange")}
        </Link>
        <LanguageSwitch />
      </header>
      <main className="tracking-main">
        {loading && !r ? (
          <Loading />
        ) : error ? (
          <>
            <ErrorBox message={error} />
            <Link className="button" to={`/portal/${slug}`}>
              {t("Verify your order")}
            </Link>
          </>
        ) : r && a && b ? (
          <>
            <div className="tracking-heading">
              <span className="success-ring">
                <CheckCircle2 size={36} />
              </span>
              <h1>
                {t(
                  r.status === "submitted"
                    ? "We’ve received your request"
                    : "Track your exchange",
                )}
              </h1>
              <p>{t(descriptions[r.status] || "Track your exchange")}</p>
              <div className="tracking-ref">
                <strong>{r.reference}</strong>
                <Badge status={r.status} />
                <button
                  className="icon-button"
                  onClick={() => void refresh()}
                  aria-label={t("Refresh")}
                >
                  <RefreshCw size={17} />
                </button>
              </div>
            </div>
            {r.exception && <div className="alert warning">{r.exception}</div>}
            <section className="portal-card">
              <div className="tracking-item">
                <img src={a.image} alt="" />
                <div>
                  <h3>{lang === "ar" ? a.nameAr : a.name}</h3>
                  <div className="tracking-sizes">
                    <span>
                      {a.color} · {a.size}
                    </span>
                    <ArrowRightLeft size={16} />
                    <strong>
                      {b.color} · {b.size}
                    </strong>
                  </div>
                </div>
              </div>
              <div className="summary-line">
                <span>{t("Exchange shipping fee")}</span>
                <strong>
                  {money(r.fee, lang)} ·{" "}
                  {t(
                    r.feeStatus === "paid"
                      ? "Paid"
                      : r.feeStatus === "waived"
                        ? "Waived"
                        : "Due",
                  )}
                </strong>
              </div>
              <div className="timeline">
                {stages.map((stage, i) => (
                  <div
                    className={`timeline-step ${i <= current ? "done" : ""}`}
                    key={stage}
                  >
                    <span>
                      {i < current ? (
                        <CheckCircle2 size={18} />
                      ) : i === current ? (
                        <Clock size={18} />
                      ) : (
                        <Package size={17} />
                      )}
                    </span>
                    <div>
                      <strong>{t(statusLabels[stage])}</strong>
                      {i === current && <small>{t("Status")}</small>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <section className="portal-card">
              <h2>{t("Shipments")}</h2>
              {r.shipments.length ? (
                r.shipments.map((s) => (
                  <div className="shipment-row" key={s.id}>
                    <Truck size={19} />
                    <div>
                      <strong>
                        {t(s.direction === "return" ? "Return" : "Replacement")}
                      </strong>
                      <p>
                        {s.tracking} · {t("Manual")}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted">{t("No shipments recorded yet.")}</p>
              )}
            </section>
            <section className="portal-card">
              <h2>{t("History")}</h2>
              <div className="event-list">
                {r.events.map((e) => (
                  <div className="event" key={e.id}>
                    <i />
                    <div>
                      <p>{e.message}</p>
                      <small>
                        {e.actor} · {date(e.createdAt, lang)}
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <Link className="button secondary" to={`/portal/${slug}`}>
              {t("Your exchanges")}
            </Link>
          </>
        ) : null}
      </main>
      <footer className="portal-footer">
        <span>Baddel · {t("Exchange management")}</span>
        <Link to="/">{t("Powered by Baddel")}</Link>
      </footer>
      {data?.demo && (
        <div className="demo-ribbon">
          {lang === "ar"
            ? "نسخة تجريبية — بيانات محلية، بدون شحن أو تحصيل حقيقي"
            : "DEMO WORKSPACE · Local data · No live courier bookings or payments"}
        </div>
      )}
    </div>
  );
}
