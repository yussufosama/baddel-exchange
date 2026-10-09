import { spawn } from "node:child_process";
import assert from "node:assert/strict";
const url = "http://127.0.0.1:3101";
const child = spawn(
  process.execPath,
  ["node_modules/@react-router/serve/bin.js", "build/server/index.js"],
  {
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      NODE_ENV: "production",
      APP_MODE: "demo",
      HOST: "127.0.0.1",
      PORT: "3101",
      APP_URL: url,
    },
  },
);
let ready = false;
let exited = false;
child.on("exit", () => {
  exited = true;
});
try {
  for (let i = 0; i < 40; i++) {
    try {
      if ((await fetch(url + "/health")).ok) {
        ready = true;
        break;
      }
    } catch {}
    if (exited)
      throw new Error("Production process exited before becoming ready.");
    await new Promise((r) => setTimeout(r, 250));
  }
  assert(ready, "Production server did not become ready.");
  assert.equal((await fetch(url + "/")).status, 200);
  assert.equal((await fetch(url + "/api/dashboard")).status, 401);
  const login = await fetch(url + "/api/auth/login", {
    method: "POST",
    headers: { Origin: url, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "demo@baddel.local",
      password: "DemoPass!2026",
    }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("Set-Cookie")?.split(";")[0];
  assert(cookie);
  const dashboard = await fetch(url + "/api/dashboard", {
    headers: { Cookie: cookie },
  });
  assert.equal(dashboard.status, 200);
  const data = await dashboard.json();
  assert.equal(data.merchant.slug, "nile");
  assert(data.requests.length >= 7);
  console.log(
    "Production smoke check passed: health, HTML, authentication, and persisted dashboard.",
  );
} finally {
  child.kill();
}
