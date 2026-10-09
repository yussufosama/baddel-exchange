# Operational guide

## Supported deployment shape

This release is a **single-instance manual-operation MVP**. SQLite and private photos reside under `data/`. The web process and notification worker must share the persistent database volume. Do not deploy it on ephemeral/serverless storage or scale multiple independent copies of the data directory.

A Dockerfile and launch script are included. Docker is not installed in the current environment, so the image has not been built or exercised here. The local production build has been exercised directly with Node.

## Prepare a manual merchant pilot

1. Provision persistent Node.js hosting, HTTPS, a domain, and a writable private data volume. Confirm actual costs before subscribing.
2. Use a **fresh database**, migrate it, and do not run demo seeding. The live start command rejects databases containing demo merchants.
3. Set `APP_MODE=live`, `APP_URL=https://your-domain`, `DATABASE_URL=file:../data/baddel.db`, a randomly generated `SESSION_SECRET` with at least 32 characters, `RESEND_API_KEY`, and a verified `EMAIL_FROM`.
4. Start the web process and worker as supervised services. Monitor `/health` and failed notifications.
5. Create the merchant account, configure policy/fees, and enter a real authorized sample product and delivered order.
6. Verify that the order code reaches the intended customer and that their session cannot access another order.
7. Complete a bounded exchange with the merchant arranging courier movements and payment outside this app. Enter actual tracking references, inspection decisions and payment evidence in the dashboard.
8. Confirm backups and restoration on a separate staging instance before relying on the service.

Configure `APP_URL` to the exact public browser origin. POST requests require a matching `Origin`. In live mode session cookies require HTTPS. Keep all environment secrets out of Git and out of reports/screenshots.

Creating a delivered order is a historical register; it does not debit available inventory. Inventory fields represent **available unallocated stock**. Approval subtracts replacement units from available stock; cancelling before collection restores them. Passing inspection credits the original variant once. A replacement shipment consumes the allocated unit. No automatic stock updates occur in Shopify.

## Request processing

| Stage                  | Staff action                   | Requirement                            |
| ---------------------- | ------------------------------ | -------------------------------------- |
| Awaiting review        | Approve                        | Replacement available                  |
| Approved               | Record collection              | Actual return tracking reference       |
| Return in transit      | Mark received                  | Physical arrival confirmed             |
| Inspection             | Pass or flag failed inspection | Item condition confirmed               |
| Inspection passed      | Record replacement dispatch    | Actual replacement tracking reference  |
| Replacement in transit | Mark delivered                 | Fee paid/waived and delivery confirmed |

Cancellation/decline is limited to before collection. After collection, flag the case and agree the physical and financial resolution with the customer. Resume the original stage or close with a documented alternative resolution. Closing does not automatically refund, cancel courier shipments, or return a failed-inspection item to sellable stock. Staff must record those external actions accurately.

## Notifications and recovery

- `queued`: ready for the worker; a temporary failure schedules a retry.
- `sending`: claimed by a worker with a two-minute lease.
- `sent`: accepted by the email provider; this is not proof of inbox delivery.
- `demo`: recorded locally without an external send.
- `expired`: a verification code is too old to send.
- `failed`: retry limit reached; inspect `lastError`.
- `needs_review`: retry would go beyond the conservative provider deduplication window.

Keep the worker running. Restarting it recovers expired leases using the original notification ID as the provider idempotency key. Automatic retries stop after five failed attempts. Old verification notifications are not delivered after their ten-minute validity period.

The Resend integration uses the documented email endpoint and idempotency header. Resend retains idempotency keys for 24 hours; automatic retries in this app stop conservatively at 23 hours from job creation when an attempt has occurred. [Resend idempotency documentation](https://resend.com/docs/dashboard/emails/idempotency-keys)

Do not blindly resend `needs_review` jobs. Check the provider's delivery records first. A local `sent` result means the provider accepted the request; delivery/bounce webhooks are a later enhancement.

## Back up and restore

Run `npm run backup`. It writes a SQLite-consistent database backup, copies private uploads, and checks integrity and foreign keys by opening the backup. The manifest includes table counts and a checksum. **Pause writes for a coordinated database/photo snapshot**, especially before restoration.

To restore:

1. Stop the web process and worker.
2. Preserve the current data directory separately; do not overwrite the only copy.
3. Verify the chosen backup's checksum and manifest. Restore its database and uploads into a separate staging data directory first.
4. Point the staging instance's `DATABASE_URL` at the restored database and use the corresponding private upload paths. New attachment records store only private filenames, so copies of the data directory are portable. If using an older pre-release database containing absolute paths, migrate those records to the filenames before moving hosts.
5. Verify the health check, merchant login, request counts, event history and a private photo.
6. Resume production only after the staging restore is satisfactory.

`SESSION_SECRET` is not copied into backups. Recover it from the secret manager, or generate a new one to invalidate old signed cookies.

The backup command's database integrity check has been run in this workspace. A full replacement-host restore has not been performed.

## Remaining operational work before a public service

- Merchant email ownership verification, password recovery and staff invitations/role management.
- Configured customer-data retention and authorized account/data deletion.
- Monitoring, incident support, email bounce/delivery events, and provider limit alerts.
- PostgreSQL migration and a scalable job system before multiple app instances/high volume.
- Private object storage for photos before distributing storage across hosts.
- Shopify authentication, sync, return/exchange write operations and distribution review for that release.
- Courier API integration, callback verification and recovery of uncertain external bookings.
- Subscription billing and confirmed merchant pricing.

The `.env.example` includes reserved Shopify/Bosta fields for future work. Setting them does not activate a connector in this release.
