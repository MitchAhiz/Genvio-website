# Genvio Exotic Apparel — Full Project Handoff

Use this document to continue the project in a new Claude chat or
Claude Code session. It contains the complete history, current state,
what's built, what's pending, and what's next. **Read this fully
before writing any code.**

---

## 1. What This Project Is

**Genvio Exotic Apparel** — a premium, mobile-first multi-section
fashion catalogue and ordering web application with a B2B wholesale
gallery. Originally specced as a single women's catalogue called
"MARY", it has since been renamed and expanded into a multi-section
platform.

**It is NOT a full ecommerce platform.** The core loop is:

```
Browse → Select → Bag → Checkout → Bank Transfer → Order Submitted
```

There is no payment gateway. Customers pay by bank transfer and
submit the order; the admin confirms payment manually.

---

## 2. Project Architecture

```
Frontend (React + Vite + Tailwind)  →  Vercel (deployed, live)
     ↓ fetches from
Backend (Express + Prisma)          →  Render (NOT yet deployed)
     ↓ connects to
Database (PostgreSQL)               →  Supabase (free tier, currently paused)
     ↑ uploads images to
Telegram Bot (grammY)               →  NOT yet built
     ↑ stores images on
Image Storage (Cloudinary)          →  NOT yet set up
```

### Live URLs
- **Frontend:** https://genvio-website.vercel.app
- **GitHub repo:** https://github.com/MitchAhiz/Genvio-website
- **Backend:** only runs locally on port 4000 (not yet deployed to Render)

### Tech Stack
- React + Vite + Tailwind CSS + React Router (frontend)
- Express + Prisma + PostgreSQL (backend)
- Supabase (database hosting, free tier)
- Brevo (email OTP for admin login)
- Vercel (frontend hosting)
- Render (planned backend hosting, free tier)
- Cloudinary (planned image storage, not set up yet)
- grammY (planned Telegram bot framework, not built yet)

---

## 3. Site Structure

### Landing Page (/)
Two full-height photo doors: "Shop" and "Wholesale"
- Shop → leads to /shop (retail, defaults to Men)
- Wholesale → leads to /wholesale (image-only gallery)

### Retail Sections (/shop/*)
Three sections, each with its own color theme:

| Section | Route | Primary | Secondary | Accent |
|---------|-------|---------|-----------|--------|
| Men | /shop/men | #171717 (Charcoal) | #D6C3A5 (Warm Sand) | #F5F1E8 |
| Women | /shop/women | #3B1F35 (Deep Plum) | #D8A7B1 (Soft Blush) | #F8F1F2 |
| Kids | /shop/kids | #6F8068 (Sage) | #F3D9A4 (Warm Cream) | #FFF9ED |

Section order everywhere: **Men → Women → Kids**

- Persistent sticky section switcher in header (Men · Women · Kids)
- Each section has its own product catalogue, filtered by section
- One shared shopping bag across all sections
- Kids uses age-based sizing (2-3Y, 4-5Y, 6-7Y) instead of XS-XL
- Product URLs: /shop/:section/product/:slug

### Wholesale (/wholesale)
- Image-only gallery/lookbook for business buyers
- No cart, no product detail pages
- Separate data from retail products (wholesale_images table)
- Category filter if categories exist
- Neutral/stone theme

### Admin (/admin)
- Protected by email OTP login (exoticapparels0105@gmail.com only)
- OTP sent via Brevo, from "Genvio Exotic Apparel Admin"
  <exoticapparels0105@gmail.com>
- 30-day session cookie
- **Currently only partially built** — this is what the numbered
  task files (01–13) rebuild into a full site control room

---

## 4. Notable Design Decisions Already Built

- Checkout is a 4-step sheet ending in bank-transfer details with
  tap-to-copy account number.
- Returning customers can opt into a 4-digit PIN that auto-fills
  their name and address on future orders. PINs are bcrypt-hashed.
  The phone-lookup endpoint returns only `{exists, hasSavedDetails}`
  — never raw personal data — so a stranger with a phone number can't
  fish for someone's address. Saving details requires a valid order
  reference, so strangers can't claim a phone number that isn't theirs.
- The ₦ symbol has no glyph in the Playfair Display font used for
  headings — render it in Inter at 0.95em instead (documented in
  DESIGN.md).

---

## 5. Current State

Everything on the original feature list (public site, checkout, PIN
system) is built and verified — but **only against mock fixtures**,
since Supabase is currently paused. Nothing has been confirmed
against a real database yet. Task 13 (deployment) covers bringing
the real database online and verifying end-to-end.

The admin panel is **partially built** — a products list and basic
login exist, but not the full control-room spec described in Section
7 below. Tasks 01–12 rebuild it completely.

---

## 6. What's Blocking Go-Live (in order)

1. Restore Supabase (currently paused on free tier)
2. Run migrations via the custom `npm run db:apply` script — **note:**
   Prisma's normal `migrate dev`/`migrate deploy` do NOT work through
   Supabase's transaction pooler connection, this project uses a
   custom script that applies migration SQL directly via the Prisma
   runtime client
