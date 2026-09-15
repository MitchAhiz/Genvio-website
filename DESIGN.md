---
name: Genvio Exotic Apparel
description: One component system, four worlds — a premium catalogue and trade order pad where photography leads and the interface recolours per section.
colors:
  # Men — charcoal + sand + warm white (client palette #171717 / #D6C3A5 / #F5F1E8)
  men-ground: "#171717"
  men-elevated: "#211F1C"
  men-surface: "#2C2925"
  men-line: "#413C34"
  men-ink: "#F5F1E8"
  men-ink-soft: "#D6C3A5"
  men-muted: "#A69A88"
  men-accent: "#D6C3A5"
  men-accent-soft: "#4A4133"
  men-on-accent: "#171717"
  men-cta: "#D6C3A5"
  men-cta-hover: "#E6D8BF"
  men-on-cta: "#171717"
  men-danger: "#E8A59C"
  # Women — deep plum + blush + rose white (client palette #3B1F35 / #D8A7B1 / #F8F1F2); also the default block
  women-ground: "#F8F1F2"
  women-elevated: "#FFFFFF"
  women-surface: "#F1E3E6"
  women-line: "#E9D6DA"
  women-ink: "#3B1F35"
  women-ink-soft: "#6A4761"
  women-muted: "#77596D"
  women-accent: "#3B1F35"
  women-accent-soft: "#D8A7B1"
  women-on-accent: "#F8F1F2"
  women-cta: "#3B1F35"
  women-cta-hover: "#2A1526"
  women-on-cta: "#F8F1F2"
  women-danger: "#A33A4A"
  # Kids — sage + golden + cream (client palette #6F8068 / #F3D9A4 / #FFF9ED)
  kids-ground: "#FFF9ED"
  kids-elevated: "#FFFFFF"
  kids-surface: "#FBEFD2"
  kids-line: "#EFDFB6"
  kids-ink: "#2E3A2B"
  kids-ink-soft: "#55654F"
  kids-muted: "#5F6F58"
  kids-accent: "#6F8068"
  kids-accent-soft: "#F3D9A4"
  kids-on-accent: "#1C2619"
  kids-cta: "#5E6E57"
  kids-cta-hover: "#4E5D48"
  kids-on-cta: "#FFF9ED"
  kids-danger: "#B24E2E"
  # Wholesale — stone
  wholesale-ground: "#F5F5F3"
  wholesale-elevated: "#FFFFFF"
  wholesale-surface: "#ECECE9"
  wholesale-line: "#DCDCD8"
  wholesale-ink: "#161616"
  wholesale-ink-soft: "#444442"
  wholesale-muted: "#6B6B64"
  wholesale-accent: "#161616"
  wholesale-accent-soft: "#E2E2DE"
  wholesale-on-accent: "#FFFFFF"
  wholesale-cta: "#161616"
  wholesale-cta-hover: "#2E2E2C"
  wholesale-on-cta: "#FFFFFF"
  wholesale-danger: "#B42318"
  # Theme-independent literals
  viewer-scrim: "#141110"
  overlay-scrim: "rgb(0 0 0 / 0.5)"
typography:
  masthead:
    fontFamily: "Playfair Display, Georgia, serif"
    fontSize: "clamp(3.75rem, 12vw, 9.5rem)"
    fontWeight: 500
    lineHeight: 0.9
    letterSpacing: "-0.025em"
  display:
    fontFamily: "Playfair Display, Georgia, serif"
    fontSize: "clamp(2.25rem, 5vw, 3.75rem)"
    fontWeight: 500
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Playfair Display, Georgia, serif"
    fontSize: "clamp(1.875rem, 4vw, 3rem)"
    fontWeight: 500
    lineHeight: 1.05
    letterSpacing: "-0.015em"
  lede:
    fontFamily: "Playfair Display, Georgia, serif"
    fontSize: "clamp(1.125rem, 2vw, 1.25rem)"
    fontWeight: 400
    fontStyle: italic
    lineHeight: 1.375
  price:
    fontFamily: "Playfair Display, Georgia, serif"
    fontSize: "clamp(1.125rem, 2vw, 1.875rem)"
    fontWeight: 400
    fontFeature: "tabular-nums"
  wordmark:
    fontFamily: "Playfair Display, Georgia, serif"
    fontSize: "clamp(17px, 2vw, 20px)"
    fontWeight: 600
    letterSpacing: "0.025em"
  field-phone:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 4vw, 1.875rem)"
    fontWeight: 500
    letterSpacing: "0.04em"
    fontFeature: "tabular-nums"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.375
  body-strong:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.375
  meta:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
  control:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    letterSpacing: "0.04em"
  button:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    letterSpacing: "0.02em"
  section-label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    letterSpacing: "0.18em"
    textTransform: uppercase
  tagline:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    letterSpacing: "0.42em"
    textTransform: uppercase
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  2xl: "16px"
  full: "9999px"
