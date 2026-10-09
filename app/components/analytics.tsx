import { useSearchParams } from "react-router";
import {
  Download,
  Search,
  SlidersHorizontal,
  ArrowUpRight,
  Lightbulb,
  Clock3,
} from "lucide-react";
import { useLocale } from "../lib/i18n";
import { money, reasonLabels, statuses, statusLabels } from "../lib/domain";
import {
  analyticsCsv,
  buildAnalytics,
  defaultAnalyticsFilters,
  productKey,
  readSnapshot,
  type AnalyticsFilters,
} from "../lib/analytics";
import { Badge, Empty, Reason, date } from "./ui";
import type { Exchange } from "../lib/types";

export function ExchangeAnalytics({
  requests,
  onSelect,
}: {
  requests: Exchange[];
  onSelect: (reference: string) => void;
}) {
  const { lang, t } = useLocale();
  const [params, setParams] = useSearchParams();
  const text = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const period = params.get("period") || "30";
  const status = params.get("analyticsStatus") || "valid";
  const filters: AnalyticsFilters = {
    period: ["7", "30", "90", "all"].includes(period)
      ? (period as AnalyticsFilters["period"])
      : "30",
    status: ["valid", "all", ...statuses].includes(status) ? status : "valid",
    product: params.get("product") || "all",
    reason: params.get("reason") || "all",
    search: params.get("q") || "",
  };
  const update = (key: keyof AnalyticsFilters, value: string) => {
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        next.set(
          key === "search" ? "q" : key === "status" ? "analyticsStatus" : key,
          value,
        );
        return next;
      },
      { replace: true },
    );
  };
  const clear = () => setParams({ view: "reports" }, { replace: true });
  const metrics = buildAnalytics(requests, filters);
  const options = [
    ...new Map(
      requests.map((r) => [productKey(r), readSnapshot(r.itemSnapshot)]),
    ).entries(),
  ];
  const changed = Object.entries(filters).some(
    ([key, value]) =>
      value !== defaultAnalyticsFilters[key as keyof AnalyticsFilters],
  );
  const exportRows = () => {
    const url = URL.createObjectURL(
      new Blob([analyticsCsv(metrics.rows)], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "baddel-analytics.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const percent = (value: number) => `${Math.round(value * 10) / 10}%`;
  const suggestions = {
    size: text(
      "Review the size chart and garment measurements. Compare the size changes below before updating fit guidance.",
      "راجع جدول المقاسات وقياسات القطعة. قارن تغييرات المقاس بالأسفل قبل تعديل إرشادات المقاس.",
    ),
    damaged: text(
      "Inspect this product's packaging and recent batches. Check the photos and comments before concluding there is a quality issue.",
      "افحص تغليف المنتج والدفعات الأخيرة. راجع الصور والتعليقات قبل استنتاج وجود مشكلة جودة.",
    ),
    wrong_item: text(
      "Review packing checks and variant labels for this product. Confirm each reported mismatch against the original order.",
      "راجع فحص تجهيز الشحنات وملصقات المقاسات والألوان. تحقق من كل بلاغ بمقارنته بالطلب الأصلي.",
    ),
    color: text(
      "Compare product photos and color descriptions with the physical item. Customer preference may also explain these requests.",
      "قارن صور المنتج ووصف اللون بالقطعة الفعلية. قد تكون هذه الطلبات ناتجة أيضًا عن تفضيل العميل.",
    ),
  };
  return (
    <div className="exchange-analytics">
      <section
        className="panel analytics-controls"
        aria-label={text("Analytics filters", "فلاتر التحليلات")}
      >
        <div className="analytics-filter-heading">
          <SlidersHorizontal size={17} />
          <strong>
            {text("Explore your exchange data", "حلّل بيانات الاستبدال")}
          </strong>
          {changed && (
            <button className="text-link" onClick={clear}>
              {text("Reset filters", "إعادة ضبط الفلاتر")}
            </button>
          )}
        </div>
        <div className="analytics-filters">
          <label>
            {text("Date range", "الفترة")}
            <select
              value={filters.period}
              onChange={(e) => update("period", e.target.value)}
            >
              <option value="7">{text("Last 7 days", "آخر ٧ أيام")}</option>
              <option value="30">{text("Last 30 days", "آخر ٣٠ يومًا")}</option>
              <option value="90">{text("Last 90 days", "آخر ٩٠ يومًا")}</option>
              <option value="all">{text("All time", "كل الفترات")}</option>
            </select>
          </label>
          <label>
            {text("Product filter", "فلتر المنتج")}
            <select
              value={filters.product}
              onChange={(e) => update("product", e.target.value)}
            >
              <option value="all">{text("All products", "كل المنتجات")}</option>
              {options.map(([key, item]) => (
                <option key={key} value={key}>
                  {lang === "ar" ? item.nameAr : item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {text("Reason filter", "فلتر السبب")}
            <select
              value={filters.reason}
              onChange={(e) => update("reason", e.target.value)}
            >
              <option value="all">{text("All reasons", "كل الأسباب")}</option>
              {Object.entries(reasonLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {t(label)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {text("Request status", "حالة الطلب")}
            <select
              value={filters.status}
              onChange={(e) => update("status", e.target.value)}
            >
              <option value="valid">
                {text(
                  "Exclude cancelled & declined",
                  "استبعاد الملغاة والمرفوضة",
                )}
              </option>
              <option value="all">{text("All statuses", "كل الحالات")}</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {t(statusLabels[s])}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="analytics-search-row">
          <label className="analytics-search">
            <Search size={17} />
            <input
              aria-label={text("Search analytics", "البحث في التحليلات")}
              placeholder={text(
                "Search products, sizes, comments, or requests…",
                "ابحث عن منتج أو مقاس أو تعليق أو طلب…",
              )}
              value={filters.search}
              onChange={(e) => update("search", e.target.value)}
            />
          </label>
          <button
            className="button secondary small-button"
            disabled={!metrics.count}
            onClick={exportRows}
          >
            <Download size={15} />
            {text("Export filtered data", "تصدير البيانات المفلترة")}
          </button>
        </div>
        <p className="analytics-help">
          {text(
            "Filtered by request date in Cairo time. By default, cancelled and declined requests are excluded. Reasons are customer reports, not confirmed diagnoses.",
            "الفلاتر تعتمد على تاريخ طلب الاستبدال بتوقيت القاهرة. يتم استبعاد الملغاة والمرفوضة افتراضيًا. الأسباب هي بلاغات العملاء وليست تشخيصات مؤكدة.",
          )}
        </p>
      </section>
      <div className="stats-grid report-stats">
        {[
          {
            label: text("Exchange requests", "طلبات الاستبدال"),
            value: metrics.count,
            note:
              metrics.previous === null
                ? text("Selected period", "الفترة المحددة")
                : `${text("Previous equal period", "الفترة السابقة بنفس المدة")}: ${metrics.previous}${metrics.previous > 0 ? ` · ${metrics.count >= metrics.previous ? "+" : ""}${Math.round(((metrics.count - metrics.previous) / metrics.previous) * 100)}%` : ""}`,
          },
          {
            label: text("Items requested", "القطع المطلوب استبدالها"),
            value: metrics.units,
            note: text(
              "Quantity, rather than request count",
              "عدد القطع وليس عدد الطلبات",
            ),
          },
          {
            label: t("Completion rate"),
            value: percent(
              metrics.count ? (metrics.completed / metrics.count) * 100 : 0,
            ),
            note: `${metrics.completed} / ${metrics.count} ${text("selected requests", "طلبًا محددًا")}`,
          },
          {
            label: t("Average completion time"),
            value:
              metrics.averageDays === null
                ? "—"
                : metrics.averageDays.toFixed(1),
            note: text(
              "Days · completed requests only",
              "بالأيام · الطلبات المكتملة فقط",
            ),
          },
          {
            label: t("Merchandise value retained"),
            value: money(metrics.retained, lang),
            note: t("Based on completed requests; excludes shipping fees."),
          },
          {
            label: t("Fee collected"),
            value: money(metrics.fees, lang),
            note: text("Amounts confirmed by your team", "مبالغ أكدها فريقك"),
          },
        ].map((s) => (
          <div className="stat-card" key={s.label}>
            <div>
              <span>{s.label}</span>
            </div>
            <strong>{s.value}</strong>
            <small>{s.note}</small>
          </div>
        ))}
      </div>
      {!metrics.count ? (
        <section className="panel">
          <Empty>
            {text(
              "No exchange requests match these filters. Try another period or reset the filters.",
              "لا توجد طلبات تطابق هذه الفلاتر. جرّب فترة أخرى أو أعد ضبط الفلاتر.",
            )}
          </Empty>
        </section>
      ) : (
        <>
          <div className="analytics-chart-grid">
            <section className="panel report-reasons">
              <div className="panel-heading">
                <h2>
                  {text(
                    "Why customers request exchanges",
                    "لماذا يطلب العملاء الاستبدال؟",
                  )}
                </h2>
              </div>
              <p className="analytics-help">
                {text(
                  "Select a reason to investigate its requests.",
                  "اختر سببًا لتحليل طلباته.",
                )}
              </p>
              {metrics.reasons.map((r) => (
                <button
                  className="analytics-reason-row"
                  key={r.reason}
                  onClick={() =>
                    update(
                      "reason",
                      filters.reason === r.reason ? "all" : r.reason,
                    )
                  }
                  aria-pressed={filters.reason === r.reason}
                >
                  <span>
                    <Reason value={r.reason} />
                  </span>
                  <span className="analytics-bar">
                    <i style={{ width: `${r.share}%` }} />
                  </span>
                  <strong>
                    {r.count}
                    <small>{percent(r.share)}</small>
                  </strong>
                </button>
              ))}
            </section>
            <section className="panel">
              <div className="panel-heading">
                <h2>{text("Requests over time", "الطلبات عبر الوقت")}</h2>
              </div>
              <p className="analytics-help">
                {text(
                  "Request volume, grouped into up to 14 periods. This is not a store return rate.",
                  "عدد الطلبات مجمّع في ١٤ فترة كحد أقصى. هذا ليس معدل مرتجعات المتجر.",
                )}
              </p>
              <div
                className="analytics-trend"
                role="img"
                aria-label={text(
                  "Exchange request volume over time",
                  "عدد طلبات الاستبدال عبر الوقت",
                )}
              >
                {metrics.trend.map((bucket) => (
                  <div
                    key={bucket.from}
                    className="analytics-trend-column"
                    title={`${bucket.from} – ${bucket.to}: ${bucket.count}`}
                  >
                    <strong>{bucket.count}</strong>
                    <div>
                      <i
                        style={{
                          height: `${(bucket.count / Math.max(1, ...metrics.trend.map((b) => b.count))) * 100}%`,
                        }}
                      />
                    </div>
                    <small>{bucket.from.slice(5)}</small>
                  </div>
                ))}
              </div>
              <details className="analytics-trend-data">
                <summary>{text("Read chart data", "عرض بيانات الرسم")}</summary>
                <ul>
                  {metrics.trend.map((b) => (
                    <li key={b.from}>
                      {b.from}
                      {b.from !== b.to && ` – ${b.to}`}: {b.count}{" "}
                      {text("requests", "طلبًا")}
                    </li>
                  ))}
                </ul>
              </details>
            </section>
          </div>
          <section className="panel">
            <div className="panel-heading">
              <h2>
                <Lightbulb size={18} />
                {text("Suggested checks", "فحوصات مقترحة")}
              </h2>
            </div>
            <p className="analytics-help">
              {text(
                "Rules based on repeated reasons: 3+ sizing requests or 2+ damage, wrong-item, or color requests for one product. These are suggestions, not proven causes.",
                "قواعد تعتمد على تكرار السبب: ٣ طلبات مقاس أو أكثر، أو طلبان للتلف أو القطعة الخطأ أو اللون لمنتج واحد. هذه اقتراحات وليست أسبابًا مثبتة.",
              )}
            </p>
            {metrics.insights.length ? (
              <div className="analytics-insights">
                {metrics.insights.slice(0, 6).map((insight) => (
                  <article key={`${insight.productId}-${insight.kind}`}>
                    <span className="eyebrow">
                      {insight.kind === "size"
                        ? text("FIT GUIDANCE", "إرشادات المقاس")
                        : t(reasonLabels[insight.kind])}
                    </span>
                    <h3>{lang === "ar" ? insight.nameAr : insight.name}</h3>
                    <p>
                      {insight.count} / {insight.total}{" "}
                      {text(
                        "requests in this selection",
                        "طلبًا في البيانات المحددة",
                      )}
                    </p>
                    <p>{suggestions[insight.kind]}</p>
                    <button
                      className="text-link"
                      onClick={() => update("product", insight.productId)}
                    >
                      {text("Inspect product", "تحليل المنتج")}
                      <ArrowUpRight size={14} />
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <Empty>
                {text(
                  "Not enough repeated reports to suggest a product check yet. Review the customer comments below.",
                  "لا توجد بلاغات متكررة كافية لاقتراح فحص منتج بعد. راجع تعليقات العملاء بالأسفل.",
                )}
              </Empty>
            )}
          </section>
          <section className="panel">
            <div className="panel-heading">
              <h2>
                {text(
                  "Products driving exchanges",
                  "المنتجات الأكثر طلبًا للاستبدال",
                )}
              </h2>
            </div>
            <p className="analytics-help">
              {text(
                "Top 20 by requested units. Share is of selected exchange requests, not items sold. Merchandise value is neither a refund nor a measured loss.",
                "أعلى ٢٠ منتجًا حسب القطع المطلوب استبدالها. النسبة من طلبات الاستبدال المحددة وليست من المبيعات. قيمة البضاعة ليست مبلغ استرداد أو خسارة مقاسة.",
              )}
            </p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{text("Product", "المنتج")}</th>
                    <th>{text("Requests", "الطلبات")}</th>
                    <th>{text("Units", "القطع")}</th>
                    <th>{text("Request share", "نسبة الطلبات")}</th>
                    <th>{text("Top reason", "أكثر سبب")}</th>
                    <th>
                      {text(
                        "Requested merchandise value",
                        "قيمة البضاعة المطلوب استبدالها",
                      )}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.products.slice(0, 20).map((p) => (
                    <tr key={p.id}>
                      <td>
                        <button
                          className="text-link"
                          onClick={() => update("product", p.id)}
                        >
                          {lang === "ar" ? p.item.nameAr : p.item.name}
                          <ArrowUpRight size={13} />
                        </button>
                      </td>
                      <td>{p.count}</td>
                      <td>{p.units}</td>
                      <td>{percent((p.count / metrics.count) * 100)}</td>
                      <td>
                        <Reason value={p.topReason} />
                      </td>
                      <td>{money(p.value, lang)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <h2>{text("Size & color changes", "تغييرات المقاس واللون")}</h2>
            </div>
            <p className="analytics-help">
              {text(
                "Top 20 requested combinations. Use this alongside the reason and customer comments to investigate fit.",
                "أعلى ٢٠ تغييرًا مطلوبًا. استخدم هذه البيانات مع السبب وتعليقات العملاء لتحليل المقاسات.",
              )}
            </p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{text("Product", "المنتج")}</th>
                    <th>{text("Original", "الأصلي")}</th>
                    <th>{text("Replacement", "البديل")}</th>
                    <th>{text("Units", "القطع")}</th>
                    <th>{text("Requests", "الطلبات")}</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.sizes.slice(0, 20).map((s, i) => (
                    <tr key={i}>
                      <td>{lang === "ar" ? s.nameAr : s.name}</td>
                      <td>
                        {s.from} · {s.color}
                      </td>
                      <td>
                        {s.to} · {s.toColor}
                      </td>
                      <td>{s.units}</td>
                      <td>{s.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      <section className="panel">
        <div className="panel-heading">
          <h2>
            <Clock3 size={18} />
            {text("Follow-up queue", "طلبات تحتاج متابعة")}
            <span className="count">{metrics.queue.length}</span>
          </h2>
        </div>
        <p className="analytics-help">
          {text(
            "Selected open requests with an exception or no update for at least 48 hours. Sorted by exceptions first, then longest without an update.",
            "الطلبات المفتوحة المحددة التي بها مشكلة أو لم تُحدّث منذ ٤٨ ساعة على الأقل. تظهر المشاكل أولًا ثم الأقدم بدون تحديث.",
          )}
        </p>
        {metrics.queue.length ? (
          <div className="analytics-queue">
            {metrics.queue.slice(0, 10).map(({ request: r, idleDays }) => (
              <button key={r.id} onClick={() => onSelect(r.reference)}>
                <div>
                  <strong>{r.reference}</strong>
                  <span>{r.exception || r.order.customerName}</span>
                </div>
                <Badge status={r.status} />
                <small>
                  {idleDays.toFixed(1)}{" "}
                  {text("days without update", "أيام بدون تحديث")}
                </small>
                <ArrowUpRight size={16} />
              </button>
            ))}
          </div>
        ) : (
          <Empty>
            {text(
              "No follow-ups match this selection.",
              "لا توجد طلبات تحتاج متابعة ضمن هذه الفلاتر.",
            )}
          </Empty>
        )}
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>
            {text(
              "Customer comments & matching requests",
              "تعليقات العملاء والطلبات المطابقة",
            )}
            <span className="count">{metrics.count}</span>
          </h2>
        </div>
        <p className="analytics-help">
          {text(
            "Latest 20 matching requests. Open a request to see its evidence and take action; export includes every match.",
            "أحدث ٢٠ طلبًا مطابقًا. افتح الطلب لعرض الصور واتخاذ إجراء؛ التصدير يشمل كل النتائج.",
          )}
        </p>
        {metrics.rows.length ? (
          <div className="table-scroll">
            <table className="analytics-comments">
              <thead>
                <tr>
                  <th>{text("Request", "الطلب")}</th>
                  <th>{text("Product", "المنتج")}</th>
                  <th>{t("Reason")}</th>
                  <th>{text("Customer comment", "تعليق العميل")}</th>
                  <th>{t("Status")}</th>
                  <th>{t("Date")}</th>
                </tr>
              </thead>
              <tbody>
                {metrics.rows.slice(0, 20).map((r) => {
                  const item = readSnapshot(r.itemSnapshot);
                  return (
                    <tr key={r.id}>
                      <td>
                        <button
                          className="reference-link"
                          onClick={() => onSelect(r.reference)}
                        >
                          {r.reference}
                        </button>
                      </td>
                      <td>
                        {lang === "ar" ? item.nameAr : item.name}
                        <small>
                          {item.size} · {item.color}
                        </small>
                      </td>
                      <td>
                        <Reason value={r.reason} />
                      </td>
                      <td>{r.notes || text("No comment", "لا يوجد تعليق")}</td>
                      <td>
                        <Badge status={r.status} />
                      </td>
                      <td>{date(r.createdAt, lang)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>
            {text("No matching requests.", "لا توجد طلبات مطابقة.")}
          </Empty>
        )}
      </section>
    </div>
  );
}
