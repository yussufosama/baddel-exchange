import { useState } from "react";
import { useNavigate, redirect, Link } from "react-router";
import { ArrowRight, ArrowLeft, ShieldCheck } from "lucide-react";
import { session } from "../lib/security.server";
import { demo } from "../lib/db.server";
import { useLoaderData } from "react-router";
import { Logo, LanguageSwitch, ErrorBox } from "../components/ui";
import { api } from "../lib/client";
import { useLocale } from "../lib/i18n";
export async function loader({ request }: { request: Request }) {
  if ((await session(request))?.staffId) return redirect("/app");
  return { demo };
}
export default function Login() {
  const data = useLoaderData<typeof loader>();
  const { t, lang } = useLocale();
  const [register, setRegister] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      await api(
        register ? "auth/register" : "auth/login",
        Object.fromEntries(form),
      );
      navigate("/app");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="login-page">
      <section className="login-art">
        <Logo light />
        <div>
          <span className="eyebrow">{t("Exchange management")}</span>
          <h1>
            {lang === "ar" ? (
              "كل استبدال، خطوة أقرب لعميل سعيد."
            ) : (
              <>
                Every exchange.
                <br />A fresh start.
              </>
            )}
          </h1>
          <p>{t("Pick up, inspect, replace. All in one place.")}</p>
          <div className="login-illustration">
            <img src="/products/hoodie.svg" alt="Green cotton hoodie" />
            <span className="login-sizes">
              M <ArrowRight size={24} /> L
            </span>
          </div>
        </div>
        <small>Built for Egyptian fashion brands</small>
      </section>
      <section className="login-form-side">
        <div className="login-top">
          <Link to="/">
            <ArrowLeft size={18} /> Baddel
          </Link>
          <LanguageSwitch />
        </div>
        <div className="login-form">
          <span className="eyebrow">{t("Brand workspace")}</span>
          <h2>{t(register ? "Create a brand account" : "Welcome back")}</h2>
          <p>
            {lang === "ar"
              ? "سجّل الدخول لإدارة طلبات الاستبدال."
              : "Sign in to keep your exchanges moving."}
          </p>
          <ErrorBox message={error} />
          <form method="post" onSubmit={submit}>
            {register && (
              <>
                <label>
                  {t("Your name")}
                  <input name="name" required minLength={2} maxLength={60} />
                </label>
                <label>
                  {t("Brand name")}
                  <input name="brand" required minLength={2} maxLength={60} />
                </label>
                <label>
                  {t("Portal address")}
                  <input
                    name="slug"
                    aria-label={t("Portal address")}
                    required
                    pattern="[a-z][a-z0-9-]{2,39}"
                    placeholder="your-brand"
                    dir="ltr"
                  />
                  <small>/portal/your-brand</small>
                </label>
              </>
            )}
            <label>
              {t("Email address")}
              <input
                type="email"
                name="email"
                required
                autoComplete="username"
                defaultValue={!register && data.demo ? "demo@baddel.local" : ""}
                key={`email-${register}`}
                dir="ltr"
              />
            </label>
            <label>
              {t("Password")}
              <input
                type="password"
                name="password"
                required
                minLength={register ? 12 : 1}
                maxLength={100}
                autoComplete={register ? "new-password" : "current-password"}
                defaultValue={!register && data.demo ? "DemoPass!2026" : ""}
                key={`password-${register}`}
              />
            </label>
            <button className="button full" disabled={busy}>
              {t(
                busy ? "Please wait…" : register ? "Create account" : "Sign in",
              )}
              <ArrowRight size={16} />
            </button>
          </form>
          <button
            className="text-link register-link"
            onClick={() => {
              setRegister(!register);
              setError("");
            }}
          >
            {t(
              register ? "Already have an account?" : "Create a brand account",
            )}
          </button>
          {data.demo && (
            <div className="demo-note">
              <ShieldCheck size={18} />
              <div>
                <strong>
                  {lang === "ar" ? "بيئة تجريبية محلية" : "Local demonstration"}
                </strong>
                <p>
                  {lang === "ar"
                    ? "البيانات والشحنات تجريبية. لن يتم إنشاء شحنات حقيقية."
                    : "Sample data and manual shipments. No real courier bookings or payments."}
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
