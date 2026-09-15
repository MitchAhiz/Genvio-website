# PRODUCT.md — Genvio Exotic Apparel

## What it is
A premium fashion catalogue plus a lightweight B2B order pad. Two front doors:

- **Shop** — retail catalogue in three sections, always in this order: Men, Women, Kids. Same data model
  (Product → Colour → Size → Quantity), one shared bag, "Send Order" instead of checkout.
- **Wholesale** — an image-only lookbook for trade buyers. No cart, no product pages;
  just images with optional captions and categories.

## Audience and scene
Boutique owners and individual buyers on phones, usually arriving from a WhatsApp link.
Wholesale buyers browse the lookbook before contacting the business directly.

## Mechanism
Multi-size add in a single action (2 XS + 5 S + 8 M), running total, then a four-step
checkout overlay: phone number → details → summary → bank-transfer instructions → reference.
Kids use age-based size labels (2-3Y, 4-5Y…) in the same key→quantity map.

The shop knows customers by **phone number alone**, and keeps that knowledge to itself:
the lookup says only whether the number has ordered before and whether anything is saved.
No email, no accounts, no passwords.

Saved details are **opt-in, behind a 4-digit PIN** the customer chooses after an order.
The PIN is the only key to their saved name and address — without it the shop will not
show those details to whoever is holding the phone, and the fields are simply typed
fresh. Three wrong tries fall back to manual entry for that session; skipping is always
one tap away and costs nothing. A short note tells the customer their details go to the
logistics partner, which is both honest and the reason to enter them accurately.
Payment is bank transfer confirmed by hand: the customer taps "I've paid", the order lands
as `pending_payment`, and the client verifies it in the admin Orders tab.

## Brand commitments
- Name is **Genvio Exotic Apparel** (formerly "MARY" — never shown).
- Photography leads; the UI recedes. Hierarchy: Photography → Product → Price → Action.
- "Add to Bag", never "Add to Cart".
- Playfair Display + Inter throughout. Client-specified palettes, applied through the theme
  system (see DESIGN.md): Men #171717 / #D6C3A5 / #F5F1E8 (power, confidence), Women
  #3B1F35 / #D8A7B1 / #F8F1F2 (luxury, elegance), Kids #6F8068 / #F3D9A4 / #FFF9ED (playful,
  warm). Wholesale is neutral stone. The landing uses the Men palette.
- Motion is CSS transform/opacity only. No parallax, canvas, or scroll-jacking.

## Constraints
React 19 + Vite + Tailwind 4 + React Router 7; Express + Prisma + Supabase Postgres.
No new dependency without a technical reason. `/admin` is an internal tool: functional first.

## Out of scope
Customer accounts, payments, checkout, coupons, reviews, wishlist, shipping.
