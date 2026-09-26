# Product Upload — Project Spec
**Project:** Mary Website / Genvio
**Status:** Approved flow below — ready to build
**Interface:** Website form at `website.com/upload` — staff-only, behind login, **one page, no wizard navigation**. (Originally scoped as a Telegram bot; moved to a web form because Telegram has no real form UI — no dropdowns, no multi-field grids — and everything we needed kept fighting that constraint. Live camera capture, the reason Telegram was attractive, works fine in a mobile browser via `capture="environment"`, so nothing was actually lost in the move.)

**Non-negotiable:** All schema-changing DB work on this feature falls under `AGENT_RULES.md` at the project root. No Prisma migration commands without explicit typed approval from the owner — every time, no exceptions. This applies to every new table below (`product_variants`, `variant_sizes`, and anything else this feature needs).

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

**Decision:** Start on Gemini's free tier. Used for exactly **three** things — nothing else:
1. **Product-card image generation** — Mode A only ("Shoot photos"); skipped entirely in Mode B ("Use a card I already have"). One generation call per uploaded photo (1 photo in → 1 card out, 2 photos in → 2 cards out).
2. **Colour-name suggestion** — from `image[0]`, in either mode.
3. **Product-name suggestion** — from `image[0]` + the chosen brand, in either mode (e.g. "ZARA Linen Wrap Dress"). Requires a brand to already be selected, since the suggestion is templated as `<brand> <garment description>`.

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
- "Generate product cards" runs **one Gemini image generation per uploaded photo** — 1 photo in → 1 card out, 2 photos in → 2 cards out. Cards are shown side by side, each with its own **Regenerate**, plus a **Regenerate all**.
- `images[0]` (generated from the front photo) becomes **the** product card shown in the catalogue grid. Any further generated image is a gallery image shown when a customer opens the product, in the order produced.
- Nothing proceeds to Step 2 until cards are approved.

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
d. **Category → Sub-category** (dependent dropdown) **→ Price**.

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

### 5b. Proposed changes — NOT approved, NOT applied

Nothing below has an owner sign-off. **Each of these is a schema change under `AGENT_RULES.md` and requires explicit owner approval before any migration is written** — no Prisma command runs off the back of this document alone.

**1. Brand — string column, or a `Brand` table?**
- *Keep `Product.brand` as a string* (no new table): zero migration, keeps `getBrands`'s existing distinct-query approach working as-is. Downside: the Step 2 "add a brand not yet in the list" action just becomes a new string value with no referential integrity — nothing stops two brands differing only by case/whitespace from both persisting if the dedup-on-read logic in `getBrands` is ever bypassed.
- *Add a `Brand` table with `Product.brandId`*: gives real referential integrity and an admin-manageable brand list independent of what happens to be published right now (today's `getBrands` only sees `status: 'published'` products, so an unpublished product's brand doesn't show up). Downside: a real migration, a backfill of existing `products.brand` values into rows, and a rewrite of `getBrands`, `createProduct`, and `updateProduct`.
- Not decided here — flagging both options for the owner.

**2. Multiple ordered images per colour, with provenance — extend `ProductImage`, or add a new table?**
- *Extend `ProductImage`*: add a nullable `variantId` (so it can point at a variant instead of, or in addition to, a product) plus a `provenance` column. Reuses an existing model and its `sortOrder` column. Downside: `ProductImage` is currently product-scoped everywhere it's read (storefront gallery, admin product editor); overloading it to also mean "per-variant" needs every existing read site checked so a null/wrong `variantId` doesn't silently show the wrong images.
- *Add a new `variant_images` table* (`id, variantId, url, sortOrder, provenance`): keeps `ProductImage` untouched and its existing behavior guaranteed unaffected. Downside: a second, near-identical image table with its own queries, and a decision needed on whether `ProductVariant.imageUrl` (today's single card-image column) is kept as a denormalized "sortOrder 0" convenience or dropped in favor of always reading from the new table.
- Either option needs `provenance: 'ai-generated' | 'staff-supplied'`, since Step 1's Mode A and Mode B can now produce images for the same product's colour history. Not decided here — flagging both options for the owner.
- `raw_front_url` / `raw_back_url` need no schema change — both are already nullable on `ProductVariant` today, which already covers Mode B leaving them `null`.

**3. `subcategoryId` on `createProduct` / `updateProduct`** — the write functions need this field accepted and persisted; this is application-code work, not a schema change (the `subcategory_id` column already exists on `Product`), but it's listed here because Step 2 cannot function end-to-end without it. See §11 known blockers.

---

## 6. What gets written on Approve

| Scenario | `products` | `product_variants` | images (§5b, table TBD) | `variant_sizes` |
|---|---|---|---|---|
| Brand new product, first colour | INSERT (1 row) | INSERT (1 row) | INSERT (per image) | INSERT (per size, `quantity`) |
| New colour on an existing product | no write | INSERT (1 row) | INSERT (per image) | INSERT (per size, `quantity`) |
| Restock of an existing colour (side-door entry) | no write | no write | no write | UPDATE (`quantity` atomic increment, per size) |

**Dedup does not block saving:** the background dedup check in Step 2 (§4) surfaces a likely match, but staff can dismiss the warning and save anyway — it's advisory, not a gate. See §11 #4, which this must stay consistent with.

---

## 7. Hardcoded AI prompt (image generation)

Lives server-side only — never exposed to staff, never editable through the UI. This is what keeps every generated image visually consistent across the whole catalog. Used only in Mode A, once per uploaded photo.

```javascript
// server-side only
const CARD_IMAGE_PROMPT = `
You are generating a product-card photo for an e-commerce clothing store.
Using the uploaded garment photo(s) as reference, generate a photorealistic
image of the SAME garment worn by a neutral studio model.

Rules — do not deviate:
- Preserve the garment's exact color, fabric texture, fit, and any visible
  logos or stitching from the source photo(s).
- Studio background: plain, light neutral grey (#f2f0eb).
- Lighting: soft, even, front-facing — no harsh shadows.
- Model: front-facing, neutral pose, face not the focus, cropped at
  chest-to-thigh unless the garment requires full length.
- Do not add accessories, jewelry, or props not present in the source photo.
- Output must look like a professional retail product photo, not an
  illustration or stylized render.
`;
```

A store-wide style change (e.g. different background color) is a one-line edit here, deployed once — never something staff touches per-product.

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
