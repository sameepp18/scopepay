# ScopePay working instructions

Use Node.js >=22.19, built-in HTTP/fetch/crypto/fs, static HTML/CSS/JS and node:test. No build step. The only direct runtime dependency is pg for optional PostgreSQL storage on free hosting. Local JSON storage remains the default.

Commands: `npm ci`, `npm test`, `npm start`, `npm run check`, `npm run package`. The credential checker makes a tiny billable model request and OAuth only; tests must never call real external providers. Demo modes must stay explicit and must never silently substitute for live failures.

Keep all private environment files and runtime data out of Git and archives. Never print keys, buyer passwords or raw provider error responses. The PayPal public Client ID is allowed in browser configuration; other credentials are server-only.

AI interprets and drafts. Humans approve fixed prices. Server code validates exact evidence, IDs, integer-cent totals and budgets. Consent and payment amounts derive from stored immutable terms. Only a matching completed capture marks paid. Refresh and webhooks must never initiate capture. Preserve idempotent recovery behavior and add regression tests for payment changes.

Single process, USD, one freelancer desk. File storage requires a persistent private data directory; free Render uses DATABASE_URL instead. The Postgres session advisory lock enforces one owner; connection/write failures must block further operations until restart, with no empty-store fallback. Do not add multi-instance hosting without replacing storage/locking and shared rate/session state. Published items are independently selectable; dependencies are outside current scope. Client links are bearer credentials without expiry/revocation UI. Require desk protection and HTTPS when hosting.

Free Render server/database plans only are authorized for the current demo. The free database expires after 30 days and has no managed backups. No paid upgrades. check:storage is an explicit real-database check using STORAGE_CHECK_DATABASE_URL while the app is stopped; it creates and removes an isolated test schema, not application data. Ordinary tests inject provider/database failures and never load private keys.

Distinguish automated fake-provider tests, browser demo tests and actual sandbox/model verification. Never claim real provider success without an observed result. See SETUP.md for the launch checklist and README.md for limitations.