3. Add the client's real bank details to config (now via admin panel,
   see Section 7 — no longer hardcoded in `.env`)
4. Push to GitHub
5. Deploy backend to Render
6. Set `VITE_API_URL` on Vercel
7. Redeploy frontend and test end-to-end

This full sequence is Task 13.

**Two housekeeping items, do these regardless of timing:** the Brevo
API key and the Supabase database password were both pasted into a
chat at some point during setup and should be rotated before this
goes live publicly. Also plan for free-tier sleep behavior on both
Supabase and Render — a first request after Render's free tier sleeps
can take 30–50 seconds, which is a rough first impression for a
shopper. Consider a keep-alive ping or upgrading later.

---

## 7. Admin Panel — Full Target Spec

This is what tasks 01–12 build. Read this section fully before
starting any admin task, even if the individual task file only
covers one piece of it — it gives you the full picture so you don't
paint yourself into a corner.

### Navigation
Persistent left sidebar (collapses to bottom tab bar on mobile) with
five tabs: **Products · Orders · Analytics · Wholesale · Settings**

Global UI patterns across all tabs:
- Confirmation dialogs before every destructive action
- Toast notifications for every action (saved, deleted, updated)
- Loading skeletons while data fetches
- Mobile-first, fully responsive
- Sticky sidebar/tab bar always visible
- Empty states with helpful prompts (not blank screens)
- Admin theme: neutral — white background, slate/zinc greys, no
  section color themes bleeding in
- All modals trap focus, dismissible with Escape key
- All tables horizontally scrollable on mobile, not broken

### Tab 1 — Products
- Section filter tabs (All/Men/Women/Kids), search bar, Add Product
  button, bulk actions (publish/unpublish/delete selected)
- Low Stock Alert panel: collapsible, lists every variant size with
  qty ≤ 2, dismissible per session
- Table: checkbox, thumbnail, name (inline edit), section +
  sub-category, price (inline edit), stock count (red if any size
  ≤ 2), status badge (click to toggle), edit + delete actions
- Full Edit Modal: basic info, variants (colour + image), sizes per
  variant (label + quantity), images (upload/reorder/delete),
  Draft/Published toggle
- Sub-category Manager drawer: add/rename/delete per section, delete
  prompts reassign-or-unpublish if products exist under it

### Tab 2 — Orders
- Summary cards: today / this week / this month / pending / confirmed
- Filters: status, date range, search by order ref or masked phone
- Table: order ref, date/time, masked phone, items summary, total
  (₦), status badge (inline dropdown), view button
- Order Detail Drawer: full item list, customer name + address,
  payment method, status history, internal notes field (admin-only)

### Tab 3 — Analytics
- Revenue cards: all time, this month (% vs last month), this week,
  pending revenue, confirmed revenue
- Charts (Recharts): revenue over time (line, 7d/30d/3m toggle),
  orders by section (grouped bar, Men/Women/Kids), status breakdown
  (donut or horizontal bar) — all with hover tooltips
- Best Sellers table: rank, product, section, units sold, revenue,
  sortable, click row opens that product's edit modal

### Tab 4 — Wholesale
- Gallery grid matching public wholesale layout
- Per-image: edit (caption/category/image), delete, drag-to-reorder
  (@dnd-kit)
- Add Images modal: upload, caption, category (existing or new)
- Category Manager: add/rename/delete, delete prompts reassign

### Tab 5 — Settings
- **Payment & Banking**: account name/number/bank name, number
  masked with reveal toggle, saves immediately (no .env, no
  redeploy), change history (last 3 updates with timestamps)
- **Site Controls**: maintenance mode toggle (public "back soon"
  page, admin still works), section visibility toggles (hide
  Men/Women/Kids/Wholesale from public nav without deleting),
  checkout toggle (disable bag/checkout, browsing still works),
  minimum order amount (optional)
- **Notifications**: order alert email, editable
- **Activity Log**: timestamped list of all admin actions (product
  CRUD, order status changes, wholesale image changes, bank/settings
  changes, admin login/logout), searchable, paginated 20/page,
  read-only
- **Session & Security**: current session info, logout,
  "invalidate all sessions" button

### Backend Support Needed

**New tables:**
```
site_config: id, key (unique), value, updated_at
subcategories: id, name, section, created_at
activity_log: id, action, entity_type, entity_id, detail (JSON), created_at
config_change_history: id, key, old_value, new_value, changed_at
```

**Alterations to existing tables:**
- `products`: add `subcategory_id` (nullable FK to subcategories)
- `orders`: add `notes` (text, nullable)

**New API endpoints (all admin-auth protected unless noted public):**
```
Site config:
  GET   /api/config/all
  PATCH /api/config
  PATCH /api/config/payment          (extends existing, logs to config_change_history)
  GET   /api/config/site             (PUBLIC — maintenance_mode, section_visibility, checkout_enabled, min_order_amount)

Sub-categories:
  GET    /api/subcategories?section=
  POST   /api/subcategories
  PATCH  /api/subcategories/:id
  DELETE /api/subcategories/:id      (body: { action: "reassign"|"unpublish", reassignTo?: id })

Activity log:
  GET  /api/activity?page=&search=
  POST /api/activity                 (internal use, called by other endpoints)

Analytics:
  GET /api/analytics/revenue?period=7d|30d|3m|all
  GET /api/analytics/orders-by-section?period=week|month|all
  GET /api/analytics/status-breakdown
  GET /api/analytics/best-sellers?sort=units|revenue&limit=10

Orders:
  PATCH /api/orders/:id/notes
```

