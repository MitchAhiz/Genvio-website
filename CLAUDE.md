# CLAUDE.md — Women's Fashion B2B Catalogue & Ordering App

This file is the project's north star for Claude Code. Read it before making
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

| Route | Purpose |
|---|---|
| `/` | Catalogue homepage |
| `/product/:slug` | Product detail (real, shareable URL, e.g. `/product/satin-midi-dress`) |
| `/bag` | Shopping bag |

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
Order" action. No checkout flow — order submission should be decoupled
from any single channel (WhatsApp, email, API, CRM) so the target can
change without rearchitecting the bag UI.

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

- Accounts / authentication
- Payment gateway / checkout
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
