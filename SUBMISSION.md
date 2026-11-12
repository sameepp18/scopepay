# ScopePay submission draft

Complete the links and live-provider verification before submitting. This document is a draft, not evidence of eligibility or a completed submission. Recheck the official rules and deadline on the hackathon page.

## Tagline

Keep the client relationship. Agree on the extra work. Pay with PayPal.

## Inspiration

A small client request can hide a larger scope change. Freelancers need a clear agreement without turning a good working relationship into an argument. ScopePay brings the original brief, a tactful AI-assisted explanation, approved prices, and payment into one reviewable flow.

## What it does

The freelancer pastes the original agreement and a new client request. Claude separates the asks and classifies them as included, additional work, or a decision needing review. It quotes both source texts; the server checks the quotes before any additional item can be billed.

The freelancer approves the findings, sets each price, and edits the client-facing explanation. A private client page shows the approved menu. The client can ask for a smaller bundle, state a budget, or choose items directly. Code checks every selection and total against published prices. Discounts and scope disputes go back to the freelancer.

The client agrees to the displayed version of the terms and pays through integrated PayPal sandbox Checkout. The server creates the order from stored consent and records paid status only after a matching completed capture. No separate invoicing handoff is required. The freelancer desk retains the agreement and payment record.

## How we built it

Node.js, HTML, CSS, JavaScript, Anthropic Claude Messages API with structured output, and PayPal Orders REST API plus the PayPal JavaScript Checkout SDK. The app has no runtime package dependencies or build step. Tests use Node's built-in test runner. Render deployment configuration is included.

AI interprets and writes; the freelancer approves prices; code enforces totals, budget caps and payment state. Immutable consent fingerprints, stored idempotency identifiers and read-only reconciliation support safe recovery from repeated callbacks and lost responses.

We use direct Anthropic and PayPal APIs. We do not claim use of the PayPal Agent Toolkit, MCP server or other sponsor tools that are not implemented.

## Challenges and lessons

The difficult boundary is turning uncertain language into a specific financial agreement. Source quotes can support review, but they do not prove a model's interpretation is correct. Human review stays central. Payment callbacks are also uncertain: an interrupted response must be reconciled against the existing provider order before another action is attempted.

## Current limitations and next steps

This prototype supports one freelancer desk, USD, independently selectable extras, a single process and private bearer client links. Immediate capture is not escrow. Future work includes account separation, expiring/revocable links, item dependencies, stronger persistent audit storage and refund administration.

## Built With

PayPal, PayPal Checkout, PayPal Orders API, Anthropic Claude, AI, Node.js, JavaScript, HTML, CSS. Add Render only after deployment there.

## Judge access — fill before submission

- Hosted demo: [ADD HTTPS URL]
- Public source repository: [ADD REPOSITORY URL]
- Video: [ADD VIDEO URL]
- Published client demonstration link: [ADD FICTIONAL EXAMPLE LINK]
- Actual Claude response verified on: [ADD DATE / MODEL]
- Actual sandbox order/capture verified on: [ADD DATE; KEEP BUYER CREDENTIALS PRIVATE]

For a local run, use Node >=22.19: `npm ci`, `npm test`, `npm start`, then open http://127.0.0.1:3000. The default run uses labelled demo AI and simulated payments. SETUP.md explains how to use your own Claude and PayPal sandbox credentials. Never publish the host's private desk key or buyer password.

## Video script — approximately 2 minutes 40 seconds

**0:00–0:20 — The request.** “The brief includes headline revisions, but excludes booking and additional pages. The client asks for all three. ScopePay helps turn this into a clear agreement.” Show the freelancer desk and source text.

**0:20–0:50 — Visible AI.** Run the comparison. “Claude splits the request, quotes the brief and request, and drafts the awkward ‘that's extra’ explanation. These quotes are checked against the text. I still review the result and set every price.” Show actual evidence cards and edit the message.

**0:50–1:10 — Approved offer.** Enter booking $180 and the second page $120; approve and publish. “This is the freelancer's approved menu. The headline revision is included.” Open the client page.

**1:10–1:40 — Client revision.** Type “Under $200, booking matters most.” “The assistant proposes booking for $180 and defers the second page. The server checks that the package fits the explicit cap and uses only approved prices.” Show the selection and total.

**1:40–2:15 — PayPal.** “The client agrees to this exact version of the terms and pays through PayPal Checkout.” Show real sandbox buyer approval and the returned order/capture record. If credentials are unavailable, clearly say and show “simulated demo payment”; do not present it as actual PayPal execution.

**2:15–2:40 — Recovery and value.** Refresh the payment record. “A repeated callback cannot create a second capture. ScopePay keeps the approved scope and payment reference together, so both sides know what was purchased.” End on the recorded agreement.

## Final checklist

- [ ] Confirm current rules, eligibility, required links, repository visibility and video limit from the official hackathon page.
- [ ] Run an actual Claude request and a PayPal sandbox purchase; record the results honestly.
- [ ] Replace all link placeholders, deploy with persistent storage and private desk access, and test the hosted flow.
- [ ] Name and show both AI and PayPal in the description, Built With and video.
- [ ] Check source and deployment settings for private credentials; include only fictional demonstration data.
- [ ] Record/upload the video and complete the submission before the official deadline.
