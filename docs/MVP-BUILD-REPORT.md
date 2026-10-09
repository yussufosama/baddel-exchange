# Baddel MVP — build report

**Date:** 5 October 2026  
**Workspace:** `C:\Users\youss\Documents\ChatGPT\Saas project`  
**Working product name:** Baddel / بدّل  
**Delivery:** A working local, manually operated fashion-exchange MVP.

**Later update:** The merchant analytics expansion delivered on 9 October 2026 is documented in [the analytics update report](ANALYTICS-UPDATE.md).

## 1. What has been delivered

The application now supports the complete customer-to-merchant exchange journey with real saved database records. A merchant can create a brand, enter products and delivered orders, receive verified customer exchange requests, allocate replacement stock, record collection, inspect the returned item, dispatch a replacement, resolve fees, and complete the request. The customer sees the same request and its history.

This is more than a collection of static screens. Account creation, sessions, order verification, evidence uploads, request submission, staff actions, stock updates, policy settings and reporting run through the server and database.

**The live automated Shopify/courier version is not complete.** This release uses manual order/inventory entry and manual shipment recording. Shopify authentication/sync and courier API booking still require implementation and real-account verification. Merely adding keys to `.env` will not enable those integrations.

## 2. Try it now

| Area                  | Address / details                       |
| --------------------- | --------------------------------------- |
| Main application      | http://localhost:5173                   |
| Merchant sign-in      | http://localhost:5173/login             |
| Demo owner            | `demo@baddel.local` / `DemoPass!2026`   |
| Customer portal       | http://localhost:5173/portal/nile       |
| Customer sample order | `46381` / `mariam@example.com`          |
| Second sample brand   | `thread@baddel.local` / `DemoPass!2026` |

The development server was left running for review. If it has stopped, run `npm run dev` from the workspace. Use a separate browser profile/incognito window for the customer role while keeping the merchant dashboard signed in.

The local verification code is displayed in demo mode. No real verification/status emails, courier bookings, payments or refunds have been sent or executed.

## 3. Implemented features

### Customer experience

- Brand-specific portal address, name, color, support contact and exchange policy.
- Order lookup followed by an expiring, single-use six-digit verification challenge.
- Customer verification currently requires an email address. Phone-only orders and merchant-assisted verified links still need implementation.
- Delivered-order eligibility, configurable exchange window, exclusion rules and remaining quantity checks.
- Selection of one purchased item and a permitted quantity.
- Five reasons: too small, too large, wrong item, damaged item and another color.
- Optional notes and up to three private photos; evidence can be required for damaged/wrong items.
- Available replacement sizes/colors within the same product and merchandise price.
- Review of the original item, replacement, collection address and exact shipping fee.
- Policy/fee agreement, with server-side rejection if the merchant changes the quoted policy before submission.
- Saved request reference and tracking page with separate return/replacement shipments and event history.
- English/Arabic interface, right-to-left layout and remembered language choice.
- Mobile layout and periodic tracking refresh.

### Merchant workspace

- Independent brand registration and password-based sign-in.
- Overview of pending, active, completed and attention-needed exchanges.
- Searchable/filterable request queue and detailed request view.
- Order/customer details, original/replacement snapshots, evidence, fees and timeline.
- Approval/decline, cancellation before collection, manual collection and delivery tracking records.
- Return receipt, inspection pass/failure and replacement dispatch.
- Fee payment confirmation or waiver with a recorded reference/reason.
- Exception flagging, stage-preserving resolution, notes, and closing with an alternative documented resolution.
- Product/variant creation and editing of available stock.
- Manual entry of delivered purchases, including actual paid prices.
- Brand/policy settings; old requests preserve their original terms.
- Completion rate, average recorded completion time, completed merchandise value, reasons and recorded fees.
- CSV export and notification outbox status.
- Dashboard refresh when switching views, returning to the window and periodically.

### Backend and safeguards

- Relational schema, versioned migration and idempotent sample-data seed.
- Signed HTTP-only session cookie, server-stored session token hashes and expiration.
- Salted scrypt password hashes, order-code attempt limits and request rate limits.
- Origin checks for state-changing requests.
- Merchant/order access boundaries on requests, inventory and private evidence.
- Server-side stock and quantity checks with transactional updates.
- Allocation of replacement inventory at approval; restoration on pre-collection cancellation.
- Original inventory restocked only once after a successful inspection.
- Request version checks to reject stale staff actions.
- Submission idempotency to avoid duplicate requests after retries.
- Integer EGP piastres for money and recorded payment state separate from fee calculation.
- Private image decoding, format/size/pixel limits, resize and re-encoding.
- Durable notification outbox, retry limits, lease recovery, expired-code suppression and provider idempotency keys.
- Health endpoint, production launch guardrails and SQLite backup/integrity verification.

These controls are implemented and exercised, but they do not constitute a security audit or load-test certification.

## 4. Stack actually used

| Layer           | Implementation                                                                   |
| --------------- | -------------------------------------------------------------------------------- |
| Server/runtime  | Node.js 24                                                                       |
| Language        | TypeScript                                                                       |
| Application     | React 19 + React Router 7 framework mode, server rendering                       |
| Styling         | Tailwind 4 build integration + application CSS                                   |
| Database        | SQLite for the local/single-instance MVP                                         |
| Database access | Prisma 6.19.3, with a checked-in migration                                       |
| Validation      | Zod                                                                              |
| Photos          | Private local filesystem, opaque file references, sharp validation/re-encoding   |
| Email           | Resend HTTP adapter and database-backed outbox                                   |
| Verification    | Vitest, Playwright using installed Chrome, and production smoke script           |
| Packaging       | Locked npm dependencies, formatting commands, Dockerfile and environment example |

### Changes from the original plan

