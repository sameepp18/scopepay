# Free Render Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline. The user authorized building/deployment and selected a free 30-day Render demo. Continue without routine approval gates; stop for new sensitive transmissions or costs.

**Goal:** Deploy the existing sandbox app on free Render with records surviving app restarts.

**Architecture:** Optional Postgres JSONB state store, session advisory lock, serialized commits, fail-closed database errors; retain file store for local runs.

**Tech Stack:** Node 22, pg, existing static UI and node:test.

**Spec:** ../specs/2026-11-12-free-render-design.md

## Global Constraints

- No paid resources or automatic upgrade. Database expires after 30 days.
- One process; unchanged stored payment IDs/digests and capture safety rules.
- No secret logging, data upload from existing local records, or silent file fallback.
- Real SQL verification in addition to injected failure tests.

## Review Focus

1. Lost database write acknowledgement must block further operations until restart.
2. Second process must fail to acquire the session lock.
3. Failed mutation must not modify saved state; next mutation may proceed if the database stayed healthy.
4. Connection failure during idle/read must never return stale financial state.
5. Free restart/redeploy must reload the same project and payment attempt.

### Task 1: Optional durable Postgres store

Files: lib/postgres-store.mjs, lib/config.mjs, lib/http.mjs, test/postgres-store.test.mjs, scripts/check-storage.mjs, package.json and lockfile.

Interface: PostgresStore.open(connectionString, {Client}), read(), update(fn), close(). Database URL optional; createApp chooses Postgres only when configured.

- [ ] Write failure/recovery contract tests, run RED before implementation.
- [ ] Implement session lock, JSONB row persistence and fail-closed behavior; configure pg without disabling certificate validation for external TLS.
- [ ] Run unit suite and a real database test script covering restart, concurrent writes, rollback and second-process lock.

### Task 2: Free hosting and handoff

Files: render.free.yaml, .env.example, README.md, SETUP.md, AGENTS.md; separate verification report.

- [ ] Document free limits, optional database dependency, backup/expiry and private key setup.
- [ ] Fresh code reviewer checks storage failure paths and hosting configuration; fix important findings with regressions.
- [ ] Commit/push checked source, create only free database/server with explicit secret-transmission approval, then verify health, authentication, persistence and hosted Checkout readiness.
- [ ] Record what actually ran; preserve unverified real AI and browser callback limitations.

## Execution record

Ruling: work on a new branch in the existing dedicated project checkout; preserve the separately stored local sandbox records and running server. No unrelated edits exist.

Storage review: one important finding, cached reads could outlive an undetected lost database connection. Added a failing read-probe regression, then serialized a bounded database query on every read. All 55 tests pass after the fix. Added commit-success/ack-loss coverage demonstrating committed identifiers reload on restart. Real database verification extended to a complete simulated payment lifecycle and repeated capture callback after restart.

Ruling: keep single-owner locking and disable automatic deployment. Render overlaps rolling replacements, so updates require stopping the existing process before a replacement. This is acceptable for a temporary hackathon demo; it costs downtime and possibly an updated demo hostname, and is documented rather than claiming seamless rolling updates.

Final local verification: 59/59 tests pass after explicit STORAGE_MODE validation was added to prevent an omitted deployment URL from selecting temporary file storage. PostgreSQL 18 real-database checks passed, including a simulated payment capture, restart with identical order/capture/digest, and repeat callback with zero new captures. Only the isolated temporary check schema was removed. The free application database contains no imported local records. Deployment and hosted-flow verification remain pending.