**Middleware:** every admin write endpoint calls a `logActivity
(action, entityType, entityId, detail)` utility after a successful
operation, which inserts into `activity_log`.

**Public endpoint changes:**
- `GET /api/config/payment` must read from `site_config`, not env
  vars, so admin changes take effect immediately
- `GET /api/config/site` is a new public endpoint the frontend reads
  on load

### Frontend Integration Notes
- Frontend already reads `VITE_API_URL` for all API calls — no
  change needed there
- On app load, fetch `/api/config/site`. If `maintenance_mode` is
  true and the current path is not `/admin`, render a full-screen
  "We'll be back soon" page
- Section visibility hides sections from the nav switcher and
  redirects direct navigation to a hidden section's URL
- If `checkout_enabled` is false: hide the bag icon, replace checkout
  button with "Ordering currently unavailable"
- Charts: Recharts
- Drag to reorder: @dnd-kit/core + @dnd-kit/sortable

---

## 8. Explicitly Out of Scope (V1)

- Customer accounts / authentication beyond the 4-digit PIN
- Payment gateway — bank transfer only
- Coupons, reviews, wishlist, loyalty program
- Shipping engine / logistics integration
- Recommendation engine
- Complex analytics beyond what's specified in Tab 3 above

---

## 9. Roadmap After Admin Rebuild

7. Complete admin panel rebuild — all 5 tabs (tasks 01–12, this doc)
8. Telegram upload bot — separate spec, not part of this task set
9. Cloudinary setup — for bot image uploads
10. Final UI/design polish pass
11. Custom domain

---

## 10. Key Files in the Repo

```
/ (project root)
├── HANDOFF.md              # This file — complete project state
├── CLAUDE.md               # Frontend spec / north star
├── TELEGRAM_BOT.md         # Backend + bot spec (future)
├── TELEGRAM_BOT_BRIEF.md   # Complete bot build brief (future)
├── SITE_STRUCTURE.md       # Multi-section architecture
├── PRODUCT.md              # Product direction
├── DESIGN.md               # Design token system documentation
├── vercel.json              # Rewrite rule for client-side routing
├── package.json             # Frontend dependencies
├── vite.config.js
├── index.html
│
├── src/                     # Frontend (React)
│   ├── api/                 # Data access layer
│   ├── components/          # Reusable UI components
│   ├── pages/                # Route-level views
│   │   └── admin/            # Admin panel (being rebuilt)
│   ├── hooks/                # useTheme, useBag etc.
│   ├── sections.js           # Section definitions + theme config
│   └── index.css             # Theme token system
│
├── server/                  # Backend (Express + Prisma)
│   ├── package.json
│   ├── .env.example
│   ├── prisma/
│   │   └── schema.prisma     # Full data model
│   └── src/
│       ├── index.js          # Express entry point
│       ├── db.js             # Prisma client
│       ├── constants.js      # Allowed sections, statuses
│       ├── routes/           # Route handlers
│       ├── services/         # Prisma queries
│       ├── middleware/       # Auth middleware
│       └── utils/            # Sanitization, rate limiting,
│                              # logActivity utility (added in Task 02)
│
├── .impeccable/              # Design review artifacts
│
└── bot/                      # Telegram bot (NOT built yet)
    └── (empty)
```

---

## 11. Supabase Connection Details

- **Project:** genvio-db
- **Project ID:** zkhlzirvwoamsuwpzimk
- **Region:** eu-west-1 (Ireland)
- **Connection:** Transaction pooler (port 6543) — NOT direct
- **Host:** aws-1-eu-west-1.pooler.supabase.com
- **Important:** standard Prisma `migrate dev`/`migrate deploy`
  commands don't work through the transaction pooler. Use
  `npm run db:apply`, which applies migration SQL directly via the
  Prisma runtime client.
- **DNS:** machine uses Google DNS (8.8.8.8 / 8.8.4.4)

---

## 12. Auth / Email Notes

- Admin login is OTP-only, restricted to
  `exoticapparels0105@gmail.com`
- OTP emails send via Brevo, sender address
  `exoticapparels0105@gmail.com`, display name
  "Genvio Exotic Apparel Admin"
- This is a free Gmail address (not a custom domain) in Brevo, so
  DKIM/DMARC warnings are expected and non-blocking. Once a custom
  domain is purchased, authenticate it in Brevo and switch the
  sender to something like `noreply@genvioexoticapparel.com` for
  better deliverability.
- **Do not touch the OTP login flow** in any of the admin rebuild
  tasks — it works and is out of scope.

---

*End of handoff. Proceed to `00-INDEX.md` for the task list, starting
with `TASK-01-database-schema.md`.*