spacing:
  hair: "1px"
  xs: "4px"
  sm: "8px"
  md: "12px"
  gutter: "16px"
  gutter-wide: "24px"
  row: "40px"
  row-wide: "56px"
  section: "64px"
  page-foot: "96px"
components:
  button-cta:
    backgroundColor: "{colors.women-cta}"
    textColor: "{colors.women-on-cta}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    height: "48px"
    padding: "0 24px"
  button-cta-hover:
    backgroundColor: "{colors.women-cta-hover}"
  button-cta-disabled:
    backgroundColor: "transparent"
    textColor: "{colors.women-muted}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.women-ink}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    height: "40px"
  button-quiet-hover:
    backgroundColor: "{colors.women-accent-soft}"
  pill:
    backgroundColor: "transparent"
    textColor: "{colors.women-ink-soft}"
    typography: "{typography.control}"
    rounded: "{rounded.full}"
    height: "36px"
    padding: "0 16px"
  pill-active:
    backgroundColor: "{colors.women-accent}"
    textColor: "{colors.women-on-accent}"
  select-sort:
    backgroundColor: "transparent"
    textColor: "{colors.women-ink-soft}"
    typography: "{typography.control}"
    rounded: "{rounded.full}"
    height: "36px"
    padding: "0 36px 0 16px"
  input-quantity:
    backgroundColor: "{colors.women-ground}"
    textColor: "{colors.women-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    height: "40px"
    width: "64px"
  badge-new:
    backgroundColor: "{colors.women-accent-soft}"
    textColor: "{colors.women-ink}"
    rounded: "{rounded.sm}"
    height: "24px"
    padding: "0 10px"
  bag-count:
    backgroundColor: "{colors.women-ink}"
    textColor: "{colors.women-ground}"
    rounded: "{rounded.full}"
    height: "20px"
    padding: "0 4px"
  card-image:
    backgroundColor: "{colors.women-surface}"
    rounded: "{rounded.md}"
  sheet:
    backgroundColor: "{colors.women-elevated}"
    textColor: "{colors.women-ink}"
    rounded: "{rounded.lg}"
    padding: "16px 20px 20px"
  field:
    backgroundColor: "transparent"
    textColor: "{colors.women-ink}"
    typography: "{typography.body}"
    rounded: "0"
    padding: "8px 0"
  field-invalid:
    textColor: "{colors.women-danger}"
  field-phone:
    backgroundColor: "transparent"
    textColor: "{colors.women-ink}"
    typography: "{typography.field-phone}"
    rounded: "0"
    padding: "8px 0"
  checkout-sheet:
    backgroundColor: "{colors.women-elevated}"
    textColor: "{colors.women-ink}"
    rounded: "{rounded.2xl}"
    width: "512px"
  account-card:
    backgroundColor: "{colors.women-ground}"
    textColor: "{colors.women-ink}"
    rounded: "{rounded.lg}"
    padding: "24px"
---

# Design System: Genvio Exotic Apparel

## Overview

**Creative North Star: "One House, Three Rooms"**

Genvio is a single component system that walks through several rooms. Every surface is styled through fourteen semantic tokens (`ground`, `elevated`, `surface`, `line`, `ink`, `ink-soft`, `muted`, `accent`, `accent-soft`, `on-accent`, `cta`, `cta-hover`, `on-cta`, `danger`) and a `data-theme` attribute on `<html>` redefines all fourteen at once. The Men room is charcoal and sand; the Women room is plum and blush; the Kids room is sage, gold and cream; Wholesale is stone; the landing "gate" borrows the Men room because the shop opens onto Men first. Nothing else changes between rooms: the same card, the same pill, the same button, recoloured by a 400ms cross-fade.

The interface recedes so the photography can lead. Hierarchy is Photography → Product → Price → Action. Type carries the premium tone through one serif (Playfair Display) used sparingly for the masthead, section titles, product names and prices, and one sans (Inter) for everything operational. Tracked uppercase exists in exactly two places: the Men · Women · Kids switcher and the "Exotic Apparel" tagline under the masthead. Depth is almost entirely tonal; shadows are soft, low and reserved for things that can be pressed or that float above the page.

The build rejects the Shopify-clone and dashboard readings: no sidebar filters, no product-card inventory matrices, no gradient scrims over photographs, no emoji, no mixed icon sets. Motion is transform and opacity, eased with one curve, with a single licensed exception (the checkout sheet body follows its active card height).

**Key Characteristics:**
- Fourteen semantic tokens, four palettes, one component set; the theme follows the route.
- Order-pad checkout: one sheet, four cards sliding sideways, underlined fields, a four-word step trail.
- Men → Women → Kids is the fixed order everywhere the sections are listed.
- Playfair Display for identity and prices; Inter for controls and metadata.
- Tracked uppercase only in the section switcher and the masthead tagline.
- Flat, hairline-bordered surfaces; shadows only under pressable or floating elements.
- One easing (`ease-out-expo`), one theme cross-fade (400ms), unhurried image zooms (700–1200ms).

