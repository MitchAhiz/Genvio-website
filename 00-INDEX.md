# Genvio Exotic Apparel — Admin Panel Rebuild
## Task Index

This folder contains the full admin panel rebuild broken into
standalone tasks. Each task is self-contained: it includes its own
handoff context and its own Claude Code prompt, so you can paste a
single file into a brand-new Claude Code session and it will know
exactly what to do, where to look, and what NOT to touch.

**Do not skip ahead.** Each task depends on the ones before it
actually existing in the codebase. Run them in this order:

| # | File | Builds | Layer |
|---|------|--------|-------|
| 01 | TASK-01-database-schema.md | New tables + ALTERs | DB |
| 02 | TASK-02-backend-utilities.md | Activity logger, config service, payment endpoint update | Backend |
| 03 | TASK-03-subcategories-api.md | Sub-category CRUD endpoints | Backend |
| 04 | TASK-04-activity-analytics-api.md | Activity log + analytics endpoints | Backend |
| 05 | TASK-05-orders-config-api.md | Order notes + site config endpoints | Backend |
| 06 | TASK-06-admin-shell.md | Layout, sidebar/tab bar, toast, confirm dialog, skeletons | Frontend shell |
| 07 | TASK-07-admin-products-tab.md | Products tab (table, modal, low stock, sub-cat drawer) | Frontend |
| 08 | TASK-08-admin-orders-tab.md | Orders tab (table, filters, detail drawer) | Frontend |
| 09 | TASK-09-admin-analytics-tab.md | Analytics tab (cards, 3 charts, best sellers) | Frontend |
| 10 | TASK-10-admin-wholesale-tab.md | Wholesale tab (drag reorder, categories) | Frontend |
| 11 | TASK-11-admin-settings-tab.md | Settings tab (banking, site controls, activity log, security) | Frontend |
| 12 | TASK-12-public-site-integration.md | Public site reacts to maintenance mode / visibility / checkout toggle | Frontend |
| 13 | TASK-13-deployment.md | Restore Supabase, deploy Render, configure Vercel, smoke test | Deployment |

---

## How to use each file

1. Open a **new Claude Code session** in the project root.
2. Paste the **entire contents** of the numbered task file as your
   first message.
3. Each file tells Claude Code to read `HANDOFF.md` first (attach or
   paste that too — see below), then gives exact scope: what to
   build, which files to touch, which files not to touch, and a
   "Done When" checklist to self-verify against before it says it's
   finished.
4. When the task is done and verified, move to the next numbered
   file in a **fresh session**. Don't chain tasks in one long session
   — fresh context per task keeps Claude Code accurate and avoids it
   losing track of scope.

## Also in this folder

- **HANDOFF.md** — the full project reference doc (architecture,
  stack, data model, current state, file structure). Every task file
  tells the agent to read this first. Keep it in your project root
  permanently and update it as things change.

## Dependency chain

```
01 (schema)
 └─ 02 (backend utils)
     ├─ 03 (subcategories api)
     ├─ 04 (activity + analytics api)
     └─ 05 (orders + config api)
         └─ 06 (admin shell)
             ├─ 07 (products tab)      ─ needs 03
             ├─ 08 (orders tab)        ─ needs 05
             ├─ 09 (analytics tab)     ─ needs 04
             ├─ 10 (wholesale tab)
             └─ 11 (settings tab)      ─ needs 04, 05
                 └─ 12 (public site integration) ─ needs 05
                     └─ 13 (deployment)
```

Tasks 07–11 can technically be done in any order relative to each
other once 06 is done, but doing them in numeric order matches the
original plan and keeps testing simpler (one tab at a time).
