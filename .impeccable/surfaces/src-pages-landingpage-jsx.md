---
version: 1
slug: "src-pages-landingpage-jsx"
primary_target: "src/pages/LandingPage.jsx"
related_targets: []
---

# Landing — /

Scope: the brand's front door. Mode: Experience — the photography leads, the interface is two doors.
Audience: a buyer arriving from a shared link who must pick Shop or Wholesale within a second.
Job: make the two paths unmistakable and set the premium tone before any product appears.
Constraints: no products, no cart, no marketing claims. Panel photos are placeholders the client will replace.

## Direction contract
THESIS: A typographic masthead over two photographic doors. It refuses the hero-with-headline-and-two-buttons arrangement and the gradient-scrim-over-photo reading — the wordmark is the page's first act, the doors its second, and each door's text sits on a solid band, not on the photograph.
OWN-WORLD: Charcoal ground (#171717), sand (#D6C3A5) and warm white (#F5F1E8) type — the Men palette, since the gate opens onto Men first. "Genvio" in Playfair at clamp(3.75rem, 12vw, 9.5rem); "Exotic Apparel" tracked 0.42em beneath. Hairlines in `line`: one between the doors, one along the top edge of each door's band. Nothing else.
STORY: "This is Genvio. Shop for yourself, or open the trade lookbook." One glance, one tap.
FIRST VIEWPORT: Full viewport height. Masthead centred at top. Two doors fill the rest — side by side from md, stacked on mobile. Each door: the photograph unobscured, and along its foot a charcoal band (ground at 85%, hairline top edge) carrying the display word, a one-line sentence-case descriptor in sand, and a bare arrow glyph at the right. The door is the action.
SIGNATURE: Entrance — masthead rises 900ms, then each photo settles from scale 1.08 (1500ms, staggered 220/360ms), then the band copy rises (520/660ms). Hover — the door grows (flex 1 → 1.35), its photo eases to 1.04, the sibling dims to 0.7, the band deepens to 95% and the arrow slides right. All off under reduced motion.
FORM: Masthead over a split gate — first on the ordered list; brief-pinned extension of the established world, so no seed roll.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