## Colors

Each room is a two-colour brand pair (deep + soft) sitting on a tinted off-white or a charcoal, expanded into fourteen roles; the accent is always the room's signature colour and the CTA is the darkest legible version of it.

### The fourteen roles

| Token | Role in the build |
|---|---|
| `ground` | Page background; also the 90–92% translucent fill behind sticky headers and filter bars |
| `elevated` | Cards that float: quick-add sheet, search dialog, quantity steppers |
| `surface` | Quiet fills: image placeholders, hover fills on icon buttons, skeleton blocks |
| `line` | Hairlines: header borders, card rings (`line/70`), dividers, the gate's door seam |
| `ink` | Primary text, headings, the bag-count badge fill |
| `ink-soft` | Secondary text, prices, the section lede, the masthead tagline |
| `muted` | Metadata: brand names, counts, availability, sort chevron. Contrast on `ground`: Men 6.4, Women 5.0, Kids 5.2, Wholesale 4.9 |
| `accent` | The room's signature colour: active pill fill, section-tab rule, focus ring, selected swatch ring, card ring on hover |
| `accent-soft` | The room's secondary colour: "New" badge, quiet-button hover fill, `::selection`, scrollbar thumb, empty-bag icon disc |
| `on-accent` | Text on a solid `accent` (active pill, order-sent check disc) |
| `cta` | Primary buttons: Add to Bag, Send order, Continue shopping |
| `cta-hover` | Their hover fill |
| `on-cta` | Text on a primary button |
| `danger` | Validation only: an invalid field's underline and label, the error line beneath it, submission and config failures. Never a fill, a badge or a decorative accent |

### Primary (the room accents)
- **Warm Sand** (`men-accent`): the Men and gate signature. Active pills, the rule under MEN, the sand "Add to Bag" button on charcoal. `accent-soft` in this room is a dark olive-brown (`men-accent-soft`) so tints stay quiet on the dark ground.
- **Deep Plum** (`women-accent`): the Women signature and the default token block. Ink, accent and CTA are the same plum; the pairing colour is the blush (`women-accent-soft`) which does the tinting.
- **Sage** (`kids-accent`): the Kids signature, kept at the exact client value for pills, rules and rings. **The CTA is not the accent here**: `kids-cta` is a darkened sage because the exact sage on the cream ground reaches only ~4.0:1 against `on-cta` text, while the darkened sage clears 4.5:1 (AA). Golden (`kids-accent-soft`) is the tint.
- **Near-black Stone** (`wholesale-accent`): the lookbook has no second colour; accent equals ink.

### Neutral (grounds and surfaces)
- **Charcoal** (`men-ground`, `gate`): color-scheme dark. Elevated, surface, line and accent-soft step warmer and lighter (`men-elevated`, `men-surface`, `men-line`, `men-accent-soft`), not greyer, so cards read as sand-tinted. The dark rooms were re-spread when the checkout shipped: a sheet on `elevated` sitting over a scrim over `ground`, divided internally by `line` hairlines, needs more separation between those three steps than a flat page did.
- **Rose White** (`women-ground`), **Cream** (`kids-ground`), **Stone** (`wholesale-ground`): each ground is the client's third colour used verbatim; `surface` and `line` are deeper tints of the same hue, never neutral grey.
- **Viewer Scrim** (`viewer-scrim` at 95%) and **Overlay Scrim** (`overlay-scrim`): the only literal colours in the build. The fullscreen image viewer and the dialog backdrops must not recolour with the theme.

### Named Rules
**The Same Fourteen Rule.** A theme may only redefine the fourteen tokens (`danger` joined the thirteen when the checkout shipped). No component carries a per-theme branch; if a room needs a different look, the token values change, not the component.

**The Exact Accent Rule.** `accent` carries the client's signature colour unaltered. Where that colour cannot pass AA as a button fill, `cta` darkens and `accent` stays exact (Kids). Never darken the accent to fix the button.

**The Validation-Only Danger Rule.** `danger` exists to say a field is wrong and nothing else. It carries the invalid field's underline, its label, its error line, and the two failure messages in the payment card. It is never a fill, a badge, a hover state, a chart colour or a piece of emphasis. Its values are per-theme: a light muted rose on the charcoal rooms (`men-danger`), a deep berry on plum (`women-danger`), a burnt clay on cream (`kids-danger`), a true red on stone (`wholesale-danger`) — each chosen to stay legible against its own `ground` rather than to be the same red everywhere.

**The Men-Women-Kids Rule.** Sections are listed Men, Women, Kids, in that order, in the switcher, the section config and any cross-links. The gate lands on Men.

## Typography

**Display Font:** Playfair Display (with Georgia, serif), weights 400/500/600
**Body Font:** Inter (with system-ui, sans-serif), weights 300–600

