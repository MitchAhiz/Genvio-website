# AGENTS.md — Women's Fashion B2B Catalogue & Ordering App

This file is the project's north star for Codex. Read it before making
structural, architectural, or scope decisions. When in doubt, prefer the
simplest implementation that satisfies the requirements below.

---

## 1. What This Is

A **premium, mobile-first women's fashion catalogue + lightweight B2B
ordering web app**. Not a full ecommerce platform.

Customer journey:

```
Catalogue Link → Browse → Search/Filter → Product Card → Product Detail
→ Choose Colour → Choose Size → Set Quantity → Add to Bag
→ Continue Shopping → Bag → Review → Send Order
```

**Core loop: Browse → Select → Bag → Order.** Nothing more for V1.

## 2. Product Feel (non-negotiable)

- Feels like: a premium fashion editorial/catalogue + wholesale order pad.
- Does NOT feel like: a Shopify clone, SaaS dashboard, corporate inventory
  system, overly animated fashion site, or a stereotypical "pink boutique."
- Photography is the visual focus. The UI gets out of the way.
- Visual hierarchy: **Photography → Product → Price → Action.**

**Palette:** warm off-white, cream, muted blush, dusty rose, soft neutrals,
dark brown/charcoal type. Subtle borders, restrained shadows. No heavy pink.

**Typography:** editorial headings, clean readable body text, small
metadata type. Minimal font families, performance-conscious loading.

**Buttons:** "🛍 Add to Bag" (never "Add to Cart"). Tactile, light, subtle
hover/press/translate/shadow — not dramatic animation.

**Animation:** CSS transitions/transform/opacity only. Used for drawer
opens, image transitions, bag updates, filter panels. No WebGL, canvas,
scroll-jacking, parallax, animated gradients, or heavy blur.

## 3. Tech Stack

- React + Vite + Tailwind CSS + React Router
- No dependency without a clear technical reason — don't add libraries
  because they're popular.
- State: local component state by default. Only reach for a global store
  (e.g. Context, Zustand) if state genuinely needs to be shared broadly
  (bag contents, active drawer). Avoid Redux-style ceremony.

### Suggested structure

```
src/
├── components/   # reusable presentational + interactive pieces
├── pages/        # route-level views
├── layouts/       
├── data/         # local/mock product data (pre-API)
├── api/          # getProducts(), getProductBySlug(), getCategories(), getInventory()
├── hooks/
├── utils/
├── assets/
└── routes/
```

## 4. Routes

The site is a multi-section platform: a landing page with two doors, a retail
**Shop** in three sections (Men / Women / Kids — own catalogue and colour theme
each, one shared bag), and an image-only **Wholesale** lookbook.

| Route | Purpose |
|---|---|
| `/` | Landing page — "Shop" and "Wholesale" entry points |
| `/shop` | Redirects to the last visited section (Men by default) |
| `/shop/:section` | Section catalogue (`men` \| `women` \| `kids`, in that order everywhere) |
| `/shop/:section/product/:slug` | Product detail within a section (real, shareable URL) |
| `/shop/bag` | Shared shopping bag across all sections |
| `/wholesale` | Image-only lookbook for trade buyers — no cart, no product pages |
| `/admin` | Internal admin (OTP login) |
| `/product/:slug`, `/bag` | Legacy links — redirect into `/shop/…` |

A persistent Men / Women / Kids switcher sits in the sticky retail header on
every `/shop/*` route and never appears on the landing, wholesale, or admin pages.
Themes are `data-theme` attributes on `<html>` driven by the route — see
`DESIGN.md` for the token system and `src/index.css` for the palettes.

Product detail should behave like a full-screen drawer/modal for smooth
UX, but must still be a real, directly-navigable route (shareable via
WhatsApp, bookmarkable, SEO-ready later). Closing it should return the
customer to their prior catalogue scroll position.

## 5. Data Model

Products and variants are **separate concepts**. A product has colour
variants; each variant has a per-size quantity map. Never treat every
colour/size combo as an independent product.

```js
{
  id: "dress-001",
  name: "Satin Midi Dress",
  slug: "satin-midi-dress",
  brand: "Zara",
  category: "Dresses",
  section: "women",          // "women" | "men" | "kids"
  price: 32500,
  images: ["...", "...", "..."],
  variants: [
    {
      colour: "Burgundy",
      image: "...",
      sizes: { XS: 2, S: 5, M: 8, L: 3, XL: 1 }
    },
    {
      colour: "Black",
      image: "...",
      sizes: { XS: 0, S: 4, M: 7, L: 2, XL: 0 }
    }
  ]
}
```

Understand data as: **Product → Colour → Size → Available Quantity.**

Sizes are a free key→quantity map, so Kids products use age labels
(`"2-3Y": 4, "4-5Y": 6`) with no schema change. Wholesale images are a separate
table (`wholesale_images`: url, caption?, category?, sort order) with no link to
products.

### Data access layer

All product data must flow through abstracted functions, never fetched
ad-hoc inside components:

```js
getProducts()
getProductBySlug(slug)
getCategories()
getInventory()
```

This keeps the frontend swappable for a real API later without a rewrite.
Inventory logic (stock counts, availability) lives in the data/API layer —
**never hardcode inventory math inside UI components.**

## 6. Key Screens & Behaviour

### Homepage / Catalogue
Minimal nav: logo, search, bag count. Category pills (New Arrivals,
Dresses, Tops, Trousers, etc. — data-driven, not hardcoded per component).
Product grid below.

