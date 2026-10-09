import { useState, useEffect } from "react";
import { Link, redirect, useSearchParams } from "react-router";
import {
  LayoutDashboard,
  ArrowRightLeft,
  Package,
  ShoppingBag,
  BarChart3,
  Settings,
  LogOut,
  ArrowUpRight,
  ArrowRight,
  Search,
  Plus,
  ChevronRight,
  Download,
  Clock3,
  CheckCircle2,
  CircleAlert,
  Menu,
  X,
  Mail,
  RefreshCw,
  Check,
  Truck,
  ExternalLink,
} from "lucide-react";
import { requireStaff } from "../lib/security.server";
import { ExchangeAnalytics } from "../components/analytics";
import { api, useRemote } from "../lib/client";
import { useLocale } from "../lib/i18n";
import { money, statusLabels, reasonLabels, statuses } from "../lib/domain";
import {
  Logo,
  LanguageSwitch,
  Badge,
  Reason,
  Loading,
  ErrorBox,
  Empty,
  Modal,
  date,
} from "../components/ui";
import type {
  Dashboard as DashboardData,
  Exchange,
  Merchant,
  Product,
  Order,
  Snapshot,
  Variant,
} from "../lib/types";
export async function loader({ request }: { request: Request }) {
  try {
    await requireStaff(request);
    return null;
  } catch {
    return redirect("/login");
  }
}
const tabs = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "exchanges", label: "Exchanges", icon: ArrowRightLeft },
  { key: "inventory", label: "Inventory", icon: Package },
  { key: "orders", label: "Orders", icon: ShoppingBag },
  { key: "reports", label: "Reports", icon: BarChart3 },
  { key: "settings", label: "Settings", icon: Settings },
];
export default function Dashboard() {
  const { t, lang } = useLocale();
  const [params, setParams] = useSearchParams();
  const tab = params.get("view") || "overview";
  const remote = useRemote<DashboardData>("dashboard");
  const data = remote.data;
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") void remote.refresh();
    };
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [remote.refresh]);
  const [menu, setMenu] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const requests = data?.requests || [];
  const pending = requests.filter((r) => r.status === "submitted").length;
  const active = requests.filter((r) =>
    [
      "approved",
      "return_in_transit",
      "inspection",
      "replacement_in_transit",
    ].includes(r.status),
  ).length;
  const done = requests.filter((r) => r.status === "completed").length;
  const attention = requests.filter((r) => r.status === "needs_action").length;
  const filtered = requests.filter(
    (r) =>
      (filter === "all" || r.status === filter) &&
      `${r.reference} ${r.order.number} ${r.order.customerName} ${r.notes} ${reasonLabels[r.reason]} ${r.itemSnapshot}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const title = t(tabs.find((v) => v.key === tab)?.label || "Overview");
  const switchTab = (key: string) => {
    setParams({ view: key });
    setMenu(false);
    void remote.refresh();
  };
  const logout = async () => {
    await api("auth/logout", {});
    window.location.href = "/login";
  };
  return (
    <div className="dashboard-shell">
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <div className="sidebar-brand">
          <Logo />
          <button
            className="icon-button sidebar-close"
            onClick={() => setMenu(false)}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <div className="workspace-switch">
          <span className="brand-avatar">{data?.merchant.name[0] || "N"}</span>
          <div>
            <strong>{data?.merchant.name || "Brand workspace"}</strong>
            <small>{t("Brand workspace")}</small>
          </div>
        </div>
        <span className="sidebar-caption">{t("Exchange management")}</span>
        <nav>
          {tabs.map((v) => (
            <button
              key={v.key}
              className={tab === v.key ? "active" : ""}
              onClick={() => switchTab(v.key)}
            >
              <v.icon size={19} />
              <span>{t(v.label)}</span>
              {v.key === "exchanges" && pending > 0 && <i>{pending}</i>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="portal-callout">
            <ArrowRightLeft size={21} />
            <strong>{t("Customer portal")}</strong>
            <p>
              {lang === "ar"
                ? "تجربة استبدال خاصة ببراندك."
                : "Your brand. A simpler exchange."}
            </p>
            <Link
              to={`/portal/${data?.merchant.slug || "nile"}`}
              target="_blank"
              rel="noreferrer"
            >
              {t("View portal")}
              <ArrowUpRight size={15} />
            </Link>
          </div>
          <button className="logout" onClick={() => void logout()}>
            <LogOut size={18} />
            {t("Sign out")}
          </button>
          <div className="staff-footer">
            <span>{data?.staff.name[0] || "Y"}</span>
            <div>
              <strong>{data?.staff.name || "…"}</strong>
              <small>{data?.staff.role || "owner"}</small>
            </div>
            <span className="online-dot" />
          </div>
        </div>
      </aside>
      {menu && (
        <div className="sidebar-backdrop" onClick={() => setMenu(false)} />
      )}
      <div className="dashboard-content">
        <header className="dashboard-header">
          <div>
            <button
              className="icon-button mobile-menu"
              onClick={() => setMenu(!menu)}
              aria-label="Open navigation"
            >
              <Menu size={22} />
            </button>
            <span className="breadcrumb">
              {t("Brand workspace")}
              <ChevronRight size={14} />
              <strong>{title}</strong>
            </span>
          </div>
          <div className="header-right">
            <span className="workspace-mode">
              {data?.demo ? "LOCAL DEMO" : "MANUAL WORKSPACE"}
            </span>
            <LanguageSwitch />
          </div>
        </header>
        <main className="dashboard-main">
          <ErrorBox message={remote.error} />
          {remote.loading && !data ? (
            <Loading />
          ) : (
            data && (
              <>
                {tab === "overview" ? (
                  <>
                    <div className="page-heading">
                      <div>
                        <span className="eyebrow">
                          {new Date().toLocaleDateString(
                            lang === "ar" ? "ar-EG" : "en-GB",
                            { weekday: "long", day: "numeric", month: "long" },
                          )}
                        </span>
                        <h1>
                          {t("Good morning")}, {data.staff.name.split(" ")[0]}{" "}
                          <span className="wave">✳</span>
                        </h1>
                        <p>
                          {t("Here’s what’s happening with your exchanges.")}
                        </p>
                      </div>
                      <Link
                        className="button secondary"
                        to={`/portal/${data.merchant.slug}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t("Open customer portal")}
                        <ArrowUpRight size={16} />
                      </Link>
                    </div>
                    <div className="stats-grid">
                      {[
                        {
                          label: "Awaiting review",
                          value: pending,
                          icon: Clock3,
                          note:
                            lang === "ar"
                              ? "جاهزة لقرارك"
                              : "Ready for your decision",
                          color: "amber",
                        },
                        {
                          label: "Active exchanges",
                          value: active,
                          icon: ArrowRightLeft,
                          note:
                            lang === "ar"
                              ? "من الاستلام إلى التسليم"
                              : "From collection to delivery",
                          color: "green",
                        },
                        {
                          label: "Completed",
                          value: done,
                          icon: CheckCircle2,
                          note:
                            lang === "ar"
                              ? "تم توصيل البديل"
                              : "Replacement delivered",
                          color: "blue",
                        },
                        {
                          label: "Needs attention",
                          value: attention,
                          icon: CircleAlert,
                          note:
                            lang === "ar"
                              ? "تابع هذه الحالات"
                              : "Follow up on these cases",
                          color: "red",
                        },
                      ].map((s) => (
                        <button
                          className={`stat-card ${s.color}`}
                          key={s.label}
                          onClick={() => {
                            setFilter(
                              s.label === "Awaiting review"
                                ? "submitted"
                                : s.label === "Completed"
                                  ? "completed"
                                  : s.label === "Needs attention"
                                    ? "needs_action"
                                    : "all",
                            );
                            switchTab("exchanges");
                          }}
                        >
                          <div>
                            <span>{t(s.label)}</span>
                            <s.icon size={19} />
                          </div>
                          <strong>{s.value.toString().padStart(2, "0")}</strong>
                          <small>
                            {s.note}
                            <ArrowUpRight size={13} />
                          </small>
                        </button>
                      ))}
                    </div>
                    <section className="analytics-overview-callout">
                      <div>
                        <BarChart3 size={22} />
                        <div>
                          <strong>
                            {lang === "ar"
                              ? "لماذا يطلب العملاء الاستبدال؟"
                              : "Why are customers exchanging?"}
                          </strong>
                          <p>
                            {lang === "ar"
                              ? "راجع المنتجات والمقاسات وتعليقات العملاء والطلبات التي تحتاج متابعة."
                              : "Explore product and sizing patterns, customer comments, and requests that need follow-up."}
                          </p>
                        </div>
                      </div>
                      <button
                        className="button secondary small-button"
                        onClick={() => switchTab("reports")}
                      >
                        {lang === "ar"
                          ? "تحليل أسباب الاستبدال"
                          : "Analyze exchange reasons"}
                        <ArrowUpRight size={15} />
                      </button>
                    </section>
                    <section className="panel">
                      <div className="panel-heading">
                        <h2>
                          {t("Recent exchanges")}{" "}
                          <span className="count">{requests.length}</span>
                        </h2>
                        <button
                          className="text-link"
                          onClick={() => switchTab("exchanges")}
                        >
                          {t("View all")}
                          <ArrowRight size={15} />
                        </button>
                      </div>
                      <RequestTable
                        requests={requests.slice(0, 6)}
                        onSelect={setSelected}
                      />
                    </section>
                    <div className="overview-bottom">
                      <section className="panel attention-panel">
                        <div className="panel-heading">
                          <h2>
                            <CircleAlert size={18} />
                            {t("Needs attention")}
                          </h2>
                          <span className="count">{attention}</span>
                        </div>
                        {attention ? (
                          requests
                            .filter((r) => r.status === "needs_action")
                            .map((r) => (
                              <button
                                className="attention-row"
                                key={r.id}
                                onClick={() => setSelected(r.reference)}
                              >
                                <span className="attention-icon">
                                  <CircleAlert size={18} />
                                </span>
                                <div>
                                  <strong>
                                    {r.reference} · {r.order.customerName}
                                  </strong>
                                  <p>{r.exception}</p>
                                </div>
                                <ChevronRight size={18} />
                              </button>
                            ))
                        ) : (
                          <div className="all-clear">
                            <CheckCircle2 size={22} />
                            <p>
                              {lang === "ar"
                                ? "كل شيء على ما يرام."
                                : "All clear. Nothing needs attention."}
                            </p>
                          </div>
                        )}
                      </section>
                      <section className="workflow-panel">
                        <span className="eyebrow">
                          {lang === "ar" ? "خطوات واضحة" : "A CLEAR NEXT STEP"}
                        </span>
                        <h3>
                          {lang === "ar"
                            ? "استلام. فحص. استبدال."
                            : "Collect. Inspect. Replace."}
                        </h3>
                        <p>
                          {lang === "ar"
                            ? "كل طلب له سجل واضح وخطوة تالية."
                            : "Every request has a history and a clear next action."}
                        </p>
                        <div>
                          <span>
                            <Truck size={16} />
                            {t("Return")}
                          </span>
                          <ArrowRight size={14} />
                          <span>
                            <Check size={16} />
                            {t("Ready to inspect")}
                          </span>
                          <ArrowRight size={14} />
                          <span>
                            <Package size={16} />
                            {t("Replacement")}
                          </span>
                        </div>
                      </section>
                    </div>
                  </>
                ) : tab === "exchanges" ? (
                  <>
                    <div className="page-heading">
                      <div>
                        <span className="eyebrow">
                          {t("Exchange management")}
                        </span>
                        <h1>{t("All requests")}</h1>
                        <p>
                          {lang === "ar"
                            ? "راجع الطلبات وتابع كل خطوة."
                            : "Review requests and keep every exchange moving."}
                        </p>
                      </div>
                      <a className="button secondary" href="/api/export">
                        <Download size={16} />
                        {t("Export CSV")}
                      </a>
                    </div>
                    <section className="panel">
                      <div className="table-toolbar">
                        <div className="search-box">
                          <Search size={18} />
                          <input
                            placeholder={t("Search requests…")}
                            aria-label={t("Search requests…")}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                          />
                        </div>
                        <select
                          aria-label={t("All statuses")}
                          value={filter}
                          onChange={(e) => setFilter(e.target.value)}
                        >
                          <option value="all">{t("All statuses")}</option>
                          {statuses.map((s) => (
                            <option value={s} key={s}>
                              {t(statusLabels[s])}
                            </option>
                          ))}
                        </select>
                      </div>
                      <RequestTable
                        requests={filtered}
                        onSelect={setSelected}
                      />
                    </section>
                  </>
                ) : tab === "inventory" ? (
                  <Inventory />
                ) : tab === "orders" ? (
                  <Orders />
                ) : tab === "reports" ? (
                  <Reports
                    data={data}
                    refresh={remote.refresh}
                    onSelect={setSelected}
                  />
                ) : tab === "settings" ? (
                  <SettingsForm
                    merchant={data.merchant}
                    refresh={remote.refresh}
                  />
                ) : null}
                {data.demo && (
                  <div className="dashboard-demo-note">
                    <ShieldDemo />
                    {lang === "ar"
                      ? "بيانات تجريبية • الشحنات يدوية • الإشعارات التجريبية لا ترسل بريداً"
                      : "Demo data · Shipments are recorded manually · Demo notifications do not send email"}
                  </div>
                )}
              </>
            )
          )}
        </main>
        <footer className="dashboard-footer">
          <span>Baddel · {t("Exchange management")}</span>
          <span>Egypt · EGP</span>
        </footer>
      </div>
      {selected && (
        <RequestDetail
          reference={selected}
          onClose={() => setSelected(null)}
          onUpdated={remote.refresh}
        />
      )}
    </div>
  );
}
function ShieldDemo() {
  return <span className="green-dot" />;
}
function RequestTable({
  requests,
  onSelect,
}: {
  requests: Exchange[];
  onSelect: (r: string) => void;
}) {
  const { t, lang } = useLocale();
  if (!requests.length)
    return <Empty>{t("No exchanges match your filters.")}</Empty>;
  return (
    <div className="table-scroll">
      <table className="requests-table">
        <thead>
          <tr>
            {["Reference", "Customer", "Item", "Reason", "Status", "Date"].map(
              (v) => (
                <th key={v}>{t(v)}</th>
              ),
            )}
            <th />
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => {
            const a = JSON.parse(r.itemSnapshot) as Snapshot;
            const b = JSON.parse(r.replacementSnapshot) as Snapshot;
            return (
              <tr key={r.id}>
                <td>
                  <button
                    className="reference-link"
                    onClick={() => onSelect(r.reference)}
                  >
                    {r.reference}
                  </button>
                  <small>#{r.order.number}</small>
                </td>
                <td>
                  <div className="customer-cell">
                    <span>
                      {r.order.customerName
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")}
                    </span>
                    <strong>{r.order.customerName}</strong>
                  </div>
                </td>
                <td>
                  <div className="table-product">
                    <img src={a.image} alt="" />
                    <div>
                      <strong>{lang === "ar" ? a.nameAr : a.name}</strong>
                      <small>
                        {a.size}
                        <ArrowRight size={10} />
                        {b.size}
                      </small>
                    </div>
                  </div>
                </td>
                <td className="reason-cell">
                  <Reason value={r.reason} />
                </td>
                <td>
                  <Badge status={r.status} />
                </td>
                <td className="date-cell">{date(r.createdAt, lang)}</td>
                <td>
                  <button
                    className="icon-button"
                    onClick={() => onSelect(r.reference)}
                    aria-label={`${t("View exchange")} ${r.reference}`}
                  >
                    <ChevronRight size={18} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
function RequestDetail({
  reference,
  onClose,
  onUpdated,
}: {
  reference: string;
  onClose: () => void;
  onUpdated: () => Promise<void>;
}) {
  const { t, lang } = useLocale();
  const { data, error, loading, refresh } = useRemote<{ request: Exchange }>(
    `requests/${reference}`,
  );
  const r = data?.request;
  const [note, setNote] = useState("");
  const [tracking, setTracking] = useState("");
  const [actionError, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const act = async (action: string, payment?: string) => {
    if (!r) return;
    setBusy(true);
    setError("");
    try {
      await api(`requests/${reference}`, {
        action,
        version: r.version,
        note,
        tracking,
        payment,
      });
      setNote("");
      setTracking("");
      await refresh();
      await onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update.");
    } finally {
      setBusy(false);
    }
  };
  const original = r ? (JSON.parse(r.itemSnapshot) as Snapshot) : null;
  const replacement = r
    ? (JSON.parse(r.replacementSnapshot) as Snapshot)
    : null;
  const closed =
    r && ["completed", "rejected", "cancelled", "resolved"].includes(r.status);
  return (
    <Modal title={reference} onClose={onClose}>
      {loading && !r ? (
        <Loading />
      ) : r && original && replacement ? (
        <>
          <div className="detail-top">
            <Badge status={r.status} />
            <span>
              #{r.order.number} · {date(r.createdAt, lang)}
            </span>
          </div>
          <div className="detail-product">
            <img src={original.image} alt="" />
            <div>
              <h3>{lang === "ar" ? original.nameAr : original.name}</h3>
              <p>
                {original.size} <ArrowRight size={14} /> {replacement.size} ·{" "}
                {replacement.color} · ×{r.quantity}
              </p>
              <span>{money(original.price * r.quantity, lang)}</span>
            </div>
          </div>
          <div className="detail-info-grid">
            <section>
              <h4>{t("Customer")}</h4>
              <strong>{r.order.customerName}</strong>
              <p>
                {r.order.email}
                <br />
                {r.order.phone}
                <br />
                {r.order.address}
              </p>
            </section>
            <section>
              <h4>{t("Reason")}</h4>
              <strong>
                <Reason value={r.reason} />
              </strong>
              <p>{r.notes || "—"}</p>
            </section>
          </div>
          {r.attachments.length > 0 && (
            <div className="detail-photos">
              <h4>{t("Photos")}</h4>
              {r.attachments.map((a) => (
                <a
                  href={`/api/attachments/${a.id}`}
                  target="_blank"
                  rel="noreferrer"
                  key={a.id}
                >
                  <img src={`/api/attachments/${a.id}`} alt={t("Photos")} />
                </a>
              ))}
            </div>
          )}
          <div className="fee-box">
            <span>{t("Exchange shipping fee")}</span>
            <strong>{money(r.fee, lang)}</strong>
            <span className={`payment-${r.feeStatus}`}>
              {t(
                r.feeStatus === "paid"
                  ? "Paid"
                  : r.feeStatus === "waived"
                    ? "Waived"
                    : "Due",
              )}
            </span>
          </div>
          {r.exception && <div className="alert warning">{r.exception}</div>}
          <ErrorBox message={actionError || error} />
          {!closed && (
            <section className="action-section">
              <h3>{t("Actions")}</h3>
              <label>
                {t("Decision / payment reference / note")}
                <textarea
                  disabled={busy}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  maxLength={1000}
                />
              </label>
              {["approved", "inspection"].includes(r.status) && (
                <label>
                  {t("Tracking reference")}
                  <input
                    disabled={busy}
                    aria-label={t("Tracking reference")}
                    value={tracking}
                    onChange={(e) => setTracking(e.target.value)}
                    maxLength={100}
                  />
                  <small>
                    {lang === "ar"
                      ? "أدخل مرجع الشحنة الذي حصلت عليه من شركة الشحن."
                      : "Enter a reference you obtained from your courier. This does not book a shipment."}
                  </small>
                </label>
              )}
              <div className="action-buttons">
                {r.status === "submitted" && (
                  <>
                    <button
                      className="button"
                      disabled={busy}
                      onClick={() => void act("approve")}
                    >
                      {t("Approve exchange")}
                    </button>
                    <button
                      className="button danger secondary"
                      disabled={busy}
                      onClick={() => void act("reject")}
                    >
                      {t("Decline request")}
                    </button>
                  </>
                )}
                {r.status === "approved" && (
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() => void act("schedule_return")}
                  >
                    {t("Schedule collection")}
                  </button>
                )}
                {r.status === "return_in_transit" && (
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() => void act("receive_return")}
                  >
                    {t("Mark return received")}
                  </button>
                )}
                {r.status === "inspection" && !r.returnedRestocked && (
                  <>
                    <button
                      className="button"
                      disabled={busy}
                      onClick={() => void act("pass_inspection")}
                    >
                      {t("Pass inspection")}
                    </button>
                    <button
                      className="button danger secondary"
                      disabled={busy}
                      onClick={() => void act("fail_inspection")}
                    >
                      {t("Inspection failed")}
                    </button>
                  </>
                )}
                {r.status === "inspection" && r.returnedRestocked && (
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() => void act("dispatch")}
                  >
                    {t("Dispatch replacement")}
                  </button>
                )}
                {r.status === "replacement_in_transit" && (
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() => void act("delivered")}
                  >
                    {t("Mark delivered")}
                  </button>
                )}
                {r.status === "needs_action" && (
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() => void act("resolve")}
                  >
                    {t("Resolve issue")}
                  </button>
                )}
                {r.status === "needs_action" && (
                  <button
                    className="button danger secondary"
                    disabled={busy}
                    onClick={() => void act("close_resolution")}
                  >
                    {t("Close with alternative resolution")}
                  </button>
                )}
                {["submitted", "approved"].includes(r.status) && (
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() => void act("cancel")}
                  >
                    {t("Cancel request")}
                  </button>
                )}
                {r.status !== "needs_action" && (
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() => void act("flag")}
                  >
                    {t("Flag an issue")}
                  </button>
                )}
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => void act("note")}
                >
                  {t("Add note")}
                </button>
              </div>
              {r.feeStatus === "due" && (
                <div className="payment-actions">
                  <small>
                    {t(
                      "Payment must be confirmed or waived before completion.",
                    )}
                  </small>
                  <div>
                    <button
                      className="text-link"
                      disabled={busy}
                      onClick={() => void act("payment", "paid")}
                    >
                      {t("Confirm payment")}
                    </button>
                    <button
                      className="text-link"
                      disabled={busy}
                      onClick={() => void act("payment", "waived")}
                    >
                      {t("Waive fee")}
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}
          <section className="detail-section">
            <h3>{t("Shipments")}</h3>
            {r.shipments.length ? (
              r.shipments.map((s) => (
                <div className="shipment-row" key={s.id}>
                  <Truck size={17} />
                  <div>
                    <strong>
                      {t(s.direction === "return" ? "Return" : "Replacement")}
                    </strong>
                    <p>
                      {s.tracking} · {s.status} · {t("Manual")}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="muted">{t("No shipments recorded yet.")}</p>
            )}
          </section>
          <section className="detail-section">
            <h3>{t("History")}</h3>
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
        </>
      ) : (
        <ErrorBox message={error} />
      )}
    </Modal>
  );
}
function Inventory() {
  const { t, lang } = useLocale();
  const { data, loading, error, refresh } = useRemote<{ products: Product[] }>(
    "inventory",
  );
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const add = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const f = new FormData(e.currentTarget);
    try {
      await api("inventory", {
        name: f.get("name"),
        nameAr: f.get("nameAr"),
        price: Math.round(Number(f.get("price")) * 100),
        color: f.get("color"),
        sizes: String(f.get("sizes"))
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
        stock: Number(f.get("stock")),
      });
      setAdding(false);
      setMessage(t("Product added"));
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Unable to add product.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{t("Available stock")}</span>
          <h1>{t("Inventory")}</h1>
          <p>
            {lang === "ar"
              ? "المخزون المتاح لا يشمل القطع المخصصة للاستبدالات الموافق عليها."
              : "Available stock excludes units allocated to approved exchanges."}
          </p>
        </div>
        <button className="button" onClick={() => setAdding(true)}>
          <Plus size={16} />
          {t("Add product")}
        </button>
      </div>
      <ErrorBox message={error} />
      {message && <div className="alert success">{message}</div>}
      {loading && !data ? (
        <Loading />
      ) : data?.products.length ? (
        <div className="inventory-grid">
          {data.products.map((p) => (
            <section className="panel inventory-product" key={p.id}>
              <div className="inventory-product-header">
                <img src={p.image} alt="" />
                <div>
                  <h3>{lang === "ar" ? p.nameAr : p.name}</h3>
                  <p>
                    {p.variants[0]?.color} ·{" "}
                    {money(p.variants[0]?.price || 0, lang)}
                  </p>
                </div>
              </div>
              <div className="stock-rows">
                {p.variants.map((v) => (
                  <StockRow key={v.id} variant={v} onUpdated={refresh} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <Empty>{t("No products yet. Add your first product.")}</Empty>
      )}
      {adding && (
        <Modal title={t("Add product")} onClose={() => setAdding(false)}>
          <ErrorBox message={err} />
          <form method="post" onSubmit={add}>
            <label>
              {t("Product name")}
              <input name="name" required minLength={2} maxLength={80} />
            </label>
            <label>
              {t("Arabic name")}
              <input name="nameAr" maxLength={100} dir="rtl" />
            </label>
            <div className="form-grid">
              <label>
                {t("Price (EGP)")}
                <input
                  name="price"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                />
              </label>
              <label>
                {t("Color")}
                <input
                  name="color"
                  required
                  maxLength={30}
                  defaultValue="Black"
                />
              </label>
            </div>
            <label>
              {t("Sizes (comma separated)")}
              <input name="sizes" required defaultValue="S, M, L, XL" />
            </label>
            <label>
              {t("Initial stock per size")}
              <input
                name="stock"
                type="number"
                required
                min={0}
                max={100000}
                defaultValue={10}
              />
            </label>
            <button className="button" disabled={busy}>
              {t(busy ? "Please wait…" : "Add product")}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
function StockRow({
  variant,
  onUpdated,
}: {
  variant: Variant;
  onUpdated: () => Promise<void>;
}) {
  const { t } = useLocale();
  const [value, setValue] = useState(variant.stock);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await api(`inventory/${variant.id}`, { stock: value });
      await onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="stock-row">
      <span>{variant.size}</span>
      <input
        type="number"
        min={0}
        max={100000}
        value={value}
        aria-label={`${variant.size} ${t("Available stock")}`}
        onChange={(e) => setValue(Number(e.target.value))}
      />
      <span className={value > 0 ? "in-stock" : "out-stock"}>
        {value > 0 ? t("Available stock") : t("Sold out")}
      </span>
      <button
        className="text-link"
        disabled={busy || value === variant.stock}
        onClick={() => void save()}
      >
        {t("Save")}
      </button>
      {error && <small role="alert">{error}</small>}
    </div>
  );
}
function Orders() {
  const { t, lang } = useLocale();
  const { data, loading, error, refresh } = useRemote<{ orders: Order[] }>(
    "orders",
  );
  const inventory = useRemote<{ products: Product[] }>("inventory");
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const variants =
    inventory.data?.products.flatMap((p) =>
      p.variants.map((v) => ({ ...v, name: p.name })),
    ) || [];
  const add = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const f = new FormData(e.currentTarget);
    try {
      await api("orders", {
        number: f.get("number"),
        customerName: f.get("customerName"),
        email: f.get("email"),
        phone: f.get("phone"),
        address: f.get("address"),
        deliveredAt: new Date(String(f.get("deliveredAt"))).toISOString(),
        variantId: f.get("variantId"),
        quantity: Number(f.get("quantity")),
        paidPrice: Math.round(Number(f.get("paidPrice")) * 100),
      });
      setAdding(false);
      setMessage(t("Order added"));
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Unable to add order.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {lang === "ar" ? "سجل الطلبات اليدوي" : "MANUAL ORDER REGISTER"}
          </span>
          <h1>{t("Orders")}</h1>
          <p>
            {lang === "ar"
              ? "أضف طلبات مسلّمة لتجربة البوابة ببياناتك."
              : "Add delivered purchases to test the portal with your own orders."}
          </p>
        </div>
        <button
          className="button"
          disabled={!variants.length}
          onClick={() => setAdding(true)}
        >
          <Plus size={16} />
          {t("Add delivered order")}
        </button>
      </div>
      <ErrorBox message={error} />
      {message && <div className="alert success">{message}</div>}
      <section className="panel">
        {loading && !data ? (
          <Loading />
        ) : data?.orders.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {["Order number", "Customer", "Item", "Delivery date"].map(
                    (v) => (
                      <th key={v}>{t(v)}</th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {data.orders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <strong>#{o.number}</strong>
                    </td>
                    <td>
                      {o.customerName}
                      <small>{o.email}</small>
                    </td>
                    <td>
                      {o.items.map((i) => (
                        <div key={i.id}>
                          {lang === "ar"
                            ? i.variant.product.nameAr
                            : i.variant.product.name}{" "}
                          · {i.variant.size} · ×{i.quantity}
                        </div>
                      ))}
                    </td>
                    <td>{o.deliveredAt ? date(o.deliveredAt, lang) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>{t("No orders yet. Add a delivered order.")}</Empty>
        )}
      </section>
      {adding && (
        <Modal
          title={t("Add delivered order")}
          onClose={() => setAdding(false)}
        >
          <ErrorBox message={err} />
          <form method="post" onSubmit={add}>
            <div className="form-grid">
              <label>
                {t("Order number")}
                <input name="number" required pattern="[A-Za-z0-9-]{1,30}" />
              </label>
              <label>
                {t("Customer name")}
                <input
                  name="customerName"
                  required
                  minLength={2}
                  maxLength={80}
                />
              </label>
            </div>
            <div className="form-grid">
              <label>
                {t("Email address")}
                <input name="email" type="email" required />
              </label>
              <label>
                {t("Phone")}
                <input
                  name="phone"
                  type="tel"
                  required
                  placeholder="01012345678"
                />
              </label>
            </div>
            <label>
              {t("Address")}
              <input name="address" required minLength={5} maxLength={300} />
            </label>
            <label>
              {t("Delivery date")}
              <input
                name="deliveredAt"
                type="date"
                required
                max={new Date().toISOString().slice(0, 10)}
                defaultValue={new Date(Date.now() - 86400000)
                  .toISOString()
                  .slice(0, 10)}
              />
            </label>
            <label>
              {t("Item")}
              <select aria-label={t("Item")} name="variantId" required>
                {variants.map((v) => (
                  <option value={v.id} key={v.id}>
                    {v.name} · {v.size} · {v.color}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-grid">
              <label>
                {t("Quantity")}
                <input
                  type="number"
                  name="quantity"
                  min={1}
                  max={10}
                  required
                  defaultValue={1}
                />
              </label>
              <label>
                {t("Paid price per item (EGP)")}
                <input
                  type="number"
                  name="paidPrice"
                  min="0.01"
                  step="0.01"
                  required
                  defaultValue={(variants[0]?.price || 0) / 100}
                />
              </label>
            </div>
            <button className="button" disabled={busy}>
              {t(busy ? "Please wait…" : "Add delivered order")}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
function SettingsForm({
  merchant,
  refresh,
}: {
  merchant: Merchant;
  refresh: () => Promise<void>;
}) {
  const { t, lang } = useLocale();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSaved(false);
    const f = new FormData(e.currentTarget);
    try {
      await api("settings", {
        name: f.get("name"),
        email: f.get("email"),
        color: f.get("color"),
        windowDays: Number(f.get("windowDays")),
        shippingFee: Math.round(Number(f.get("shippingFee")) * 100),
        evidenceRequired: f.get("evidenceRequired") === "on",
      });
      setSaved(true);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{t("Exchange policy")}</span>
          <h1>{t("Settings")}</h1>
          <p>
            {lang === "ar"
              ? "تطبق التغييرات على الطلبات الجديدة فقط."
              : "Policy changes apply to new requests. Existing requests keep their original terms."}
          </p>
        </div>
      </div>
      <section className="panel settings-panel">
        <ErrorBox message={error} />
        {saved && <div className="alert success">{t("Settings saved")}</div>}
        <form method="post" onSubmit={submit}>
          <div className="form-grid">
            <label>
              {t("Brand name")}
              <input
                name="name"
                defaultValue={merchant.name}
                required
                minLength={2}
                maxLength={60}
              />
            </label>
            <label>
              {t("Support email")}
              <input
                name="email"
                type="email"
                defaultValue={merchant.email}
                required
              />
            </label>
          </div>
          <div className="form-grid">
            <label>
              {t("Exchange window (days)")}
              <input
                name="windowDays"
                type="number"
                min={1}
                max={90}
                defaultValue={merchant.windowDays}
                required
              />
            </label>
            <label>
              {t("Shipping fee (EGP)")}
              <input
                name="shippingFee"
                type="number"
                min={0}
                max={1000}
                step="0.01"
                defaultValue={merchant.shippingFee / 100}
                required
              />
            </label>
          </div>
          <label>
            {t("Brand color")}
            <input type="color" name="color" defaultValue={merchant.color} />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              name="evidenceRequired"
              defaultChecked={merchant.evidenceRequired}
            />
            <span>{t("Require photos for damaged / wrong items")}</span>
          </label>
          <button className="button" disabled={busy}>
            {t(busy ? "Please wait…" : "Save settings")}
          </button>
        </form>
        <div className="settings-portal-link">
          <span>{t("Customer portal")}</span>
          <Link
            to={`/portal/${merchant.slug}`}
            target="_blank"
            rel="noreferrer"
          >
            /portal/{merchant.slug}
            <ExternalLink size={15} />
          </Link>
        </div>
      </section>
      <section className="panel integration-panel">
        <h2>{lang === "ar" ? "التكاملات" : "Integrations"}</h2>
        <div>
          <strong>Shopify</strong>
          <span>
            {lang === "ar"
              ? "غير متصل — يلزم إعداد التطبيق والتفويض"
              : "Not connected — app setup and authorization required"}
          </span>
        </div>
        <div>
          <strong>Bosta / courier</strong>
          <span>
            {lang === "ar"
              ? "شحن يدوي — لا يتم إنشاء شحنات تلقائية"
              : "Manual shipment recording — no automatic bookings"}
          </span>
        </div>
        <div>
          <strong>Email</strong>
          <span>
            {lang === "ar"
              ? "راجع حالة الإشعارات في التقارير"
              : "Check notification delivery state in Reports"}
          </span>
        </div>
      </section>
    </>
  );
}
function Reports({
  data,
  refresh,
  onSelect,
}: {
  data: DashboardData;
  refresh: () => Promise<void>;
  onSelect: (reference: string) => void;
}) {
  const { t, lang } = useLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const process = async () => {
    setBusy(true);
    setError("");
    try {
      await api("notifications/process", {});
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {lang === "ar" ? "أداء الاستبدالات" : "EXCHANGE PERFORMANCE"}
          </span>
          <h1>{t("Reports")}</h1>
          <p>
            {lang === "ar"
              ? "اعرف أسباب الاستبدال، والمنتجات والمقاسات المتكررة، وما يحتاج متابعة."
              : "Understand exchange reasons, spot product and sizing patterns, and follow up sooner."}
          </p>
        </div>
        <a className="button secondary" href="/api/export">
          <Download size={16} />
          {t("Export CSV")}
        </a>
      </div>
      <ExchangeAnalytics requests={data.requests} onSelect={onSelect} />
      <section className="panel">
        <div className="panel-heading">
          <h2>
            <Mail size={18} />
            {t("Notifications")}
          </h2>
          <button
            className="button secondary small-button"
            disabled={busy}
            onClick={() => void process()}
          >
            <RefreshCw size={14} />
            {t("Process outbox")}
          </button>
        </div>
        <ErrorBox message={error} />
        {data.demo && (
          <p className="outbox-note">
            {lang === "ar"
              ? "الإشعارات التجريبية تُسجل فقط، ولا يرسل أي بريد."
              : "Demo processing records notifications without sending any email."}
          </p>
        )}
        {data.notifications.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t("Item")}</th>
                  <th>{t("Status")}</th>
                  <th>{t("Date")}</th>
                </tr>
              </thead>
              <tbody>
                {data.notifications.map((n) => (
                  <tr key={n.id}>
                    <td>
                      {n.subject}
                      {n.lastError && (
                        <small className="text-danger">{n.lastError}</small>
                      )}
                    </td>
                    <td>
                      <span className={`notification-status ${n.status}`}>
                        {t(n.status[0].toUpperCase() + n.status.slice(1))}
                      </span>
                    </td>
                    <td>{date(n.createdAt, lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>{t("No notifications yet.")}</Empty>
        )}
      </section>
    </>
  );
}