**Character:** An editorial serif for the words a buyer remembers (the name, the section, the price) over a neutral sans that runs the shop. Playfair never sets a control; Inter never sets a headline.

### Hierarchy
- **Masthead** (Playfair 500, `clamp(3.75rem, 12vw, 9.5rem)`, 0.9, −0.025em): "Genvio" on the gate only.
- **Tagline** (Inter 500, 11→13px, 0.42em, uppercase): "Exotic Apparel" under the masthead, in `ink-soft`. One of two tracked-uppercase sites.
- **Display** (Playfair 500, 36→60px, tracking −0.02em): section titles ("Men", "Kids", "Bag (3)") and the gate door words (48→72px, line-height 0.95).
- **Headline** (Playfair 500, 30→48px, 1.05, −0.015em): the product name on the product page; the wholesale title.
- **Lede** (Playfair 400 italic, 18→20px, 1.375, `ink-soft`, max-width 28rem): the one-line section blurb under a section title.
- **Price** (Playfair 400, 18px on cards → 30px on the product page, `ink-soft`, tabular): see the Price component.
- **Wordmark** (Playfair 600, 17→20px, +0.025em, sentence case): "Genvio Exotic Apparel" in the retail and wholesale headers.
- **Body / product name** (Inter 500, 14→15px, 1.375): card names, bag line items, "Select sizes & quantities".
- **Field label** (Inter 400, 12px, `muted`): the small word above every underlined checkout field; it warms to `ink-soft` while the field has focus and turns `danger` when the field is invalid.
- **Phone field** (Inter 500, 24→30px, +0.04em, tabular): the one oversized input in the build. The number is the largest thing on the first card because it is the one fact the shop already knows the customer by.
- **Meta** (Inter 400, 11→13px, `muted`): brand, colour count · size range, availability, counts.
- **Control** (Inter 500, 12→13px, +0.04em): pills, the sort select, quiet buttons.
- **Button** (Inter 600, 14px, +0.02em): CTA labels.
- **Section label** (Inter 500, 12→13px, 0.18em, uppercase): MEN · WOMEN · KIDS in the switcher. The other tracked-uppercase site.

### Named Rules
**The Two Tracked Words Rule.** Tracked uppercase appears only in the section switcher (0.18em) and the masthead tagline (0.42em). Buttons, pills, labels and metadata are sentence case.

**The Naira Rule.** Prices are set in Playfair, but Playfair Display genuinely ships no U+20A6 — measured: its ₦ advance width is byte-identical to the Georgia fallback's while other glyphs differ, which is the fallback answering, not the face. So the `Price` component sets the sign alone in Inter at 0.95em, weight 400, tracking −0.02em, with a 0.06em right margin, and the figures in the parent's Playfair with `tabular-nums` on the whole span. The 0.95em is an optical match, not a guess: it lines Inter's cap height (0.727em) up with Playfair's (~0.70em), and the negative tracking closes the gap the substitution opens. Never render a price without it, and never let the sign drift to a different size to "look bigger" — it is sized to disappear.

**The Balanced Heading Rule.** Every display and headline gets `text-balance`; numbers in counts, quantities and totals get `tabular-nums`.

## Layout

The retail shop is a 7xl container (1280px) with 16px gutters on mobile and 24px from `sm`. Section headers sit 40px (mobile) / 64px (`sm`) from the header; the product grid runs 2 → 3 → 4 columns at the base, `sm` (640px) and `lg` (1024px) breakpoints with 16/40px gaps growing to 24/56px, and every card image is a 3:4 portrait. The bag narrows to a 2xl (672px) reading column. Wholesale is a CSS-columns masonry, 2 → 3 → 4 at base, `md` (768px) and `xl` (1280px), 12→16px gaps, `break-inside-avoid` on each figure.

The retail header is fixed-height so the sticky filter bar can sit exactly beneath it: 48px title row plus a 40px switcher row on mobile (filter bar sticks at 88px), one 56px row from `sm` (filter bar sticks at 56px). Headers and filter bars are `ground` at 90–92% with a small backdrop blur and a `line` hairline. On the product page the info column is sticky at 80px from `lg`, and the Add-to-Bag bar is a bottom-stuck 92% `ground` band on mobile that becomes static from `lg`.

The checkout is the one overlay layout. Under 640px it is a bottom sheet: full width, pinned to the bottom edge, capped at 94dvh, 16px top corners, a 36×4px `line` grab handle above the header. From `sm` it is a centred modal, 512px wide in a 24px inset, capped at 88dvh, 12px all round. Inside, a fixed header (title plus step trail) and a scrolling body whose height follows the active card; the four cards sit side by side on a flex track translated by whole viewport widths. Card padding is 20px on mobile, 32px from `sm`, with 24–32px above the footer action.