The application retains the planned Node/TypeScript/React Router structure. Three infrastructure choices were simplified to make a complete local workflow usable immediately:

1. **SQLite replaces PostgreSQL in this release.** No PostgreSQL/Docker server was available locally. A managed PostgreSQL migration remains necessary before scaling multiple application instances.
2. **Private local uploads replace Cloudflare R2.** Files remain behind authenticated endpoints. An object-storage adapter remains necessary for distributed hosting.
3. **A relational outbox replaces pg-boss.** It supplies durable email jobs and recovery for the single-instance MVP. It is not a general courier job system.

The merchant dashboard is standalone. An embedded Shopify dashboard using App Bridge/Polaris remains part of the Shopify release.

## 5. Verification completed

| Check                                        | Result                                                                |
| -------------------------------------------- | --------------------------------------------------------------------- |
| TypeScript / React Router type generation    | Passed                                                                |
| Backend/security/integration-contract checks | 33 passed                                                             |
| Browser journeys in Chrome                   | 7 passed                                                              |
| Production client/server build               | Passed                                                                |
| Local production smoke test                  | Passed                                                                |
| npm dependency audit                         | No known vulnerabilities reported at verification time                |
| SQLite backup                                | Opened, integrity/foreign keys checked and counts recorded            |
| Visual review                                | Desktop dashboard/customer portal and Arabic mobile screens inspected |

The backend tests include eligibility, discounts, exact fees, policy changes, request retries, remaining quantity, sold-out/price-changing variants, evidence, foreign-tenant attachments, stock allocation, stale actions, cancellation, last-unit concurrent approval, inspection, fee-controlled completion, exceptions, session boundaries/expiration, origin checks, rate limits, one-time codes, real image decoding, outbox recovery and a mocked Resend contract.

The seven browser checks cover:

1. Brand registration → product/order entry → customer exchange → staff collection/inspection/dispatch/payment → completed customer tracking.
2. Saved policy settings and CSV download.
3. Cross-brand access denial and unauthenticated/prohibited requests.
4. Arabic mobile customer portal and language persistence.
5. Desktop dashboard, portal and website without browser exceptions.
6. Required evidence uploaded by the customer and viewed by authorized staff.
7. Mobile merchant navigation and Arabic settings without page overflow.

**Verification boundaries:** email was contract-tested without external delivery; courier and Shopify integrations were not tested because they are not implemented. Docker is not installed, so the Docker image has not been built. No public deployment, load test or real merchant pilot has occurred. Backup integrity was verified by reopening the backup; a full replacement-host recovery exercise remains outstanding.

Browser testing found and corrected early-interaction/hydration behavior, field-label ambiguity, a stale request queue, and editing a tracking field while an earlier staff action was still saving.

## 6. What is still needed

| Remaining work                    | What it needs                                                                                                                     | Why it matters                                                     |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| First merchant workflow agreement | A fashion brand, real policy, origin/address, shipping-fee collection agreement                                                   | Confirms the product matches actual operations                     |
| Shopify connector                 | Developer app/store, appropriate distribution, scopes, protected-data access; OAuth, sync and supported return/exchange writes    | Removes manual order entry and keeps store stock/reporting correct |
| Courier connector                 | Merchant courier account, supported return/delivery workflow; API adapter, callback authentication and uncertain-booking recovery | Automates booking and shipment updates                             |
| Live email                        | Resend credentials, verified sender domain and supervised worker; test actual customer delivery                                   | Makes verification and updates work outside demo mode              |
| Public hosting                    | HTTPS/domain, persistent storage, backups, monitoring and staging recovery                                                        | Makes the service available reliably                               |
| Account lifecycle                 | Merchant email verification, password recovery, staff invitations and permissions                                                 | Supports real teams and account recovery                           |
| Data lifecycle                    | Retention, authorized deletion, support procedures and private storage operations                                                 | Allows responsible operation with real customer records            |
| Scalable database/storage         | PostgreSQL migration, object storage and appropriate job coordination                                                             | Supports multiple hosts and higher volume                          |
| Paid subscriptions                | Validated plan, supported billing route and billing implementation                                                                | Turns merchant value into recurring revenue                        |

Refunds, collection of additional merchandise payments, simultaneous courier swaps, multiple couriers/platforms, WhatsApp automation and product-to-product exchanges are outside this release. Staff may record external alternative resolutions; the app does not claim to execute them.

## 7. Budget and practical next step

No paid provider accounts, domain or hosting subscriptions were purchased. The build runs locally and preserves the previously agreed **10,000 EGP three-month budget** for actual pilot infrastructure and integrations. Existing provider prices and courier fees still need current quotes before spending.

The next useful milestone is to show this working application to one brand and process representative exchanges with manual order/shipment entry. Measure staff time, completion time, failed collections and requests needing intervention. Use those observations to finish the Shopify/courier integration around the merchant's actual workflow.

Do not charge merchants for unimplemented automation. A pilot agreement should explicitly describe the current manual-operation scope.

## 8. Files and handoff

- [README and quick start](../README.md)
- [Operations, configuration, recovery and launch prerequisites](OPERATIONS.md)
- [Original project plan](../Exchange-SaaS-project-plan.md)
- [Backend exchange implementation](../app/lib/exchanges.server.ts)
- [API routes](../app/routes/api.ts)
- [Database schema](../prisma/schema.prisma)
- [Backend tests](../tests/exchange.test.ts)
- [Browser tests](../e2e/mvp.spec.ts)

Screenshots:

![Merchant dashboard](screenshots/dashboard-desktop.png)

![Arabic customer portal](screenshots/customer-arabic-mobile.png)

The source, migration, dependency lockfile, configuration example, setup scripts, tests and documentation are saved in the workspace. No pull request or public deployment was created.
