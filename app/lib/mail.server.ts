import { db, demo } from "./db.server";
export async function deliverEmail(
  job: { id: string; recipient: string; subject: string; body: string },
  transport: typeof fetch = fetch,
) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)
    throw new Error("Email provider not configured.");
  const response = await transport("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `baddel-${job.id}`,
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [job.recipient],
      subject: job.subject,
      text: job.body,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw new Error(`Email provider returned ${response.status}.`);
  const result = (await response.json()) as { id?: string };
  if (!result.id)
    throw new Error("Email provider returned no delivery reference.");
  return result.id;
}
export async function processOutbox(merchantId?: string) {
  const stale = new Date();
  await db.notification.updateMany({
    where: {
      ...(merchantId ? { merchantId } : {}),
      status: "sending",
      nextAttemptAt: { lt: stale },
    },
    data: {
      status: "queued",
      lastError:
        "Worker lease expired; retry with the original idempotency key.",
    },
  });
  const jobs = await db.notification.findMany({
    where: {
      ...(merchantId ? { merchantId } : {}),
      status: "queued",
      nextAttemptAt: { lte: new Date() },
    },
    take: 20,
    orderBy: { createdAt: "asc" },
  });
  let processed = 0;
  for (const job of jobs) {
    if (
      job.subject === "Your Baddel verification code" &&
      Date.now() - job.createdAt.getTime() > 600000
    ) {
      await db.notification.updateMany({
        where: { id: job.id, status: "queued" },
        data: {
          status: "expired",
          lastError:
            "Verification code expired; customer must request another.",
        },
      });
      continue;
    }
    if (
      job.attempts > 0 &&
      Date.now() - job.createdAt.getTime() > 23 * 3600000
    ) {
      await db.notification.updateMany({
        where: { id: job.id, status: "queued" },
        data: {
          status: "needs_review",
          lastError:
            "Automatic retry stopped before the provider idempotency window expired.",
        },
      });
      continue;
    }
    if (
      (
        await db.notification.updateMany({
          where: { id: job.id, status: "queued" },
          data: {
            status: "sending",
            attempts: { increment: 1 },
            nextAttemptAt: new Date(Date.now() + 120000),
          },
        })
      ).count !== 1
    )
      continue;
    if (demo) {
      await db.notification.update({
        where: { id: job.id },
        data: { status: "demo", providerId: `demo-${job.id}` },
      });
      processed++;
      continue;
    }
    try {
      const providerId = await deliverEmail(job);
      await db.notification.update({
        where: { id: job.id },
        data: { status: "sent", providerId, lastError: null },
      });
      processed++;
    } catch (error) {
      await db.notification.update({
        where: { id: job.id },
        data: {
          status: job.attempts >= 4 ? "failed" : "queued",
          lastError:
            error instanceof Error ? error.message : "Delivery failed.",
          nextAttemptAt: new Date(
            Date.now() + Math.min(3600000, 30000 * 2 ** job.attempts),
          ),
        },
      });
    }
  }
  return { processed };
}