The gate is the one full-viewport layout: masthead centred in a 36→56px top pad, then two doors that fill the remainder, stacked (each at least 40dvh) on mobile and side by side from `md`, separated by a 1px `line` seam. Each door's copy sits on a band at the foot in `ground` at 85% with a `line` hairline top edge; padding steps 20 → 28 → 36 → 44px.

## Elevation & Depth

Depth is tonal first. Surfaces separate by `ground` → `elevated` → `surface` steps and by hairlines in `line`, and a card image sits in a 1px ring of `line/70` rather than a shadow. Shadows appear only under things that can be pressed (pills, buttons) or that float above the page (sheets, dialogs), and they are soft, low-offset and negative-spread so they read as contact, not lift. Translucent `ground` with a small backdrop blur is the one layering effect used for sticky bars.

### Shadow Vocabulary
- **Contact hairline** (`box-shadow: 0 1px 0 0 rgb(0 0 0 / 0.03)`): the quiet "Add to Bag" button at rest.
- **Pill lift** (`box-shadow: 0 2px 6px -2px rgb(0 0 0 / 0.3)`): the active category pill only.
- **Quiet hover** (`box-shadow: 0 3px 8px -3px rgb(0 0 0 / 0.25)`): the quiet button on hover.
- **CTA rest** (`box-shadow: 0 6px 16px -6px rgb(0 0 0 / 0.35)`): every primary button.
- **CTA hover** (`box-shadow: 0 8px 20px -6px rgb(0 0 0 / 0.4)`): primary buttons on hover.
- **Sheet** (`box-shadow: 0 24px 60px -20px rgb(0 0 0 / 0.5)`): the quick-add sheet.
- **Checkout sheet** (`box-shadow: 0 32px 80px -24px rgb(0 0 0 / 0.55)`): the checkout overlay, the deepest shadow in the build and the only one carrying the whole task.
- **Focus underline** (`box-shadow: 0 1px 0 0 var(--color-accent)`): not depth. It doubles the focused field's 1px hairline to a legible 2px without moving the baseline. It is the only box-shadow used as a stroke.
- **Dialog** (`box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.2), 0 8px 10px -6px rgb(0 0 0 / 0.2)`): the search dialog.

### Named Rules
**The Press Removes the Shadow Rule.** Every shadowed button drops its shadow and moves down 1px on `:active`. Disabled buttons have no shadow.

**The Ring Not Shadow Rule.** Images and cards are outlined by a 1px `line/70` ring at rest and an `accent/60` ring on hover; they never carry a shadow.

## Shapes

Softly squared: cards, buttons, inputs and badges use small radii, and only pills, swatches, icon buttons and the bag count are fully round. Card images and primary buttons share the 6px radius so the card's image, its button and the CTA read as one family. Quantity steppers and wholesale tiles are 8px, the search dialog 12px, and the quick-add sheet is 16px on its top corners on mobile, 8px all round on desktop. Form fields divide into two families by surface: a field on the page is boxed (quantity input, stepper, search), while every field inside the checkout sheet is underlined — a single bottom hairline, no box, no radius, no fill — so a column of five fields reads as one ruled page rather than five containers stacked inside a container. Within that flow the bank account card is the only boxed surface (8px, 1px `line`, on `ground`), which is what makes the number look like something to be copied. Borders are always 1px hairlines in `line` (or `line/70`); the only 1.5px stroke is the rule under the active section tab. Icons are a single system: 24-unit grid, 1.5 stroke, round caps and joins, sized 14–28px.

## Components

### Buttons
Tactile but quiet: filled with the room's `cta`, rounded 6px, a low contact shadow, and a 1px press.
- **Shape:** softly squared (6px)
- **Primary (CTA):** `cta` fill, `on-cta` text, Inter 600 14px +0.02em, 44–52px tall (52px on mobile product/bag, 44–48px elsewhere), full width in forms and 24px side padding as a link. Shadow: CTA rest.
- **Hover / Active / Focus:** hover to `cta-hover` with the CTA hover shadow; active translates 1px down and drops the shadow; focus-visible is the global 2px `accent` outline at 3px offset. All state transitions are 300ms.
- **Disabled:** transparent fill, `muted` text, 1px `line` border, no shadow, `cursor: not-allowed`. The label changes to the instruction ("Select sizes to add").
- **Quiet (card Add to Bag):** transparent, 1px `accent/50` border, `ink` text, Inter 500 13px +0.02em, 40px tall, contact hairline shadow. Hover fills with `accent-soft`, border to `accent`, quiet-hover shadow.
- **Icon buttons:** 8px padding, fully round, `ink-soft` → `ink` on hover with a `surface` fill.
- **Text links:** `muted` → `ink` on hover; "Remove" underlines on hover at 4px offset.