### Product Card
Image (clickable), name, brand, price, a **concise** variant summary
(e.g. "4 colours · XS–XL") — never a full size/inventory matrix on the
card. Quick "Add to Bag."

### Quick Add
- No variants needed → Add to Bag adds immediately.
- Variants exist → opens a lightweight colour/size/quantity selector
  without a full page navigation.

### Product Detail
Full product identity, multi-image gallery (swipe on mobile, arrows on
desktop, counter, lazy-loaded beyond the first image), colour selector
with variant-specific imagery, full size/quantity breakdown per selected
colour, and B2B-style multi-size quantity selection (e.g. select 2 XS + 5
S + 8 M in one add) with a running total.

### Image Viewer
Fullscreen/near-fullscreen on tap. Swipe (mobile), arrow keys (desktop),
Escape to close, image counter/dots. First image loads immediately;
rest lazy-load. Never eagerly load all images at once.

### Bag
List of line items (product, colour, size, qty, unit price), quantity
edit, remove, running total, item count in nav (`🛍 Bag (8)`), "Send
Order" action. The bag persists to localStorage and is shared across all
three retail sections.

### Checkout
"Send Order" opens a four-step overlay — bottom sheet on mobile, centred
modal on desktop — not separate pages: **Details → Summary → Payment →
Done**, sliding horizontally within one sheet.

- Customers are identified by **phone number only**. No accounts, no
  passwords, no sessions. `GET /api/customers/lookup` returns
  `{ exists, hasSavedDetails }` and nothing else: no name, no address, no
  history. A known number with nothing saved earns a "Welcome back! 👋"
  greeting and nothing more.
- **Saved details are opt-in and unlocked by a 4-digit PIN.** After an
  order, a customer may save their name and address behind a PIN
  (bcrypt, cost 10; the hash is never returned by any endpoint). On a
  later order, entering that PIN fills the fields in.
  `POST /api/customers/verify-pin` is the **only** route that returns
  saved personal data, and only in exchange for the right PIN — 3 wrong
  tries lock the auto-fill for that session (never permanently), and it
  is rate-limited 10 per 10 minutes **per phone number**, not per caller.
- Saving or declining requires the **order reference** as proof the
  caller placed that order, so knowing a phone number alone can never set
  or overwrite someone else's PIN.
- Declining sets `save_opted_out`, and the prompt stops asking; a quiet
  "Save details for next time" link remains for anyone who changes their
  mind. Typing details by hand is always available and never penalised.
- No email is collected at checkout — it isn't needed for delivery.
- Payment is **bank transfer**. Account details come from `GET
  /api/config/payment`, backed by the `BANK_NAME` /
  `BANK_ACCOUNT_NUMBER` / `BANK_ACCOUNT_NAME` env vars — never hardcoded,
  so the client can change them without a deploy.
- Submitting creates an order with an auto-generated reference
  (`GEA-YYYYMMDD-NNN`) and status `pending_payment`, and upserts the
  customer record so the admin can group orders by customer. That record
  is written, never read back to the frontend.
- The confirmation step shows the **delivery details for logistics**
  (name + address) with an Edit button, labelled so the customer knows
  that is exactly what the courier will see.
- Admin verifies payment and moves status along in the Orders tab:
  pending_payment → confirmed → processing → shipped → delivered.

### Search & Filter & Sort
- Search: name/brand/category, client-side if data is local — avoid a
  network call per keystroke.
- Filters: brand, colour, size, price, availability. Bottom-sheet on
  mobile, compact bar/panel on desktop — not a heavy ecommerce sidebar.
- Sort: Newest / Price ↑ / Price ↓ / Name. Nothing more elaborate.

## 7. Performance

- Responsive, compressed images (WebP/AVIF where supported), lazy loading,
  progressive loading. Never ship full-res originals to the browser.
- Small JS bundle; scrutinize every dependency.
- Animate only `transform`/`opacity`.
- Natural browser scrolling — no scroll-jacking or expensive scroll
  listeners.

## 8. Accessibility

Semantic HTML, real `<button>`s (not clickable divs), labeled controls,
visible focus states, sufficient contrast, image alt text, Escape-to-close
and proper dialog semantics for modals/drawers, touch-friendly targets.

## 9. Explicitly Out of Scope for V1

Do not build unless separately requested:

- Customer accounts / authentication (the checkout is phone-number
  lookup only — deliberately no passwords, tokens or sessions)
- Payment gateway / card processing (payment is bank transfer, verified
  by hand in the admin Orders tab)
- Coupons, reviews, wishlist, loyalty
- Shipping engine
- Customer dashboard
- Admin panel / CMS
- Recommendation engine
- Complex analytics dashboard

## 10. Engineering Guardrails

- No monolithic components; no duplicate logic; reusable components.
- Keep data/business logic out of presentation components.
- No product-specific hardcoded UI branches.
- Keep the API/data layer swappable — components consume `getX()` calls,
  not raw fetches.
- **Do not over-engineer.** Don't build infrastructure for hypothetical
  future needs. Simplest implementation that meets the spec wins.

## 11. Definition of Done (V1)

A customer on a mobile phone can: open the catalogue link → see products
fast → search/find one → open it → view and swipe multiple images →
choose a colour → see size availability → select quantity/size breakdown
→ add to bag → keep browsing → review multiple items → send the order —
while the app stays **fast, beautiful, lightweight, responsive,
maintainable, and API-ready.**
