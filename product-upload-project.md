# Product Upload — Project Spec
**Project:** Mary Website / Genvio
**Status:** Ready to start building
**Interface:** Website form at `website.com/upload` — staff-only, behind login. (Originally scoped as a Telegram bot; moved to a web form because Telegram has no real form UI — no dropdowns, no multi-field grids — and everything we needed kept fighting that constraint. Live camera capture, the reason Telegram was attractive, works fine in a mobile browser via `capture="environment"`, so nothing was actually lost in the move.)

**Non-negotiable:** All schema-changing DB work on this feature falls under `AGENT_RULES.md` at the project root. No Prisma migration commands without explicit typed approval from the owner — every time, no exceptions. This applies to every new table below (`product_variants`, `variant_sizes`, and anything else this feature needs).

---

## 1. Goal

Let staff create and restock products from one page: search first to avoid duplicates, photograph the item (one photo is enough, a second is optional), get an AI-generated product-card image and an AI-suggested color name (both editable/overridable), fill in category/sub-category/price manually (once per product, not per color), enter stock per size, and publish — with every step validated so bad data can't reach a database that has no backups.

---

## 2. Interface & Architecture

```
Website Admin (source of truth)
  ├─ Categories / Sub-categories
  └─ Size ranges per category + sub-category
         │
         ▼  (read-only internal API — not hardcoded in the upload form)
Upload Form  —  website.com/upload  (staff-only, behind login)
  ├─ Search/match against `products` (dedup happens before any write)
  ├─ Fetches sub-categories + size ranges live from the admin API
  ├─ Calls Gemini → generates product-card image (hardcoded prompt, see §5)
  ├─ Calls Gemini → suggests a color name from the photo (staff can override)
  ├─ Uploads photos + generated image to Supabase Storage
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
- One-page web form prototype: `https://claude.ai/artifact/LxweWFNPhM39GZekPx8wpE` — reflects the current flow below and is the reference for what the real build should feel like. No real Gemini/Supabase calls — UI and logic only.

---

## 3. AI provider: Gemini, free tier for now

**Decision:** Start on Gemini's free tier. Used for exactly two things — nothing else:
1. Generating the product-card image from the uploaded photo(s)
2. Suggesting a color name from the photo