### Chips
- **Style:** fully round, 36px tall, 16px side padding, Inter 500 12→13px +0.04em, 1px border, horizontally scrolling with the scrollbar hidden.
- **State:** unselected is transparent with a `line` border and `ink-soft` text, hovering to an `accent` border and `ink` text; selected fills `accent` with `on-accent` text and the pill-lift shadow. `aria-pressed` carries the state.

### Sort select
A native `<select>` dressed as a chip: same 36px round outline, 16px left / 36px right padding, a 14px chevron in `muted` at the right, and the global `accent` focus outline.

### Cards / Containers
- **Product card:** no border, no shadow. A 3:4 image on `surface` at 6px radius inside a 1px `line/70` ring; hover moves the ring to `accent/60` (500ms) and zooms the image to 1.04 over 1200ms. Text stacks beneath with 14–16px top margin: name (Inter 500), brand (`muted`), then price (Playfair, `ink-soft`) baseline-aligned with the "2 colours · S – XL" summary (`muted`), then the quiet button at 14px.
- **New badge:** `accent-soft` fill, `ink` text, Inter 500 11px, 24px tall, 4px radius, 12px in from the image's top-left. Sentence case.
- **Quick-add sheet:** `elevated`, 1px `line` border, bottom sheet on mobile (16px top corners, 36×4px `line` grab handle) and a centred 24rem dialog from `sm` (8px), over a 50% black scrim with a 2px blur. Sections divided by `line/70` hairlines.
- **Search dialog:** `elevated`, 12px radius, 1px `line` border, 32rem wide, 48→64px from the top, over a 50% black scrim with a small blur; results rows hover to `surface`.
- **Bag line items:** a `line` divided list with an 80×100px (96×120px from `sm`) ringed thumbnail.
- **Skeletons:** `surface` blocks in the final layout's shapes, pulsing.

