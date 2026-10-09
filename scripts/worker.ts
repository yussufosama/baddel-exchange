import { processOutbox } from "../app/lib/mail.server";
import { db, demo } from "../app/lib/db.server";
if (!demo && (await db.merchant.count({ where: { provider: "demo" } })))
  throw new Error(
    "Live email worker cannot run against seeded demo merchants. Use a fresh database.",
  );
console.log("Baddel notification worker started. Ctrl+C to stop.");
let running = false;
const tick = async () => {
  if (running) return;
  running = true;
  try {
    const r = await processOutbox();
    if (r.processed) console.log(`Processed ${r.processed} notifications.`);
  } catch (error) {
    console.error(
      "Worker failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
  } finally {
    running = false;
  }
};
await tick();
const timer = setInterval(tick, 15000);
process.on("SIGINT", () => {
  clearInterval(timer);
  process.exit(0);
});
