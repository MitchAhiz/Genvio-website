# Product Upload — Project Spec
**Project:** Mary Website / Genvio
**Status:** Approved flow below — ready to build
**Interface:** Website form at `website.com/upload` — staff-only, behind login, **one page, no wizard navigation**. (Originally scoped as a Telegram bot; moved to a web form because Telegram has no real form UI — no dropdowns, no multi-field grids — and everything we needed kept fighting that constraint. Live camera capture, the reason Telegram was attractive, works fine in a mobile browser via `capture="environment"`, so nothing was actually lost in the move.)

**Non-negotiable:** All schema-changing DB work on this feature falls under `AGENT_RULES.md` at the project root. No Prisma migration commands without explicit typed approval from the owner — every time, no exceptions. This applies to every new table below (`product_variants`, `variant_sizes`, and anything else this feature needs).

**Launch scope:** the storefront itself is women's apparel only for now — Men and Kids sections will be hidden on the live site and reopened later. In this upload form, Category is therefore fixed to Women (staff choose only the Sub-category in Step 2); AI card generation is likewise women's-only for now (§3). **Men/Kids categories, sub-categories and products already in the database are not deleted or touched** — they stay exactly as they are for when those sections reopen; this is a storefront-visibility decision, not a data one.

---

## 1. Goal

Let staff create and restock products from one page: photograph the item (or supply an existing card image), get an AI-generated product-card image per photo plus AI-suggested name/color (all editable/overridable), fill in brand/name/category/sub-category/price manually (once per product, not per color), enter stock per size, and publish — with every step validated so bad data can't reach a database that has no backups.

---

## 2. Interface & Architecture

```
Website Admin (source of truth)
  ├─ Brands / Categories / Sub-categories
  └─ Size ranges per sub-category
         │
         ▼  (read-only internal API — not hardcoded in the upload form)
Upload Form  —  website.com/upload  (staff-only, behind login, single page)
  ├─ Step 1: Photos → product card (Shoot photos, or Use a card I already have)
  ├─ Step 2: Brand → name/colour suggestions (Gemini) → category/sub-category/price
  │     └─ Background dedup check against `products` (after brand+name are set,
  │        not before — see §4)
  ├─ Fetches sub-categories + size ranges live from the admin API
  ├─ Uploads raw photos + generated/supplied images to Supabase Storage
  └─ On approve → writes to `products` / `product_variants` / `variant_sizes`
         │
         ▼
Supabase (Postgres + Storage) — free tier, NO backups, NO point-in-time recovery
         │
         ▼
Storefront (website.com) — reads products/variants/sizes, renders product cards + detail pages
```

**Working demo (built during design, not the real build):**
- Chat-style prototype (superseded): tested the conversation logic
- Search-first one-page form prototype (superseded): the earlier "search before anything has a name" design — replaced by this doc's flow
- Current clickable prototype (approved): `https://claude.ai/artifact/GvyUXW4QpnLeRBnYzeeeZh` — reflects the flow in §4 below — Photos → Card → Details (brand/name/colour/category/price) → Stock → Review, with the background dedup warning replacing the old up-front search step. Includes the Mode A/Mode B toggle and the stock-input focus behaviour (clear-on-focus-if-zero, select-all-on-focus-if-populated, revert-to-zero-on-blur-if-empty). UI/logic only — no real Gemini or Supabase calls.

---

## 3. AI provider: Gemini, free tier for now

**Scope note:** AI card generation (Gemini image generation) is **women's apparel only for now** — the loaded prompts (§7) are written specifically for a Nigerian female model and women's garment construction. `POST /api/admin/upload/products` enforces this server-side: a colour with an `ai-generated` image is rejected outside the Women category. Staff-supplied images (Mode B) have no such restriction, since there's no AI prompt behind them to have scoped in the first place. Men's/Kids' card-generation prompts would be a separate, later addition — not an edit to the women's ones.

