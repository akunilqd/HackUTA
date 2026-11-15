---
version: 1
slug: "web-src-app-page-tsx"
primary_target: "web/src/app/page.tsx"
related_targets: ["web/src/app/onboarding/page.tsx"]
---

# Surface: landing `/` (Persuade) and onboarding `/onboarding` (Operate)

Scope: Pharmasee's public entry. Audience: adult children setting up medication calls for a parent. Action: "Get started", then a three-step form that writes `users` and `user_medications`. No login (owner request, 2026-11-15): an anonymous Supabase session is created on save. Constraints: owner-pinned palette, type and ornament (PRODUCT.md Brand Commitments), WCAG AA+, 18px body, 48px inputs; theme "as Odyssey as possible", plain labels first.

## Direction contract

THESIS: The page is the painting. Rivière's Odysseus and Argos fills the screen in red-figure terracotta, framed in a gold Greek key like a vase panel, and the promise sits centered on it with one action. It refuses the split hero and the scroll of feature sections.

OWN-WORLD: Glaze ground with the tinted engraving under a glaze scrim; cream Cinzel title; cream Atkinson body; terracotta-deep for the one button and the ship; gold only as hairline (page frame, meander, running-dog wave, the sea line). Forms sit on cream cards with gold borders and meander edges over the dimmed art.

STORY: "Argos will watch over my parent." The visitor sees the recognition scene, reads the promise, presses Get started, sails three short steps to Ithaca, and sees what Argos will do.

FIRST VIEWPORT (1440): full-bleed art; gold frame inset 24px; wordmark centered top; running-dog strip; title in two lines at ~4.6rem centered; one sentence; 64px "Get started" centered; Homer line and credit at the foot. Mobile (390): same stack, title 2.3rem, full-width button, frame grows with the content.

FORM: Painted vase panel; owner-pinned layout (image as background, centered text, one button). seed: none (skipped under the owner's pin). The owner pinned this composition and world in their own words, and a brief-pinned direction beats the roll.

Signature interaction: the ship crossing the gold sea line toward Ithaca as each step completes (transform only, 700ms ease-out-expo, reduced-motion: static).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
