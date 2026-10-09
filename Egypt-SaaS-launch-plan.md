# Starting an Egyptian fashion operations SaaS

Prepared 2 October 2026. This is a working build and validation plan, not a market-size forecast. Egypt is the confirmed target market; Shopify and Bosta are proposed initial integrations, subject to the first merchants' actual tools. **Confirmed constraints: the founder builds with my help; total first-three-month cash budget is at most 10,000 EGP, excluding the founder's time.**

## Recommendation

Start with size exchanges for fashion brands. Give staff one place to resolve a request, arrange its logistics, explain any price difference, and track completion. Sell the reduction in operational work and failed exchanges.

The longer-term opportunity is to manage costly order exceptions across delivery, exchanges, and courier settlements. Start with the single workflow where you can obtain customer access and demonstrate value. Each additional workflow must earn its place through merchant demand.

Estebdal already lists English, Arabic, stock updates, and Bosta/Shipblu/Turuq connections. These capabilities are baseline expectations rather than proof of differentiation. [Estebdal's Shopify listing](https://apps.shopify.com/e-stebdal)

## 1. Choose a customer before choosing all the features

Proposed early customer: an Egyptian fashion brand with a support/operations person, recurring size exchanges, a reliable stock record, and enough requests to measure improvements within a month. A screening range of 50–300 exchange requests monthly is a founder hypothesis, not measured Egyptian market demand.

Interview 10 owners or operations leads. Ask them to walk through their last five difficult requests. Record who acted, time spent, tools used, stock issues, courier charges, and the final outcome. Ask about current software and why it fails. Obtain permission before using real customer records.

Useful questions:

1. What happened in the last exchange that went wrong?
2. Where does your team re-enter information or chase someone?
3. At what point is a replacement reserved and released?
4. How do you know an exchange has actually finished?
5. How do you calculate collection fees, price differences, and refunds?
6. What does your current tool already handle well?
7. Would you pay for a pilot addressing this specific problem?

Target three pilot commitments. Define a sample of completed requests and a baseline before switching their workflow. Interest in a free demo is weaker evidence than a paid pilot.

## 2. Product advantage to test

| Proposed advantage | Implementation | Evidence |
|---|---|---|
| Fewer messages to complete an exchange | Short mobile flow; Arabic and English; only relevant evidence questions | Staff minutes and contacts per completed request |
| Fewer stock surprises | Recheck availability before approval; define reservation expiry; provide alternatives | Stock-related cancellation rate |
| Faster exception resolution | Assigned staff owner, overdue queue, next action, full event history | Unresolved requests and resolution time |
| Clear money trail | Record original paid value, discount allocation, replacement price, shipping, collection, and refund amounts | Unexplained balances and correction time |
| Useful size insights | Return rate per size divided by fulfilled units sold; show sample size | Merchant changes a size guide or product and measures the result |

These are proposed advantages. A public competitor page cannot establish that these workflows are missing from its product. Ask merchants to demonstrate the differences in their actual tools.

## 3. First version

Customer screens: verify access to the purchase; select item and quantity; select reason; choose available size/color; see charges; confirm the request; track status.

Merchant screens: request queue; request detail with photos and history; approve/reject with explanation; pickup/replacement actions; exceptions; store policy settings; a small performance report.

For wrong-item or damage requests, ask for evidence relevant to that issue. For a routine size change, use the merchant's chosen requirements. Keep optional information visibly optional.

Track separate statuses for the request, old-item return, and replacement shipment. An approved request is not equivalent to a completed exchange.

Two supported operational patterns should be explicit:

- **Inspect first:** collect the old item, inspect it, then dispatch the replacement.
- **Courier swap:** dispatch a replacement and have the courier collect the old item on the exchange route, with return receipt and inspection tracked afterward.

Bosta documents both customer return pickup and exchange deliveries. Its exchange delivery brings the replacement to the shopper and returns the exchanged package. Confirm which service the pilot account can use and its commercial conditions before automating it. Its separate fulfillment API is a distinct integration surface, not interchangeable with the standard delivery API. [Bosta delivery documentation](https://docs.bosta.co/docs/how-to/create-your-first-delivery/), [Bosta fulfillment exchange API](https://docs-fulfillment.bosta.co/api-reference/createorder/create-exchange-order/)

## 4. Technical foundation

For a Shopify-first product, use its official React Router app template for the merchant application and authentication. Build the public portal alongside it. Shopify recommends that template for most new apps. [Shopify scaffold guide](https://shopify.dev/docs/apps/build/scaffold-app), [Official libraries and templates](https://shopify.dev/docs/api/libraries-and-templates)

Recommended components:

- TypeScript application and server code.
- PostgreSQL for merchants, request items, policies, shipments, financial records, and events.
- Private object storage for evidence photos.
- Background jobs for courier actions, notifications, sync, and retries.
- Shopify adapter and one courier adapter behind separate interfaces.

Obtain legitimate app distribution and necessary order/customer-data access before live merchant rollout. Prototype with sample orders first. Choose the appropriate Shopify billing path when implementing a paid public app; the proposed EGP pilot prices are commercial hypotheses, not an implemented platform billing configuration.

Treat merchant separation, purchase verification, webhook validation, duplicate-action prevention, and reliable retry behavior as release requirements. Revalidate eligibility and available quantity server-side; do not trust the selected size or price sent from a browser. Keep manual financial authorization during the first controlled pilot.

### Build sequence and completion criteria

| Stage | Work | Completion criterion |
|---|---|---|
| 1 | Sample-data customer portal and merchant dashboard | One request can be created, reviewed, and tracked on mobile and desktop |
| 2 | Store connection, real order lookup, eligibility and stock checks | Authorized order data works; invalid access, quantities, and policies are rejected |
| 3 | One courier integration and status updates | Approved test action creates one shipment; retries and duplicate events cannot create duplicates |
| 4 | Exception queue, financial record, staff roles | Stock failure, missed pickup, and partial request have visible next actions and correct permissions |
| 5 | Controlled pilot | Merchant completes representative cases and can reconcile the request, parcel, and fee records |

Estimate timing after confirming your skills, team, integration access, and budget. A polished prototype is substantially faster than a dependable production integration.

## 5. Alternatives with potentially larger opportunities

The ranking below is judgment about plausible frequency and economic value, not a quantified market-size estimate.

| Idea | Why it may have greater potential | Competition and difficulty | Recommendation |
|---|---|---|---|
| Cross-courier COD settlement checking | Can apply to many delivered orders and industries; money discrepancies are concrete | Requires accurate exports and contracts; Handlha already markets COD reconciliation | Test as the strongest alternative, starting with merchant-provided files |
| Failed-delivery recovery | Can prevent shipping waste and lost orders before an exchange is relevant | Carrier tools and COD platforms already cover parts of the workflow | Useful adjacent expansion if pilots show recurring failures |
| Fashion size and return prevention | Can reduce the need for returns rather than only process them | Needs reliable size charts, sales denominators, and enough outcomes | Add simple analytics first; advanced recommendations later |
| WhatsApp order confirmation | Potentially frequent use across COD orders | Wati and Egypt-targeted Shrinkit already sell it; confirmation alone is easy to copy | Use as a channel or integration, rather than the whole business |

Handlha publicly advertises courier settlement reconciliation and profit tracking for Egyptian/MENA brands, with Shopify plans starting at $20/month. Wati documents automated confirm/cancel COD messages. Wegocod markets confirmation, shipping, returns, and finance together. Their actual performance and adoption were not validated here. [Handlha listing](https://apps.shopify.com/handlha), [Wati documentation](https://support.wati.io/en/articles/11463119-how-to-set-up-cash-on-delivery-automated-messages-in-wati-s-shopify-app), [Shrinkit Egypt](https://shrinkit.me/egypt), [Wegocod](https://wegocod.com/)

The opportunity in settlement checking would be an accurate cross-courier exception report with explainable matches and a documented resolution trail. It must clearly distinguish unsettled amounts that are not yet due from genuine missing or incorrect payments. Do not label every unmatched row as lost money.

## 6. Compare two problems with the same merchants

During interviews, request a demonstration of both exchanges and courier settlement checks. For merchants who consent, conduct a small analysis using permitted exports and record:

- Hours spent per month on each problem.
- Financial impact supported by actual records.
- Data access and integration friction.
- Existing tools and remaining gaps.
- Willingness to pay for a specific result.

Choose the first product from those results. Access to five fashion merchants with a painful exchange workflow can be more valuable than a theoretical larger market you cannot reach.

## 7. Initial sales and pricing

Start with a monthly brand subscription. Test a guided pilot in the approximate 1,000–2,500 EGP/month range, with stated volume, support, and paid start date. This range is a proposal, not validated willingness to pay. Quote any messaging, courier, or custom integration costs explicitly.

Acquire early customers through fashion-brand contacts, Shopify implementers, and referrals from pilot merchants. Demonstrate a complete difficult request and show a baseline comparison. Measure contribution after support costs, retention, and time to onboard before increasing acquisition spending.

A sensible expansion sequence is exchanges → delivery exceptions → settlement visibility, but only if merchants pay for each added capability. Avoid assuming that one product must become a full ERP.

## 8. Plan for the confirmed 10,000 EGP budget

This budget supports a disciplined validation attempt and limited pilot if we do the development ourselves. It is not a guarantee of production operating costs. Use spending ceilings rather than committing the full amount at the start.

| Budget envelope | Maximum initial allocation | Release condition |
|---|---:|---|
| Hosting, database, evidence storage, domain | 2,000 EGP | A pilot merchant needs a hosted version; obtain current quotes first |
| Messaging and test operations | 1,000 EGP | A pilot requires them; confirm provider charges and merchant responsibilities |
| Integration or other necessary pilot expense | 1,000 EGP | Specific blocker and written cost are understood |
| Uncommitted reserve | 6,000 EGP | Retain until operating costs and merchant demand are clearer |
| **Total** | **10,000 EGP** | |

These are proposed spending limits, not advertised vendor prices. Free local development is the first milestone; avoid opening paid subscriptions automatically. Existing merchant courier fees remain the merchant's responsibility unless explicitly agreed otherwise. Founder and assistant development do not remove costs for production infrastructure, messaging, integration access, or support.

### First build milestone

Build a local sample-data prototype with six screens: order access, item selection, reason/evidence, replacement size, fee summary/confirmation, and status tracking. Add a merchant queue and request detail so the same request is visible on both sides.

Use a neutral demo brand, sample orders, and configurable Egyptian-pound amounts. The demonstration must handle an unavailable size, an ineligible item, a rejected request with a reason, and an overdue pickup. Make Arabic/English and mobile layout part of the initial design.

This demo should allow the founder to show a complete request to merchants before committing to external services. It is a prototype milestone; live order verification, courier booking, and refunds require the later integration work.

### First two weeks

- Days 1–3: define size-exchange rules and assemble the local prototype; identify ten reachable merchants in parallel with the development work.
- Days 4–7: demonstrate it to at least five merchants, record their workflows, and ask for three pilot commitments at a specific proposed price.
- Week 2: revise the workflow around the first committed merchant, confirm integration access and app distribution requirements, and start connecting sample/test data.

This is a target sequence, subject to the founder's available hours and account/integration access. If merchants use a different store platform or need inspection-first returns, change the integration or workflow before spending on production.

### Decision on the alternative idea

With this budget, investigate COD settlement checking using merchant-approved exports before building another set of integrations. A one-off comparison of delivered orders, fees, and remittances can test whether merchants value it. Change direction only if the evidence of pain and willingness to pay is stronger than for exchanges; a broader theoretical market alone is insufficient.

## Immediate next actions

1. Use the confirmed self-build approach and 10,000 EGP ceiling to scope the sample-data exchange prototype.
2. Find ten reachable brand owners and identify their actual platforms/couriers.
3. Conduct workflow interviews and secure three pilot commitments.
4. Build the sample-data portal and request dashboard while integration access is arranged.
5. Select the production workflow using pilot evidence and finish one complete integration.

The earlier [competitor and revenue report](Estebdal-competitive-report.md) remains a historical review dated 29 September 2026. Its proposed prices and business scenarios are assumptions to revisit after pilots.
