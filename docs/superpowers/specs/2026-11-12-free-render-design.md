# Free Render demo storage

User selected a 30-day free Render demonstration after pausing paid deployment. Preserve the current two-screen Node app and sandbox-only payment flow. AI stays explicitly demo until its own key is configured.

Approaches: the paid persistent disk was paused; free local-file hosting loses payment records on restart; a free Render server plus free Postgres retains records during the database's 30-day lifetime and avoids another provider signup. User selected the 30-day option. No automatic paid upgrade is authorized.

Add an optional Postgres store behind the existing read/update/close interface. Keep local JSON storage as default. Store the small prototype state in one JSONB row, committing each serialized update before returning. A session advisory lock enforces one process. Fail closed after a database connection/write failure; never switch to empty local storage or retry an ambiguous write automatically. Restart reloads the persisted state. No payment behavior changes.

Production on free Render requires DATABASE_URL, protected desk, HTTPS and one instance. A free database has no managed backup and expires after 30 days; document manual export and expiry. Do not upload existing local payment data by default. Use fictional hosted demo data. Database and PayPal secrets stay in private configuration, never source or logs. Free-plan quotas/sleep apply; verify billing selection before creation.

Implementation choices delegated by user's project-build instructions: node-postgres for the hosted database; minimal adapter and config changes. Review code and run real-database contract checks before publishing. The uninterrupted SDK popup flow remains unverified in the in-app browser; do not disguise the successful approval-link/capture fallback.
