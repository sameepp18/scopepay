# Setup and first real test

## 1. Start without credentials

Install Node.js 22.19 or newer, extract this folder, then run `npm ci`, `npm test` and `npm start`. Open http://127.0.0.1:3000. Both modes default to demo. Stop with Ctrl+C before changing configuration.

Copy `.env.example` to `.env` in this folder. Never commit or share `.env`, `.env.local`, or the `data` folder. Existing credentials elsewhere on your computer are not automatically imported.

## 2. Add provider credentials

In the PayPal developer dashboard, select a **sandbox REST app**. Copy its Client ID and Secret to `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`. Keep a separate sandbox personal buyer account for Checkout; its email/password do not belong in server configuration. Seller and buyer must be different accounts. Account-country eligibility and funding must be checked with an actual sandbox purchase.

Add an Anthropic API key with available credit to `ANTHROPIC_API_KEY`. The default model is `claude-haiku-4-5-20251001`; change `ANTHROPIC_MODEL` if your account requires another model supporting structured outputs. Anthropic billing is separate from a Claude chat subscription.

Run `npm run check`. This makes one tiny billable Claude request and a PayPal sandbox authentication request. It never creates an order or transfers money. Missing keys cause an expected NOT READY result. A successful check confirms access, not an end-to-end payment.

## 3. Enable the real adapters

Set these values in `.env`:

```dotenv
AI_MODE=live
PAYPAL_MODE=sandbox
```

Restart with `npm start`. Confirm the mode banner says live AI and sandbox payments. Do not use production PayPal credentials. No production payment mode is implemented.

## 4. Verify a sandbox purchase

1. Use fictional agreement/request text. Compare it and check the actual model's classifications and exact evidence quotes.
2. Approve extras and set prices yourself: booking $180, second page $120. Review the message, included work, exclusions and timing before publishing.
3. Open the private client link. Ask for booking under $200. Confirm only booking is selected and the total is $180.
4. Check the agreement box, open PayPal Checkout, and sign in as the separate sandbox buyer. Confirm the displayed amount/currency before approving.
5. Check ScopePay shows paid, $180.00 USD, an order ID and capture ID. Compare both IDs and the amount with PayPal's sandbox transaction record.
6. Refresh the agreement and restart ScopePay. Confirm the record persists and no second capture appears. Refresh reconciles only; it does not charge.
7. Try cancelling Checkout on a separate project. Confirm it is not shown as paid. If a payment is pending or uncertain, reconcile the existing attempt before trying anything else.

Do not call a simulated payment a sandbox payment. Real Claude and PayPal purchase verification remain unfinished until you perform these steps successfully.

## 5. Hosting preparation

The included `render.yaml` is a proposed single-instance Node service with a persistent disk. Review Render's current plan and disk prices before creating it; deployment can cost money. Nothing has been published by this build.

For any hosted service set `HOST=0.0.0.0`, `NODE_ENV=production`, an HTTPS `PUBLIC_URL`, and a random `DESK_KEY` of at least 24 characters. Render can supply `RENDER_EXTERNAL_URL` instead of `PUBLIC_URL`. Store provider keys in the host's secret settings. Set `DATA_DIR` to a persistent private disk and run **one instance only**. Build command: `npm ci`; start command: `npm start`; health path: `/healthz`.

The freelancer desk requests the desk key. Keep it private; judges can use a published client link or run their own local copy. There is no public self-service signup or isolated judge account. Do not publish the desk key in the submission. Demo deployment defaults keep both modes simulated until you explicitly change them.

## 6. Optional verified webhooks

After obtaining a public HTTPS URL, register `https://YOUR-HOST/api/paypal/webhook` on the same PayPal sandbox app. Subscribe to capture completed, pending, denied, refunded and reversed events as available. Set the returned webhook ID in `PAYPAL_WEBHOOK_ID` and restart.

Signature verification uses PayPal's server API. Unconfigured or unverified events are rejected. Events are deduplicated and reconcile the stored provider order; refund/reversal events flag manual review. No webhook initiates a capture. Without a webhook, use the client payment refresh to reconcile. Check delivery logs during your real sandbox test.

## Recovery and privacy

Back up `DATA_DIR` securely while the app is stopped. Never run multiple processes against it. If startup reports another process owns the lock, stop that process normally; do not delete a live lock. A crashed process's stale lock is detected on the next start. Preserve data until an uncertain payment has been reconciled with PayPal.

AI has a daily request cap (`MAX_AI_PER_DAY`, default 150) and per-client rate limits, but these reset on restart and are not a provider spending limit. Configure billing limits with the provider. Use fictional data: live AI sends agreement text and conversation to Anthropic, and payment details go to PayPal. Private client links grant access to their agreement and are not automatically revoked.
