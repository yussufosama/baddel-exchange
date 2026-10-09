import { Link } from "react-router";
import { ArrowRightLeft, Globe, LoaderCircle, X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { useLocale } from "../lib/i18n";
import { statusLabels, reasonLabels } from "../lib/domain";
export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className={`logo ${light ? "logo-light" : ""}`}>
      <span className="logo-symbol">
        <ArrowRightLeft size={21} />
      </span>
      <span>
        baddel<span className="logo-dot">.</span>
      </span>
    </Link>
  );
}
export function LanguageSwitch() {
  const { lang, setLang } = useLocale();
  return (
    <button
      className="language"
      onClick={() => setLang(lang === "en" ? "ar" : "en")}
      aria-label="Switch language"
    >
      <Globe size={16} />
      {lang === "en" ? "العربية" : "English"}
    </button>
  );
}
export function Badge({ status }: { status: string }) {
  const { t } = useLocale();
  return (
    <span className={`badge status-${status}`}>
      <i />
      {t(statusLabels[status] || status)}
    </span>
  );
}
export function Reason({ value }: { value: string }) {
  const { t } = useLocale();
  return <>{t(reasonLabels[value] || value)}</>;
}
export function ErrorBox({ message }: { message: string }) {
  const { t } = useLocale();
  return message ? (
    <div role="alert" className="alert error">
      {t(message)}
    </div>
  ) : null;
}
export function Loading() {
  const { t } = useLocale();
  return (
    <div className="loading">
      <LoaderCircle className="spin" size={24} />
      {t("Loading…")}
    </div>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="empty">
      <ArrowRightLeft size={32} />
      <p>{children}</p>
    </div>
  );
}
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
      if (e.key === "Tab") {
        const nodes = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled)",
          ) || [],
        ).filter((el) => el.offsetParent !== null);
        const first = nodes[0],
          last = nodes.at(-1);
        if (!first) {
          e.preventDefault();
          return;
        }
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <section
        ref={ref}
        tabIndex={-1}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-title">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X size={22} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
export function date(value: string, lang = "en") {
  return new Date(value).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