### Inputs / Fields
- **Underlined field (checkout):** transparent, no border but a 1px `line` bottom hairline, zero radius, 8px vertical padding, type inherited from the sheet (Inter). Focus moves the hairline to `accent` and adds a 1px `accent` box-shadow beneath it so the stroke doubles without shifting the baseline; the label warms to `ink-soft`. Invalid moves the hairline and the label to `danger` and prints the message beneath at 12px in `danger`. Placeholders are the full `muted` token at `opacity: 1` — never a faded ink. The same rule covers `input`, `textarea` (no resize handle) and `select` (native chevron stripped, a 14px drawn chevron in `muted` at the right).
- **Unchosen select:** a `<select>` with nothing picked carries `data-empty="true"` and renders in `muted`, so it reads as a placeholder rather than a chosen value. The state is keyed to the attribute, not a utility class, because `.field select` (0,1,1) outranks a single class and would win the colour back.
- **Quantity input:** 64×40px (36px from `sm`), centred text, `ground` fill, 1px `line` border, 6px radius, tabular numerals, no native spinners. Focus swaps the border to `accent`; disabled drops to 40% opacity.
- **Stepper (product page, bag):** a `line`-bordered `elevated` group at 8px (product) / 6px (bag) with − and + buttons in `muted` → `ink` and a `line`-divided centre cell.
- **Search field:** borderless on the dialog's `elevated` ground, `muted` placeholder, an "Esc" text button at the right.
- **Colour swatches:** 32–36px discs with the variant's hex, a 1px `line` ring offset 2px in the parent's ground; the selected swatch takes a 2px `accent` ring and scales to 1.05.
- **PIN boxes:** four 48×52px masked digit cells, `elevated` fill, 1px `line` border, 6px radius — a boxed exception inside the otherwise-underlined checkout sheet, because a PIN is entered digit-by-digit rather than read as a line of text. A filled cell's border warms to `accent`; a wrong attempt turns every border `danger` and the group does one 320ms shake. Used both to unlock saved details at the top of the Details card and to set a PIN from the save-details offer on the Done card.
- **Save-details card:** a boxed `ground` panel (matching the bank-transfer card's exception to the underlined-field rule) offered only after the order is placed, never before — "Want faster checkout next time?" with Save / No thanks, or straight to a set-PIN + confirm-PIN pair if opted in. It rises in 450ms after a 400ms hold, so it never competes with the order confirmation for the first look.

### Navigation
- **Retail header:** sticky, `ground/90` with backdrop blur and a `line` bottom hairline; wordmark left, switcher centred (from `sm`) or on its own 40px row (mobile), search and bag icons right. The bag count is an `ink` disc with `ground` numerals, 20px, Inter 600 11px.
- **Section switcher (signature):** three tracked uppercase labels in `muted`, separated by a `muted/60` middle dot, gap 10→14px. Hover and active go to `ink`; the active label grows a 1.5px `accent` rule from its centre (`scaleX(0 → 1)`, 500ms). Switching is a route change; the rule and the whole page recolour together.
- **Wholesale header:** the same bar without the switcher; a "Shop →" text link whose arrow nudges 2px right on hover.
- **Back:** a chevron plus "Back" in `muted` → `ink`, 16px from the top-left of the product page.

### The Price
`<Price>` renders `₦` in Inter (0.95em, 400, tracking −0.02em, 0.06em right margin) followed by the `en-NG` formatted amount in the parent's Playfair, the whole span in `tabular-nums`. The sign sits on the baseline with the figures — it is optically matched, not raised. Used at 18→20px on cards, 18px in the quick-add sheet, 20→24px in the checkout summary and payment lines, and 24→30px on the product page and bag total. Plain `formatPrice()` strings (Inter) are allowed only inside button labels, bag line totals and search rows where the type is already Inter.

### The Checkout Overlay (signature)
An order pad, not a checkout funnel: one sheet holding four cards that slide sideways like pages of a receipt book. Bottom sheet under 640px, centred modal above (see Layout).
- **Header:** the step title in Playfair 500 at 24→30px (Your details / Your order / Pay by transfer / Order submitted), the step trail beneath it, a round close button in `muted` → `ink` on a `surface` fill at the right.
- **Step trail:** four words — Details · Summary · Payment · Done — at 12px Inter, sentence case, gap 10px. Past steps are `ink-soft`, future steps `muted`, the current step `ink` with a 1.5px `accent` rule beneath it scaling from the left over 500ms. `aria-current="step"` carries the state. This is the whole progress indicator: there are no numbered circles, no connecting line, no bar, no percentage.
- **Body:** the scrolling region's height follows the active card (measured with a ResizeObserver) so the sheet never shows a taller card's empty space; the track is translated by whole widths. Inactive cards are `aria-hidden`, `inert` and faded to 0.
- **Focus:** the sheet traps Tab, moves focus into each card as it settles (the first field on a card the visitor fills, the card itself on a card they read), returns focus to whatever opened it, and locks body scroll while open. Escape closes.
- **Recognition:** a complete phone number is looked up; when it matches, the saved fields fill as one cascade — a 900ms `accent-soft` wash on each field, each 70ms behind the one above (`--fill-step`), `backwards` — and a line "Welcome back, [name]" appears under the phone field in `ink` beside a small `accent` check disc. Nothing bounces.
- **Bank account card:** the flow's only boxed surface. `ground` fill, 1px `line`, 8px, 24px padding; the 10-digit NUBAN in Playfair at 30→36px, tracked +0.06em, tabular, grouped 4-3-3. A round "Copy" pill sits beside it; on copy the pill fills `accent` with a drawn check, the number itself takes `accent` over 500ms, and both revert after 2s.
- **Success:** a 56px `accent` disc scales in from 0.6 over 500ms, and a single drawn check strokes itself inside it (`stroke-dashoffset` 26 → 0 over 600ms, 200ms in). No confetti. The order reference follows in Playfair at 24→30px, +0.04em, tabular, `select-all`.
- **Drag to dismiss (mobile):** the grab handle is a real gesture. The sheet follows the finger down 1:1 and resists upward (`−√|dy| × 3`); it leaves past a third of its own height or on a flick faster than 0.6px/ms, otherwise it springs back over 400ms.

### The Gate (landing)
Theme `gate` (the Men tokens). Masthead and tagline over two `<Link>` doors: an unobscured `object-cover` photograph, and a band at the foot in `ground/85` with a `line` top hairline holding the door word (Playfair 500, 48→72px), a sentence-case blurb in `ink-soft` (13→14px) and a 28px arrow icon in `ink-soft` at the right. Hover (pointer devices from `md`): the door's flex-grow eases 1 → 1.35 (600ms), its photo to scale 1.04 (1100ms), the sibling door dims to 0.7, the band deepens to `ground/95` (500ms) and the arrow slides 8px right and turns `ink` (500ms).

### Motion grammar
One curve, `ease-out-expo` (`cubic-bezier(0.16, 1, 0.3, 1)`), and transforms and opacity only, with the colour cross-fade and one bounded height exception.

**The One Height Exception Rule.** `transition: height` is animated in exactly one place: `.checkout-body`, because the four cards differ in height and without it the sheet snaps between steps. It fires at most three times per checkout on one container, which is what keeps its layout cost bounded, and the alternatives (a fixed height to the tallest card, or a hard snap) both read worse. This is a licence for that container, not a precedent: nothing else in the build transitions a layout property, and a second one needs the same argument made again.
- **Theme cross-fade:** 400ms on `body` (background, colour), the shop wrapper (background, colour), the retail and wholesale headers (background, border) and the catalogue filter bar (background, border). Section-tab colour also fades over 400ms; its rule grows over 500ms.
- **Control states:** 300ms on background, border, colour, shadow and transform for buttons, pills, selects, swatches and thumbnails.
- **Image hover:** card ring 500ms; card image to 1.04 over 1200ms; wholesale tile to 1.02 over 700ms.
- **Gate entrance:** masthead rises 14px → 0 over 900ms, tagline the same with a 140ms delay; each photo settles from scale 1.08 over 1500ms with 220/360ms delays; each band rises over 900ms with 520/660ms delays. All use `animation-fill-mode: backwards`.
- **Checkout entrance:** the scrim fades over 400ms; the sheet rises from `translateY(100%)` over 550ms on mobile and fades-and-settles (12px up, scale 0.985) over 450ms from `sm`. Closing is faster and eased in: 320ms down / 260ms out, over a 300ms scrim fade.
- **Step change:** the card track translates over 450ms, the outgoing card fades over 350ms, the body height eases over 450ms, the trail rule scales over 500ms, and focus lands at 460ms — after the slide settles.
- **Recognition cascade:** a 900ms `accent-soft` → transparent wash per field, staggered `--fill-step` × 70ms, `backwards`, five fields deep.
- **Copy feedback:** the account number crosses to `accent` over 500ms, the pill over 300ms, and both hold for 2s.
- **Success:** the disc scales in over 500ms, then the check draws over 600ms after a 200ms beat.
- **Drag to dismiss:** while the finger is down there is no transition at all; release either closes or springs back over 400ms.
- **Reduced motion:** under `prefers-reduced-motion: reduce` every transition and animation duration collapses to 0.01ms with zero delay and a single iteration, and the gate doors keep flex-grow 1.

### Browser surfaces
`::selection` is `accent-soft` under `ink`; `:focus-visible` is a 2px `accent` outline at 3px offset with a 2px radius; scrollbars are thin with an `accent-soft` thumb; number inputs hide their spinners; the fullscreen image viewer is the literal viewer scrim at 95% with white/70–80 controls and a "1 / 4" counter.

### Outside the system
`/admin` is an internal tool and is deliberately outside this design system: it is styled with inline styles, not the semantic tokens, and nothing in it is a pattern to copy. Do not read admin markup as precedent, and do not extend the token set to serve it. Everything a customer can reach is inside the system.

## Do's and Don'ts

### Do:
- **Do** style every new element through the fourteen semantic tokens; adding a room means adding a `[data-theme]` block, never a component branch.
- **Do** keep `accent` at the client's exact signature value and route AA fixes through `cta` (Kids: sage stays exact, the button is the darkened sage).
- **Do** list the sections Men, Women, Kids, in that order, everywhere they appear.
- **Do** render every price through `<Price>`: ₦ in Inter, numerals in Playfair, tabular.
- **Do** put shadows only on pressable or floating elements, from the seven-value vocabulary, and drop them on press and when disabled.
- **Do** outline images with a 1px `line/70` ring and move it to `accent/60` on hover.
- **Do** use `ease-out-expo` for every transition, 400ms for theme changes, 300ms for control states, 700–1200ms for image zooms.
- **Do** honour `prefers-reduced-motion` by collapsing durations, not by removing the elements.
- **Do** underline every field inside the checkout sheet — 1px `line`, `accent` plus a 1px `accent` box-shadow on focus, `danger` when invalid — and keep the bank account card as the flow's only boxed surface.
- **Do** set placeholders at the full `muted` token with `opacity: 1`, and key an unchosen `<select>`'s muted colour to `data-empty="true"` so it outranks `.field select`.
- **Do** keep `danger` to validation: invalid underlines, invalid labels, error lines and failure messages.
- **Do** give a modal overlay the full set: Tab trap, focus into each step, focus restored to its opener, Escape, body-scroll lock, `inert` on inactive panels.

### Don't:
- **Don't** set tracked uppercase anywhere except the section switcher (0.18em) and the masthead tagline (0.42em).
- **Don't** set controls, labels or metadata in Playfair; Playfair is for the masthead, section and product titles, ledes, door words and prices.
- **Don't** use neutral grey for `surface` or `line`; every room's hairlines and fills are tints of its own ground.
- **Don't** place text on a photograph without the solid `ground` band; no gradient scrims.
- **Don't** put a full size or inventory matrix on a product card; the summary is "n colours · S – XL".
- **Don't** mix icon sets or use emoji; icons come from `icons.jsx` at 1.5 stroke.
- **Don't** animate anything other than transform, opacity, the colour cross-fade and the one licensed `.checkout-body` height; no parallax, canvas, scroll effects or animated gradients.
- **Don't** mark progress with numbered circles, a connecting rail, a progress bar or an "n of 4" count. The four-word trail with a rule under the current word is the whole indicator.
- **Don't** box a field inside the checkout sheet, and don't fill an underlined field — the underline is the field. Boxed inputs stay where they already are: quantity, stepper, search.
- **Don't** spend `danger` on anything decorative — no danger badges, danger fills, danger hovers or danger emphasis.
- **Don't** let the naira sign be resized, re-weighted or reset in Playfair; it is an Inter graft at 0.95em sized to vanish beside the figures.
- **Don't** let the fullscreen viewer or dialog scrims take theme colour; they are the two literal scrims.