**Known trade-offs of starting free, accepted for now:**
- Free-tier prompts/images may be used by Google to improve their models. Acceptable short-term; revisit before this handles sensitive or high-volume data.
- Daily/per-minute quotas on the free tier are not fixed — Google adjusts them without notice and doesn't publish one universal number. Check the live quota in Google AI Studio for the actual current cap, don't trust a number quoted anywhere else, including earlier chats about this project.
- If daily quota is hit mid-use, uploads should fail gracefully (clear message to staff: "Image generation is temporarily unavailable, try again shortly") — not silently break the form or lose staff's uploaded photos.
- Moving to paid later is a small, contained change (swap the API call's billing context) — not a rebuild. Rough cost when that happens: ~$0.003/image, i.e. a few cents even at high volume.

**Not in scope for Gemini or any AI:** category, sub-category, price, size ranges, product name. All of that is manual, staff-entered, or pulled from the website's own admin config — never AI-generated.

---

## 4. Full Flow (single page, no navigation between steps)

Everything below happens on one continuously scrolling page. Sections reveal in place as staff progresses; nothing is torn down or replaced — staff can scroll back up and still see earlier choices.

### Step 1 — Search (always first, for every session)
- Staff types a product name into a live search box.
- Search matches against `products.name` (fuzzy/partial — e.g. Postgres `pg_trgm` for typo tolerance).
- Matches shown as clickable results; always includes a "None of these — new product" option.
- No match at all → explicit "confirm this is a brand new product" step, never assumed.
- **This step is what prevents duplicate product rows** — it runs before anything else, every time, whether staff is creating something new or restocking.

### Step 2 — Product details (new products only, asked exactly once)
- If new: Category (Men / Women / Kids) → Sub-category (dropdown, values fetched live from the website admin — never hardcoded) → Price.
- Confirmed once, then **locked** — never re-asked for this product, including when staff adds more colors later in the same or a future session.
- If existing product matched in Step 1: this step is skipped entirely; fields already exist on the row.

### Step 3 — Color (repeatable — one block per color, all on the same page)
For an **existing product**, staff sees:
- A list of existing colors, each clickable to restock it directly (skips photo capture — goes straight to Step 5)
- A "+ Add new color" option, which goes through the full photo→image→name sequence below

For a **new product** (or a new color on an existing one):
1. **Photo capture** — front photo, back photo **optional**. At least one required. Both use the device's live camera on mobile (`capture="environment"`), not just a gallery picker.
2. **AI card image generated** from whichever photo(s) were provided → shown with **Approve / Regenerate** buttons. Regenerate re-runs generation on the same photos, no retake needed.
3. **AI color-name suggestion** shown as a clickable box — tapping it uses that name directly. A separate text field lets staff type their own instead. Neither is forced; either path is one action.

Staff can add as many color blocks as needed in one sitting — each new block appends below the previous one, on the same page.

### Step 4 — Stock per size (per color block)
- Size range for the grid is **fetched live from the website admin**, keyed by this product's category + sub-category — never a hardcoded list. If no range is configured yet for that combination, the form stops and tells staff to configure it in admin first, rather than guessing.
- Staff enters units **received** per size — this **adds** to existing stock, it does not replace/overwrite it. A visible before → after line is shown per size before confirming (protects against staff miscounting or forgetting reserved/in-cart stock).
- Confirmed stock write is an **atomic DB increment** (`stock_count = stock_count + $n`), not a read-then-write in application code — this prevents two simultaneous restocks, or a restock overlapping a live sale, from silently overwriting each other.

### Step 5 — Review & submit
- Shows the product's shared fields (or "existing product — unchanged" if matched) and every color block completed this session, with its image and final stock breakdown.
- **Approve** → commits all writes (see §6 for exactly what gets written).
- **Discard** → nothing is written; any uploaded originals for this session should be cleaned up from Storage, not left orphaned.

---

## 5. Data Model

```
products
  id, name, category, subcategory, price

product_variants
  id, product_id, color_name, image_url (AI-generated, used on the storefront card),
  raw_front_url, raw_back_url (real photos — used in the product detail gallery, per
  the decision that customers should see the actual item, not just the AI rendering)

variant_sizes
  id, variant_id, size, stock_count
```

Adding these three tables (if not already present) is a schema change — governed by AGENT_RULES.md: show the exact command, take a before row-count baseline, get explicit approval, before running anything.

**On the AI image vs. real photo split (confirmed decision):** the generated image is card-only. Clicking into a product on the storefront shows the real front/back photos. Every variant row must end up with both — a variant missing either breaks that experience.

---

## 6. What gets written on Approve

| Scenario | `products` | `product_variants` | `variant_sizes` |
|---|---|---|---|
| Brand new product, first color | INSERT (1 row) | INSERT (1 row) | INSERT (per size) |
| New color on an existing product | no write | INSERT (1 row) | INSERT (per size) |
| Restock of an existing color | no write | no write | UPDATE (atomic increment, per size) |

**No duplicate `products` row is ever created** — matching in Step 1 happens before any data is written, not after.

---

## 7. Hardcoded AI prompt (image generation)

Lives server-side only — never exposed to staff, never editable through the UI. This is what keeps every generated image visually consistent across the whole catalog.

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

## 8. Connecting to the website admin (category / sub-category / size ranges)

The upload form must never hardcode these — they come live from wherever the website's own admin panel manages them.

- `GET /api/admin/categories` → the fixed list (Men / Women / Kids, or whatever admin has configured)
- `GET /api/admin/subcategories?category=Men` → sub-categories under that category
- `GET /api/admin/size-ranges?category=Men&subcategory=Trousers` → the size list for that combination

**Build note for whoever picks this up (Claude Code or a developer):** if these endpoints or their backing tables don't exist yet, creating them is a schema change and goes through the standard approval process first. Cache these lookups client-side per session (they don't change mid-session) to avoid refetching on every color block — see §9.

---

## 9. Performance — keep the page light

