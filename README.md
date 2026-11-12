# ScopePay

Turn an awkward “that's extra” conversation into a reviewed agreement and PayPal Checkout.

ScopePay compares a client's request with the original brief, cites evidence, and drafts a tactful explanation. The freelancer approves each extra and sets fixed prices. The client can revise the bundle conversationally, agree to exact terms, and pay through PayPal sandbox Checkout.

## Run locally

Requires Node.js 22.19 or newer and npm. No build step. The `pg` dependency supports optional PostgreSQL storage; local runs still use JSON files by default.

```sh
npm ci
npm test
npm start
```

Open http://127.0.0.1:3000. Defaults use visibly labelled demo AI and simulated payments; no keys are required and no money moves.

Try the example, compare the request, approve booking at $180 and a second page at $120, then publish. Open the client link and ask “Under $200, booking matters most.” Agree and simulate payment. All prices must be entered by the freelancer.

See [SETUP.md](SETUP.md) for real Claude and PayPal sandbox configuration, deployment and first-payment checks. [SUBMISSION.md](SUBMISSION.md) contains a submission draft and video script.

## Trust boundaries

- Quoted evidence must appear verbatim in the supplied source. Unverified additions become decisions and cannot be billed.
- AI proposes selections and wording. Server code enforces approved prices, integer-cent totals and explicit budget caps.
- Checkout binds an immutable consent snapshot to the stored order. A matching completed provider capture is required for paid status.
- Retries use stored request IDs. Refresh reconciles the existing order without capturing again.
- Server-only keys, origin checks, desk authentication when exposed, limited request sizes and rate limits protect the demo.

## Practical limits

This is a hackathon prototype for one freelancer desk, USD, one server process, and one persistent data directory. It is not a multi-tenant service. Published extra items must be independently selectable; dependencies between items are not modeled. Client links are private bearer links without expiry or a revocation UI. Share them carefully. Consent expires after 15 minutes before order creation; unresolved payment attempts remain locked for reconciliation.

Payment is immediate capture, not escrow or a delivery guarantee. Refund handling flags review; there is no refund administration UI. A real provider transaction and model response must be verified with your own credentials before a live demo. Automated tests replace external providers. Demo AI uses a limited deterministic example and does not fall back silently when live AI fails.

Local data is stored in an atomic JSON file with a process lock. Setting `DATABASE_URL` uses PostgreSQL instead, with a session lock permitting one server and a committed JSONB record for each update. A database connection/write failure blocks further operations until restart; it never switches to empty local storage. Neither mode supports horizontal scaling. Back up private data. Rate limits and desk sessions reset on restart.

`render.free.yaml` prepares a free Render server plus a free Postgres database. The database expires after 30 days and has no managed backups; the server sleeps after 15 minutes idle. Use this for a temporary fictional hackathon demo. Export data before expiry. The original `render.yaml` proposes paid persistent-disk hosting; paid deployment is not necessary for the free option. Hosting quotas and AI usage can incur costs; review account billing settings and do not enable upgrades automatically.

## Commands

- `npm test`: local tests with fake external providers.
- `npm run check`: tiny billable Claude request and PayPal OAuth authentication; no orders.
- `npm run check:storage`: real database checks using an explicitly supplied `STORAGE_CHECK_DATABASE_URL`, while the app is stopped. Creates and removes its own test schema; does not modify application records. Never pass connection URLs in command arguments or commit them.
- `npm run package`: archive a clean committed Git checkout to `../scopepay.zip`, excluding untracked local data and credentials. Requires Git.

The public client ID is expected in the browser in sandbox mode. The PayPal secret and Anthropic key must remain on the server. No analytics, email or third-party database is configured. Live AI sends the original brief, request and negotiation context to Anthropic; use fictional data for judge demonstrations.
