import { Link } from "react-router";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowRightLeft,
  Check,
  PackageCheck,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { Logo, LanguageSwitch } from "../components/ui";
import { useLocale } from "../lib/i18n";
export default function Home() {
  const { lang } = useLocale();
  const ar = lang === "ar";
  return (
    <div className="home">
      <header className="home-nav">
        <Logo />
        <div className="nav-right">
          <LanguageSwitch />
          <Link className="text-link" to="/login">
            {ar ? "دخول البراند" : "Brand sign in"} <ArrowUpRight size={16} />
          </Link>
        </div>
      </header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="green-dot" />
              {ar
                ? "مصمّم لبراندات الأزياء في مصر"
                : "MADE FOR EGYPTIAN FASHION BRANDS"}
            </div>
            <h1>
              {ar ? (
                <>
                  كل استبدال،
                  <br />
                  <em>فرصة جديدة.</em>
                </>
              ) : (
                <>
                  A better fit.
                  <br />
                  <em>A better exchange.</em>
                </>
              )}
            </h1>
            <p>
              {ar
                ? "خلّي الاستبدال أسهل لعملائك وفريقك. من أول الطلب لحد وصول المقاس المناسب — كل خطوة في مكان واحد."
                : "Turn the back-and-forth into a simple flow. From the first request to the right size at their door, keep every exchange in one place."}
            </p>
            <div className="hero-actions">
              <Link className="button" to="/login">
                {ar ? "جرّب لوحة التحكم" : "Explore the dashboard"}
                <ArrowRight size={17} />
              </Link>
              <Link className="button secondary" to="/portal/nile">
                {ar ? "جرّب كعميل" : "Try the customer experience"}
              </Link>
            </div>
            <div className="hero-note">
              <Check size={15} />
              {ar
                ? "نسخة تجريبية محلية • بدون بطاقة دفع"
                : "Local demo · No payment details needed"}
            </div>
          </div>
          <div className="hero-art">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="hero-product">
              <div className="product-label">
                NILE STUDIO <span>EVERYDAY COLLECTION</span>
              </div>
              <img src="/products/tee.svg" alt="Off-white cotton T-shirt" />
              <div className="size-swap">
                <span>M</span>
                <ArrowRightLeft size={20} />
                <strong>L</strong>
              </div>
            </div>
            <div className="floating-tag tag-approved">
              <span className="round-icon">
                <Check size={16} />
              </span>
              <div>
                <strong>{ar ? "تمت الموافقة" : "Exchange approved"}</strong>
                <small>
                  {ar
                    ? "المقاس المناسب في الطريق"
                    : "The right fit is on its way"}
                </small>
              </div>
            </div>
            <div className="floating-tag tag-retained">
              <ArrowRightLeft size={20} />
              <div>
                <strong>
                  {ar
                    ? "تجربة أسهل للعميل"
                    : "Keep the customer. Keep the sale."}
                </strong>
                <small>
                  {ar
                    ? "تجربة استبدال تليق بالبراند"
                    : "A smoother experience for everyone"}
                </small>
              </div>
            </div>
          </div>
        </section>
        <section className="how">
          <div>
            <span className="eyebrow">
              {ar ? "كل خطوة واضحة" : "LESS FRICTION. MORE CLARITY."}
            </span>
            <h2>
              {ar ? "عملية واحدة. كل التفاصيل." : "One flow. Every detail."}
            </h2>
          </div>
          <div className="feature-grid">
            {[
              {
                icon: ArrowRightLeft,
                n: "01",
                title: ar ? "العميل يطلب" : "Customers request",
                text: ar
                  ? "بوابة خاصة ببراندك لاختيار المنتج والمقاس البديل."
                  : "A branded portal to choose an item, explain the issue, and find the right size.",
              },
              {
                icon: ShieldCheck,
                n: "02",
                title: ar ? "الفريق يراجع" : "Your team reviews",
                text: ar
                  ? "راجع الطلب والمخزون والرسوم في مكان واحد."
                  : "See the order, available stock, evidence, and fees before you approve.",
              },
              {
                icon: Truck,
                n: "03",
                title: ar ? "استلام واستبدال" : "Collect and replace",
                text: ar
                  ? "سجّل الاستلام والفحص وشحن البديل وتابع التقدم."
                  : "Record collection, inspect the return, and track the replacement to completion.",
              },
            ].map((f) => (
              <article className="feature" key={f.n}>
                <div className="feature-top">
                  <f.icon size={24} />
                  <span>{f.n}</span>
                </div>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="demo-strip">
          <PackageCheck size={28} />
          <div>
            <strong>
              {ar
                ? "ابدأ بالطلب التجريبي #46381"
                : "Start with sample order #46381"}
            </strong>
            <p>mariam@example.com · NILE STUDIO</p>
          </div>
          <Link to="/portal/nile">
            {ar ? "افتح البوابة" : "Open the portal"}
            <ArrowUpRight size={18} />
          </Link>
        </section>
      </main>
      <footer className="home-footer">
        <Logo />
        <span>
          {ar
            ? "استبدال أسهل. عملاء أسعد."
            : "Better exchanges. Happier customers."}
        </span>
        <span>Built for Egypt 🇪🇬</span>
      </footer>
    </div>
  );
}