1. **Resize/compress photos client-side before upload** (canvas resize to ~1200px wide) — cuts upload size dramatically with no visible quality loss for this use case.
2. **Cache admin lookups (sub-categories, size ranges) per session** — fetch once per category selection, not per color block.
3. **Search-as-you-type queries the DB directly, not the whole catalog on page load.**
4. **Keep the build lightweight** — this is a staff-only internal tool, not a marketing page; a heavy frontend framework isn't needed.
5. **Serve generated + uploaded images as compressed WebP**, not raw PNG, in both Storage and the storefront.

---

## 10. Security checklist

This writes directly into a production database with no backups — these are not optional hardening ideas, they're baseline requirements before this goes live.

1. **Staff login required** on `/upload` — never a public URL. Every upload maps to a specific staff account (also gives the audit trail flagged in §11).
2. **Server-side re-validation of category/sub-category/size** against the admin's current live lists — never trust whatever the client submitted, even from a `<select>`, since a bypassed or buggy client can submit anything.
3. **Signed, short-lived upload URLs** for Supabase Storage — the browser never holds a long-lived storage key.
4. **Server-side file validation** — actual file type check (not just extension), max file size enforced, to block disguised or oversized uploads.
5. **Rate-limit the Gemini-calling endpoint per staff account** — protects the (soon-to-be-paid) API budget from a bug or compromised account burning through it via a retry loop.
6. **DB-level constraint preventing negative stock** (`CHECK (stock_count >= 0)`), not just a UI check.
7. **Atomic DB writes for every stock change** — the single highest-priority item on this list, since a race condition here can silently corrupt data with no backup to recover from.
8. **API keys (Gemini, Supabase service role) live only in backend environment variables** — never shipped to the browser or committed to the repo.
9. **HTTPS everywhere**; `/upload` marked `noindex` and not linked from the public site.

---

## 11. Known Risks / Must-Resolve Before Launch

Two are flagged as **must-fix before going live**, not later polish — because they either risk corrupting data with no backup, or allow unauthorized writes:

1. **Race conditions on stock** — *(must-fix)* atomic increment/decrement at the DB level, always; never read-then-write in app code.
2. **Partial failures mid-flow** — *(must-fix)* e.g. AI image generates but the DB insert fails right after, leaving an orphaned Storage file or a `products` row with no variant. Wrap final writes in a DB transaction; treat uploads as "pending" until the full write succeeds.
3. **Access control** — *(must-fix)* `/upload` must require staff login; enforce on every request, not just the page load.
4. **Duplicate detection relies on staff diligence** — search-as-you-type helps, but a fuzzy-match warning even on the "new product" path ("Similar product found: X — same item?") adds a second layer.
5. **No audit trail yet** — `created_by` / `updated_by` / timestamps, or an activity log table, given there's no backup to fall back on if something goes wrong.
6. **Discard doesn't yet guarantee storage cleanup** — rejected/abandoned uploads may leave orphaned files in Supabase Storage; needs an explicit delete-on-discard or a periodic cleanup job.
7. **No edit path for already-live products** — flow covers create + restock, not fixing a typo or wrong field after approval. Decide whether that happens via this same form or the website admin directly.
8. **Price changes not covered** — price is set once at creation; no defined path for updating it later.
9. **Out-of-stock behavior undefined** — when a size hits 0 everywhere, does the storefront auto-hide/disable it, or does it need a manual step?
10. **Image quality isn't checked before the AI call** — a blurry or wrong photo still triggers an API call before a human catches the problem. A quick "does this look right?" moment before generation could save wasted calls once on the paid tier.
11. **Product lifecycle when fully out of stock everywhere** — undefined whether it disappears, shows "out of stock," or needs manual archiving.

---

## 12. Sequencing

**Phase 1:** Confirm the admin-side prerequisites exist (or get built first): category/sub-category management, and a size-range config per category+subcategory. This feature depends on both.
**Phase 2:** Build the endpoints in §8, get any schema additions (§5) approved and applied via `npm run db:apply`, then build the upload form per §4.
**Phase 3:** Resolve the must-fix items in §11 (#1, #2, #3) before any real product data goes through it.
**Phase 4:** Test end-to-end with real products — new product, new color on existing, restock of existing color — before retiring any manual upload process.
**Phase 5:** Revisit remaining §11 risks (audit trail, edit path, price changes, out-of-stock behavior) and the Gemini free→paid decision, once the form is in daily use.

This document is the current reference for the build — supersedes the earlier Telegram-bot version of this spec.
