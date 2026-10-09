import { useState, useEffect } from "react";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  isRouteErrorResponse,
  useRouteError,
  Link,
} from "react-router";
import { LocaleContext, type Language } from "./lib/i18n";
import "./styles.css";
export const meta = () => [
  { title: "Baddel — exchanges, made easier" },
  {
    name: "description",
    content:
      "A simpler exchange experience for Egyptian fashion brands and their customers.",
  },
];
export async function loader({ request }: { request: Request }) {
  return {
    lang: (/baddel_lang=ar/.test(request.headers.get("Cookie") || "")
      ? "ar"
      : "en") as Language,
  };
}
export default function App() {
  const initial = useLoaderData<typeof loader>();
  const [lang, update] = useState<Language>(initial.lang);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const setLang = (v: Language) => {
    document.cookie = `baddel_lang=${v}; Path=/; SameSite=Lax; Max-Age=31536000`;
    update(v);
  };
  return (
    <html lang={lang} dir={lang === "ar" ? "rtl" : "ltr"}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      </head>
      <body data-hydrated={ready} inert={!ready} aria-busy={!ready}>
        <LocaleContext.Provider value={{ lang, setLang }}>
          <Outlet />
        </LocaleContext.Provider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
export function ErrorBoundary() {
  const error = useRouteError();
  const status = isRouteErrorResponse(error) ? error.status : 500;
  return (
    <html lang="en">
      <head>
        <title>Baddel — {status}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Links />
      </head>
      <body>
        <div className="error-page">
          <h1>{status === 404 ? "Page not found" : "Something went wrong"}</h1>
          <p>
            {status === 404
              ? "This page may have moved."
              : "Please refresh or return to the home page."}
          </p>
          <Link className="button" to="/">
            Return home
          </Link>
        </div>
        <Scripts />
      </body>
    </html>
  );
}
