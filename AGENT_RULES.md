# Non-negotiable rules for this project

1. NEVER run any Prisma command that touches the database schema (migrate dev, migrate deploy, migrate reset, migrate diff, db push, or anything with --shadow-database-url) without first showing the exact command to the project owner and getting explicit typed approval — every single time, no exceptions, even if it seems safe or was approved before.
2. NEVER point --shadow-database-url at the real DATABASE_URL. If a shadow database is genuinely needed, it must be a separate, disposable database created just for that purpose, never the production connection string.
3. If any command hangs or seems stuck, STOP and ask the owner what to do. Never force-kill processes, and never use a broad kill command (e.g., killing all node processes) — this can corrupt an in-progress database operation.
4. The only approved way to apply schema changes to this database is npm run db:apply (server/scripts/apply-migrations.js), reviewed and approved by the owner before running, since standard Prisma commands don't work through Supabase's pooler.
5. Before any schema-changing operation, take a row-count snapshot of key tables (products, customers, orders, categories) and show it to the owner as a "before" baseline.

This file exists so that any AI agent working on this project, in any session, reads it before doing anything database-related. On 2026-09-22, a migration command wiped the production database (demo data only, but it must never happen again) — these rules exist because of that incident.
