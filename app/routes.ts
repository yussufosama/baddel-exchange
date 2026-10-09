import { index, route, type RouteConfig } from "@react-router/dev/routes";
export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("portal/:slug", "routes/portal.tsx"),
  route("portal/:slug/track/:reference", "routes/tracking.tsx"),
  route("app", "routes/dashboard.tsx"),
  route("api/*", "routes/api.ts"),
  route("health", "routes/health.ts"),
] satisfies RouteConfig;