**Decision:** Start on Gemini's free tier. Used for exactly **three** things — nothing else:
1. **Product-card image generation** — Mode A only ("Shoot photos"); skipped entirely in Mode B ("Use a card I already have"). One generation call per uploaded **front** photo. The **back** card, if a back photo was taken, is generated separately and only after the front card is approved — see §4 Step 1 and §7 for why it needs the approved front card as a reference.
2. **Colour-name suggestion** — from `image[0]`, in either mode.
3. **Product-name suggestion** — from `image[0]`, in either mode. The `POST /api/admin/upload/suggest` call returns the garment description only (e.g. "Linen Wrap Dress") — no brand, since Gemini never sees or knows the brand. The frontend builds the shown suggestion by prepending the already-chosen brand client-side (`<brand> <garment description>`, e.g. "ZARA Linen Wrap Dress"). Requires a brand to already be selected before the chip is shown, since there's nothing to prepend to otherwise.

All three suggestions are shown as editable/overridable — never auto-committed. Staff can accept, edit, or type their own for any of them.

**Known trade-offs of starting free, accepted for now:**
- Free-tier prompts/images may be used by Google to improve their models. Acceptable short-term; revisit before this handles sensitive or high-volume data.
- Daily/per-minute quotas on the free tier are not fixed — Google adjusts them without notice and doesn't publish one universal number. Check the live quota in Google AI Studio for the actual current cap, don't trust a number quoted anywhere else, including earlier chats about this project.
- If daily quota is hit mid-use, uploads should fail gracefully (clear message to staff: "Image generation is temporarily unavailable, try again shortly") — not silently break the form or lose staff's uploaded photos.
- Moving to paid later is a small, contained change (swap the API call's billing context) — not a rebuild. Rough cost when that happens: ~$0.003/image, i.e. a few cents even at high volume.

**Not in scope for Gemini or any AI:** brand, category, sub-category, price, size ranges. All of that is manual, staff-entered, or pulled from the website's own admin config — never AI-generated.

---

## 4. Full Flow (single page, no wizard navigation)

Everything below happens on one page. Sections reveal in place as staff progresses.

### Step 1 — Photos & product card

Staff picks a mode at the top of the step:

**Mode A — "Shoot photos"**
- Front photo required, back photo optional. Both use `capture="environment"` so mobile opens the camera directly, not a gallery picker.
- Raw photos upload to Supabase Storage via a short-lived signed URL (same pattern as `receipts.js`), persisted as the variant's `raw_front_url` / `raw_back_url`.
- The **front** card is generated first, from the front photo alone. Once it's approved, and only then, the **back** card (if a back photo was taken) is generated from the back photo *plus* the approved front card as a reference — so the model, lighting and background match between the two. This is a hard dependency, not a UI nicety: `POST /api/admin/upload/generate-card` with `view: 'back'` is rejected without a `frontCardUrl` pointing at an already-generated card.
- **If the front card is regenerated after a back card already exists, the back card must be regenerated too** — it was generated to match the *previous* front card, and no longer matches once the front changes. The frontend enforces this (e.g. by discarding/flagging the stale back card when Regenerate is used on the front).
- Cards are shown side by side, each with its own **Regenerate**, plus a **Regenerate all** (front regenerates first, then back is re-run against the new front, per the rule above).
- `images[0]` (the approved front card) becomes **the** product card shown in the catalogue grid. The back card, if generated, is a gallery image shown when a customer opens the product.
- Nothing proceeds to Step 2 until the front card (and back card, if a back photo was taken) is approved.

**Mode B — "Use a card I already have"**
- For when staff already has a finished product-card image (a brand catalogue photo, an earlier shoot). Up to 3 plain file upload slots — first slot is the product card (required), the rest are optional gallery images.
- No camera constraint, no Gemini image generation, no regenerate loop — images are used exactly as supplied.
- Gemini still reads `images[0]` afterward to produce the name and colour suggestions in Step 2, same as Mode A.
- Since there's no raw camera photo in this mode, `raw_front_url` / `raw_back_url` stay `null` for that colour.
- **Provenance is tracked per image** (`ai-generated` vs `staff-supplied`) so it's visible later which cards were generated vs supplied — stored on the variant/image record (see §5).

The details form in Step 2 does **not** appear until images are approved/confirmed in either mode.

### Step 2 — Product details (only after Step 1 is done)

Field order is deliberate:

a. **Brand** — a searchable dropdown over the existing brand list, filtering as you type, with an option to add a brand not yet in the list.
b. **Product name** — Gemini suggests `<brand> <garment description from photo>` once a brand is chosen. Shown as a tappable suggestion chip above an editable text field. The chip is disabled/greyed until a brand is picked. Staff can accept it, edit it, or type their own — never auto-committed.
c. **Colour name** — Gemini suggests one from the photo, same chip pattern, same editability.
d. **Category → Sub-category** (dependent dropdown) **→ Price**. Per the launch scope note above, Category is fixed to Women for now — staff pick only the Sub-category.

**Dedup, replacing the old up-front search step:** there is no search step at the *front* of the flow — staff cannot search by product name before the product has a name; that was the flaw in the superseded design. Instead, once brand + name are set, the existing `GET /api/admin/upload/products?q=` endpoint is called in the background (debounced) and, if it finds a likely match, an inline warning appears under the name field showing the matching product(s) with a button: **"Add my colour to this product instead."** Choosing that locks brand/name/category/price to the existing product.

Saving a colour locks brand/name/category/price for the **whole product**. "+ Add another colour" returns to Step 1 (either mode) with those fields still locked — only new photos/card and a new colour name are needed.

### Step 3 — Stock per size

- Sizes come from the `SizeRange` configured for the chosen category + sub-category pair (`SizeRange` is keyed by both together, not sub-category alone — see §5a).
- Per colour, per size: show current quantity, an input for units received, and a live "before → after" readout.
- The number input **clears on focus** if it's showing the default 0 (rather than making staff delete a leading zero), **selects-all on focus** if it already has a value, and **reverts to 0 on blur** if left empty.
- Writes are **atomic increments**, never absolute overwrites (`quantity = quantity + $n`, on `variant_sizes`).

### Step 4 — Review & submit

- Shows brand, product name, category/sub-category, price, and — per colour — the image strip (product card first, provenance noted) plus the stock deltas for this session.
- **Approve & publish**, or **Discard**.
- The whole submit is wrapped in a **single transaction** — a partial failure must not leave orphaned products, variants, or images. This is the §11 risk, still a must-fix.

### Separate entry point — Restock

A collapsed bar above the form: **"Just adding more of something you already stock? → Find it to restock."** Expands to a search over existing products by name or brand.
- Picking an existing colour jumps **straight to Step 3** (stock) — no photos, no Gemini, nothing else.
- Picking **"+ new colour for this"** goes to Step 1 with the product fields pre-locked.

This is a **side door, not a gate** — it must never stand between staff and the camera. (This is the structural fix for the flaw in the superseded design, where search sat in front of everything.)

---

## 5. Data Model

### 5a. Current schema (as it exists today — `server/prisma/schema.prisma`)

```
Product (products)
  id, slug, name, brand (String — free text, no Brand table), price,
  section, status, categoryId (category_id, nullable),
  subcategoryId (subcategory_id, nullable), createdBy, createdAt

ProductImage (product_images)
  id, productId, url, sortOrder
  -- scoped to the PRODUCT, not to a variant/colour. No provenance column.

ProductVariant (product_variants)
  id, productId, colour, imageUrl (image_url, single AI-generated card image),
  rawFrontUrl, rawBackUrl (both nullable already), createdBy

VariantSize (variant_sizes)
  id, variantId, size, quantity (default 0), reservedQuantity (reserved_quantity, default 0),
  updatedBy, updatedAt
  -- CHECK constraints (migration 20260924121000_add_subcategories_and_size_ranges):
  --   variant_sizes_quantity_nonnegative        CHECK (quantity >= 0)
  --   variant_sizes_reserved_nonnegative        CHECK (reserved_quantity >= 0)
  --   variant_sizes_reserved_lte_quantity       CHECK (reserved_quantity <= quantity)

Subcategory (subcategories) / Category (categories) / SizeRange (size_ranges)
  -- SizeRange is keyed by (categoryId, subcategoryId) together, not subcategoryId alone.
```

**Brand today:** there is no `brands` table. `GET /api/admin/brands` (`server/src/routes/products.js`, service `getBrands` in `server/src/services/products.js`) derives the list by querying `prisma.product.findMany({ where: { status: 'published' }, distinct: ['brand'] })` and de-duplicating case-insensitively in application code. Brand is, and today remains, a plain string column on `Product` — not a foreign key.

**Images today:** a variant's product-card image is the single `ProductVariant.imageUrl` column. Additional images exist via `ProductImage`, but that model is scoped to `productId`, not `variantId` — it has no way to tie an image to a specific colour, and no `provenance` column at all.

**Write paths today:** `createProduct` accepts `{ slug, name, brand, categoryId, price, section }`; `updateProduct` accepts `{ name, brand, price, section, categoryId, status, variants }`. **Neither accepts `subcategoryId`** — this is the blocker already flagged in §11.

### 5b. Proposed changes — schema changes require owner approval before any migration is applied

**Each of these is a schema change under `AGENT_RULES.md`.** A migration may be *drafted* for review, but nothing here is applied until the owner gives explicit typed approval to run it.

**1. Brand — string column, or a `Brand` table?**
- *Keep `Product.brand` as a string* (no new table): zero migration, keeps `getBrands`'s existing distinct-query approach working as-is. Downside: the Step 2 "add a brand not yet in the list" action just becomes a new string value with no referential integrity — nothing stops two brands differing only by case/whitespace from both persisting if the dedup-on-read logic in `getBrands` is ever bypassed.
- *Add a `Brand` table with `Product.brandId`*: gives real referential integrity and an admin-manageable brand list independent of what happens to be published right now (today's `getBrands` only sees `status: 'published'` products, so an unpublished product's brand doesn't show up). Downside: a real migration, a backfill of existing `products.brand` values into rows, and a rewrite of `getBrands`, `createProduct`, and `updateProduct`.
- **Decided 2026-09-26: keep as text, normalise on save.** No `Brand` table, no schema change. On save, the brand string is trimmed, internal whitespace collapsed, and matched against existing brands case-insensitively — reusing the existing brand's exact spelling when found. This is application code (Step 2's brand field / the `createProduct`/`updateProduct` write path), not a migration.

**2. Multiple ordered images per colour, with provenance — extend `ProductImage`, or add a new table?**
- *Extend `ProductImage`*: add a nullable `variantId` (so it can point at a variant instead of, or in addition to, a product) plus a `provenance` column. Reuses an existing model and its `sortOrder` column. Downside: `ProductImage` is currently product-scoped everywhere it's read (storefront gallery, admin product editor); overloading it to also mean "per-variant" needs every existing read site checked so a null/wrong `variantId` doesn't silently show the wrong images.
- *Add a new `variant_images` table* (`id, variantId, url, sortOrder, provenance`): keeps `ProductImage` untouched and its existing behavior guaranteed unaffected. Downside: a second, near-identical image table with its own queries, and a decision needed on whether `ProductVariant.imageUrl` (today's single card-image column) is kept as a denormalized "sortOrder 0" convenience or dropped in favor of always reading from the new table.
- **Decided 2026-09-26: new `variant_images` table.** `ProductImage` is left untouched — existing products keep reading `ProductVariant.imageUrl` as-is; no backfill. Migration `server/prisma/migrations/20260926140000_add_variant_images/` applied 2026-09-26 (see that folder and the matching `VariantImage` model in `schema.prisma`).
- `raw_front_url` / `raw_back_url` need no schema change — both are already nullable on `ProductVariant` today, which already covers Mode B leaving them `null`.

**3. `subcategoryId` on `createProduct` / `updateProduct`** — the write functions need this field accepted and persisted; this is application-code work, not a schema change (the `subcategory_id` column already exists on `Product`), but it's listed here because Step 2 cannot function end-to-end without it. See §11 known blockers.

---

## 6. What gets written on Approve

| Scenario | `products` | `product_variants` | `variant_images` (§5b) | `variant_sizes` |
|---|---|---|---|---|
| Brand new product, first colour | INSERT (1 row) | INSERT (1 row) | INSERT (per image) | INSERT (per size, `quantity`) |
| New colour on an existing product | no write | INSERT (1 row) | INSERT (per image) | INSERT (per size, `quantity`) |
| Restock of an existing colour (side-door entry) | no write | no write | no write | UPDATE (`quantity` atomic increment, per size) |

**Dedup does not block saving:** the background dedup check in Step 2 (§4) surfaces a likely match, but staff can dismiss the warning and save anyway — it's advisory, not a gate. See §11 #4, which this must stay consistent with.

---

## 7. Hardcoded AI prompt (image generation)

Lives server-side only — never exposed to staff, never editable through the UI. This is what keeps every generated image visually consistent across the whole catalog. Used only in Mode A: once for the front photo, and again for the back photo (with the approved front card as a second reference image) if one was taken.

**The prompt text itself lives in `server/src/ai/prompts/card-front-women.txt` and `card-back-women.txt`** — owner-approved source text, loaded once at server start by `server/src/ai/cardPrompts.js`. That loader fails loudly at startup if either file is missing or empty, rather than letting the first real request 500. Model name, aspect ratio and output format are pinned in one config object next to the loader, not in the prompt files.

**To change the look of generated cards: edit the relevant `.txt` file and restart the server.** Do not paste the prompt text into this doc, code comments, or anywhere else — the two `.txt` files are the single source of truth, and keeping a second copy anywhere just invites the copies to drift apart.

Women's apparel only for now (§3 scope note) — a men's/kids' prompt pair, when added, would be new files alongside these, not edits to them.

---

## 8. Connecting to the website admin (brand / category / sub-category / size ranges)

The upload form must never hardcode these — they come live from wherever the website's own admin panel manages them.

- `GET /api/admin/brands` → the current brand list (for the Step 2 searchable dropdown)
- `GET /api/admin/categories` → the fixed list (Men / Women / Kids, or whatever admin has configured)
- `GET /api/admin/subcategories?category=Men` → sub-categories under that category
- `GET /api/admin/size-ranges?category=<id>&subcategory=<id>` → the size list for that category+sub-category pair (`SizeRange` is keyed by both together — §5a)
- `GET /api/admin/upload/products?q=` → background dedup search, called debounced after brand+name are set (§4) — **not** an up-front search step

**Build note for whoever picks this up (Claude Code or a developer):** if these endpoints or their backing tables don't exist yet, creating them is a schema change and goes through the standard approval process first. Cache these lookups client-side per session (they don't change mid-session) to avoid refetching on every colour block — see §9.

---

## 9. Performance — keep the page light

1. **Resize/compress photos client-side before upload** (canvas resize to ~1200px wide) — cuts upload size dramatically with no visible quality loss for this use case.
2. **Cache admin lookups (brands, sub-categories, size ranges) per session** — fetch once per selection, not per colour block.
3. **Debounce the background dedup query** in Step 2 — it fires on brand+name changes, not on every keystroke.
4. **Keep the build lightweight** — this is a staff-only internal tool, not a marketing page; a heavy frontend framework isn't needed.
5. **Serve generated + uploaded images as compressed WebP**, not raw PNG, in both Storage and the storefront.

---

## 10. Security checklist

This writes directly into a production database with no backups — these are not optional hardening ideas, they're baseline requirements before this goes live.

1. **Staff login required** on `/upload` — never a public URL. Every upload maps to a specific staff account (also gives the audit trail flagged in §11).
2. **Server-side re-validation of brand/category/sub-category/size** against the admin's current live lists — never trust whatever the client submitted, even from a `<select>`, since a bypassed or buggy client can submit anything.
3. **Signed, short-lived upload URLs** for Supabase Storage — the browser never holds a long-lived storage key.
4. **Server-side file validation** — actual file type check (not just extension), max file size enforced, to block disguised or oversized uploads. Applies to both the Mode A raw camera photo and the Mode B supplied card/gallery files.
5. **Rate-limit the Gemini-calling endpoints per staff account** — protects the (soon-to-be-paid) API budget from a bug or compromised account burning through it via a retry loop. Applies to all three Gemini uses in §3, not just image generation.
6. **DB-level constraint preventing negative stock** — already exists: `variant_sizes_quantity_nonnegative CHECK (quantity >= 0)` (and the paired `reserved_quantity` checks, §5a) — not just a UI check.
7. **Atomic DB writes for every stock change** — the single highest-priority item on this list, since a race condition here can silently corrupt data with no backup to recover from.
8. **API keys (Gemini, Supabase service role) live only in backend environment variables** — never shipped to the browser or committed to the repo.
9. **HTTPS everywhere**; `/upload` marked `noindex` and not linked from the public site.

---

## 11. Known Risks / Must-Resolve Before Launch

Two are flagged as **must-fix before going live**, not later polish — because they either risk corrupting data with no backup, or allow unauthorized writes:

1. **Race conditions on stock** — *(must-fix)* atomic increment/decrement at the DB level, always; never read-then-write in app code.
2. **Partial failures mid-flow** — *(must-fix)* e.g. AI image generates but the DB insert fails right after, leaving an orphaned Storage file or a `products` row with no variant. Wrap final writes in a DB transaction; treat uploads as "pending" until the full write succeeds.
3. **Access control** — *(must-fix)* `/upload` must require staff login; enforce on every request, not just the page load.
4. **Duplicate detection relies on staff diligence** — the background dedup warning in Step 2 helps, but it only fires after brand+name are set; a staff member who ignores the warning and saves anyway still creates a duplicate.
5. **No audit trail yet** — `created_by` / `updated_by` / timestamps, or an activity log table, given there's no backup to fall back on if something goes wrong.
6. **Discard doesn't yet guarantee storage cleanup** — rejected/abandoned uploads may leave orphaned files in Supabase Storage; needs an explicit delete-on-discard or a periodic cleanup job.
7. **No edit path for already-live products** — flow covers create + restock, not fixing a typo or wrong field after approval. Decide whether that happens via this same form or the website admin directly.
8. **Price changes not covered** — price is set once at creation; no defined path for updating it later.
9. **Out-of-stock behavior undefined** — when a size hits 0 everywhere, does the storefront auto-hide/disable it, or does it need a manual step?
10. **Image quality isn't checked before the AI call** — a blurry or wrong photo still triggers an API call before a human catches the problem (Mode A only). A quick "does this look right?" moment before generation could save wasted calls once on the paid tier.
11. **Product lifecycle when fully out of stock everywhere** — undefined whether it disappears, shows "out of stock," or needs manual archiving.
12. **Variant/size deletion can orphan a reservation** — deferred fix, documented separately in the commit history; not yet resolved by this flow.

### Known blockers (current, as of this rewrite)

These block real end-to-end testing today, independent of the flow design above:

- **`GEMINI_API_KEY` is not yet present** — none of the three Gemini calls in §3 can run until this is set.
- **`size_ranges` table has 0 rows** — Step 3 cannot function for any sub-category until real size ranges are seeded.
- **`subcategoryId` is not yet an accepted field on `createProduct`/`updateProduct`** — the Step 2 category→sub-category→price write path needs this added before Step 2 can persist correctly.

---

## 12. Sequencing

**Phase 1:** Clear the known blockers above — seed `size_ranges`, add `GEMINI_API_KEY`, accept `subcategoryId` on `createProduct`/`updateProduct`.
**Phase 2:** Build the endpoints in §8, get any schema additions (§5) approved and applied via `npm run db:apply`, then build the upload form per §4 (Step 1 both modes → Step 2 → Step 3 → Step 4 → Review).
**Phase 3:** Resolve the must-fix items in §11 (#1, #2, #3) before any real product data goes through it.
**Phase 4:** Test end-to-end with real products — new product (Mode A), new product (Mode B), new colour on existing, restock via the side-door entry point — before retiring any manual upload process.
**Phase 5:** Revisit remaining §11 risks (audit trail, edit path, price changes, out-of-stock behavior) and the Gemini free→paid decision, once the form is in daily use.

This document is the current reference for the build — supersedes both the earlier Telegram-bot version and the search-first one-page version of this spec.
