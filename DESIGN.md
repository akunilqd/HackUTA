---
name: Pharmasee
description: Glaze and cream like a red-figure vase, Cinzel titles over Atkinson body, gold Greek key and running-dog borders; Argos keeps watch.
colors:
  cream: "#f3e9d2"
  cream-deep: "#e9dcbd"
  glaze: "#1e1a17"
  ink: "#4a423a"
  terracotta: "#c8643b"
  terracotta-deep: "#a84a25"
  terracotta-pressed: "#953f1e"
  aegean: "#2e6e9e"
  aegean-deep: "#275f89"
  gold: "#d4a64a"
  olive: "#6b8e4e"
  olive-deep: "#3f5f2a"
  red: "#b5483a"
  red-deep: "#842a20"
typography:
  display:
    fontFamily: "Cinzel, Georgia, serif"
    fontSize: "4rem"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "0.01em"
  headline:
    fontFamily: "Cinzel, Georgia, serif"
    fontSize: "2.4rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.01em"
  wordmark:
    fontFamily: "Cinzel, Georgia, serif"
    fontSize: "1.15rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.12em"
  title:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "1.3rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "0em"
  lead:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "1.3rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0em"
  body:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0em"
  label:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: "0em"
  caption:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0em"
rounded:
  none: "0px"
  focus: "2px"
  md: "0.375rem"
  full: "9999px"
spacing:
  stack-xs: "0.5rem"
  stack-sm: "0.75rem"
  stack-md: "1.5rem"
  stack-lg: "2.25rem"
  gutter-phone: "1.25rem"
  gutter-tablet: "3rem"
  gutter-desktop: "5rem"
  section-phone: "4rem"
  section-desktop: "6rem"
  container: "72rem"
components:
  button-primary:
    backgroundColor: "{colors.terracotta-deep}"
    textColor: "{colors.cream}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 1.75rem"
    height: "3.5rem"
  button-primary-hover:
    backgroundColor: "{colors.terracotta-pressed}"
    textColor: "{colors.cream}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.glaze}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 1.75rem"
    height: "3.5rem"
  button-secondary-hover:
    backgroundColor: "{colors.glaze}"
    textColor: "{colors.cream}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.aegean-deep}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 1rem"
    height: "3rem"
  button-quiet-hover:
    textColor: "{colors.glaze}"
  input:
    backgroundColor: "rgba(255, 255, 255, 0.6)"
    textColor: "{colors.glaze}"
    rounded: "{rounded.md}"
    padding: "0 1rem"
    height: "3rem"
  nav-link:
    backgroundColor: "transparent"
    textColor: "{colors.glaze}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 1rem"
    height: "3rem"
  nav-link-hover:
    backgroundColor: "{colors.cream-deep}"
  nav-link-active:
    backgroundColor: "{colors.glaze}"
    textColor: "{colors.cream}"
  nav-tab:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.ink}"
    height: "4rem"
  nav-tab-active:
    textColor: "{colors.terracotta-deep}"
  card-framed:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.glaze}"
    rounded: "{rounded.none}"
    padding: "1.75rem 1.5rem 2rem"
  notice-info:
    backgroundColor: "rgba(46, 110, 158, 0.1)"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "1rem"
  dose-marker-taken:
    backgroundColor: "{colors.olive}"
    textColor: "{colors.cream}"
    rounded: "{rounded.full}"
    size: "2.75rem"
  dose-marker-missed:
    backgroundColor: "{colors.red}"
    textColor: "{colors.cream}"
    rounded: "{rounded.full}"
    size: "2.75rem"
  dose-marker-upcoming:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.glaze}"
    rounded: "{rounded.full}"
    size: "2.75rem"
---

# Design System: Pharmasee

## Overview

**Creative North Star: "The Terrace at Ithaca"**

Pharmasee is a vigil, not a dashboard. Its guardian is Argos, the hound from the Odyssey. The landing opens on glaze like a black-figure vase, with the Rivière scene of Odysseus and Argos set into it in red-figure terracotta; the body below is calm cream. The Odyssey is carried by four devices: Cinzel capitals for titles, the gold Greek-key meander, the gold running-dog wave, and glaze bands where the art and the story live. Everything that does work (body copy, labels, buttons, inputs) is set in Atkinson Hyperlegible at a 20px base (raised from 18px at the owner's request for easier reading), because the readers are often anxious adult children on a phone and, sometimes, the older parent with low vision. The theme is a layer over clarity, never a puzzle.

The system is flat and bordered. Surfaces sit on the cream ground without shadows; structure comes from 2px rules in glaze or gold and from the meander strip that separates regions (hero from body, header from app, the top of the sign-in card). Colour is rationed: terracotta appears only on the primary action and the step numerals, aegean only on links and focus, gold only as hairline and the one headline set on glaze. The states of a dose (olive taken, soft red missed, bare cream upcoming) are the only other colours that carry meaning.

Motion is a single authored entrance: the hero copy rises, the gold "day" line draws once, the dose markers settle. After that, nothing moves except hover and focus, and all of it stops under reduced motion (there is no video).

**Key Characteristics:**
- One warm ground (cream) with one dark band (glaze); no white page, no grey chrome.
- Cinzel Bold is reserved for h1, h2 and the wordmark; every other word is Atkinson Hyperlegible.
- Ornament is a single 14px gold meander strip, horizontal or vertical, and a 3px gold wave as the day track.
- Flat surfaces, 2px borders, square cards; the only shadow is a soft lift under the primary button.
- Deep colour variants exist purely for WCAG AA on cream; the brand values are the owner's.
- One entrance animation, exponential ease-out, then stillness.

## Colors

A sun-faded terracotta-and-sea palette on cream clay, with glaze as the single dark.

### Primary
- **Terracotta** (`terracotta`): the owner's brand red-orange. On cream it does not pass AA for text, so it is held as the brand reference and used for fills only where the build chooses to.
- **Terracotta Deep** (`terracotta-deep`): the colour that actually ships for the primary action. Fills "Get started" and the submit buttons, colours the Cinzel step numerals "1 2 3", and marks the active tab in the phone tab bar.
- **Terracotta Pressed** (`terracotta-pressed`): primary button hover only. It is a literal in `Button.tsx`, not a theme token; treat it as the one darker step below deep.

### Secondary
- **Aegean** (`aegean`): focus outlines (3px, offset 3px) and input focus borders and rings. The informational notice uses it at 40% for its border and 10% for its fill.
- **Aegean Deep** (`aegean-deep`): every text link and the quiet button ("Sign in", "Already set up? Sign in", "Use a different email"). Always bold.

### Tertiary
- **Gold** (`gold`): hairline ornament and nothing wider. The meander strokes, the day-track wave, the wordmark ring, 2px section rules at 60% and the sign-in card frame at 70%. Used as text only on glaze: the "Why Argos" h2 and the links in the landing hero (7.7:1). Also the text-selection colour.
- **Olive** / **Olive Deep** (`olive`, `olive-deep`): a dose taken. Olive fills the marker, olive-deep sets the note beneath it.
- **Soft Red** / **Red Deep** (`red`, `red-deep`): a dose missed and form errors. Red fills the marker and the invalid input border; red-deep sets the error and note text.

### Neutral
- **Cream** (`cream`): the page, the app shell, the sign-in card, text on dark buttons and on the glaze band.
- **Cream Deep** (`cream-deep`): hover fill for top-nav links. Nowhere else yet.
- **Glaze** (`glaze`): body text, headings, the story band, the active nav pill, the secondary button border, 2px list rules (at 20% for inner dividers, 15% for the app header's bottom edge).
- **Ink** (`ink`): secondary text: leads, subtitles, step bodies, captions, labels on time stamps, idle tab labels, the footer. Passes AA on cream where glaze would be too heavy.

### Named Rules
**The Deep-For-Text Rule.** Terracotta, aegean, olive and red are fills; their `-deep` partner is the text or the only version that may touch cream as a small element. Never set body-size text in a base brand colour on cream.

**The Hairline Gold Rule.** Gold is ornament: strokes of 2–3px (meander, wave, rules, the wordmark ring) and one headline on glaze. It is never a fill, never a button, never body text.

**The One Terracotta Rule.** Terracotta-deep marks the primary action on a screen and the numbered steps leading to it. Two filled terracotta buttons in one viewport is a defect.

## Typography

**Display Font:** Cinzel Bold (local, weight 700 only; with Georgia, serif)
**Body Font:** Atkinson Hyperlegible (local, 400 and 700; with system-ui, sans-serif)
**Label/Mono Font:** none; `code` inherits the sans and wraps anywhere.

**Character:** Roman inscription over a hyperlegible humanist sans. Cinzel does the naming in small-cap-feeling capitals; Atkinson does the explaining at 20px with a generous 1.5 line height. No italics, no light weights.

### Hierarchy
- **Display** (Cinzel 700, 2.5rem phone / 3.4rem tablet / 4rem desktop, line-height 1.08, tracking 0.01em): the landing h1 only, balanced wrap.
- **Headline** (Cinzel 700, 1.9rem phone / 2.4rem desktop): section h2 and page h1 inside the app (`PageTitle`, 2rem / 2.4rem; sign-in, 1.9rem / 2.2rem). Gold when set on the glaze band, glaze everywhere else.
- **Wordmark** (Cinzel 700, 1.15rem, tracking 0.12em, uppercase "PHARMASEE"): beside the gold ring, never larger.
- **Numerals** (Cinzel 700, 2rem, line-height 1, terracotta-deep): the step counters. The one place Cinzel is not a heading.
- **Title** (Atkinson 700, 1.2–1.3rem, tight leading): step titles, medicine names, empty-state titles. Set as `h3` with the sans explicitly, overriding the base heading rule.
- **Lead** (Atkinson 400, 1.2–1.3rem, ink; 1.25–1.5rem cream on glaze): the one sentence under a headline. Max 34ch beside the hero, 58–60ch elsewhere.
- **Body** (Atkinson 400, 1rem = 20px, line-height 1.5, glaze or ink): everything else; max 46–48ch in lists and empty states, `text-wrap: pretty`.
- **Label** (Atkinson 700, 1rem): form labels, links, buttons (1.05rem in buttons), time stamps (0.95rem, wide tracking).
- **Caption** (Atkinson 400, 0.95rem, ink): figure captions, the footer, inline code.
- **Tab label** (Atkinson 700, 0.85rem): the phone tab bar only; the smallest text in the system.

### Named Rules
**The Cinzel Ration Rule.** Cinzel is for h1, h2, the wordmark and the step numerals. Any h3 or smaller is Atkinson Bold. No Cinzel in body, buttons, labels or navigation.

**The Twenty Rule.** The root font size is 20px and nothing user-facing drops below 0.95rem (19px). Inputs are 60px tall. Reduce size by stepping the ramp, never by shrinking the root.

## Layout

A single 72rem (1296px) centred column for every content section, with page gutters that step 1.25rem (phone) / 3rem (tablet) / 5rem (desktop) on the landing and 1.25rem / 2rem inside the app shell. Sections breathe at 4rem vertical on phones and 6rem from the `md` breakpoint; the story band is deeper (5rem / 7rem). Inside a section the rhythm is 0.5rem (label to field, title to sub), 0.75rem (headline to lead), 1.5rem (paragraph to paragraph, field to button), 2.25rem (lead to action), 3–4rem (headline to figure).

The landing is one screen. The artwork `public/art/ulysses-and-argus.jpg` fills the page (`object-cover`, focal point 52% 60%) under a glaze scrim: 55% overall plus a radial 82% pool behind the centered copy, which keeps cream text above 7:1 over the engraving's brightest highlights. A 2px gold frame sits 12px (24px from `md`) inside the page edge with a meander strip inside its top and bottom. Centered in it: the light wordmark, a short running-dog strip, the Cinzel title (2.3rem, 4rem from `md`, 4.6rem from `lg`), one cream sentence, and a single 64px terracotta "Get started". Butler's Odyssey line and the art credit sit at the foot in cream. No other sections.

The onboarding page reuses the artwork under an 80% glaze scrim. A 42rem cream card with a 2px gold border and meander strips inside its top and bottom holds each step; above it, progress is a small terracotta ship moving along a gold wave line toward "Ithaca" (700ms, ease-out-expo, off under reduced motion), with the three step names beneath. A full-width running-dog strip closes the page.

Yes/No questions (such as "Is it taken after a meal?") are two radio tiles, 68px tall, each with a 24px radio and a bold answer plus its meaning ("Yes, after a meal"). The chosen tile takes a terracotta-deep border on a 10% terracotta wash. They sit side by side from `sm` and stack on phones.

Lists read down one rule: the three steps are an ordered list with a 2px glaze rule on top, 2px glaze-at-20% dividers, a 3.5rem numeral column and the text beside it. The day watch is three equal columns on `md` with a horizontal wave behind the markers, and a single column on phones with the wave running vertically down the left.

The signed-in shell is a sticky header (wordmark left, top nav right, meander beneath, cream at 95% with a 2px backdrop blur) over the same 72rem main column. On phones the top nav hides and a fixed four-column tab bar with a 2px gold-at-60% top rule takes the bottom, honouring the safe-area inset; main content keeps 7rem bottom padding to clear it.

Forms live in a single 480px column (the sign-in card) with full-width controls. Breakpoints are Tailwind's: `sm` 640px, `md` 768px, `lg` 1024px.

## Elevation & Depth

Flat. Depth is conveyed by borders and by the one tonal inversion (the glaze band), never by stacked surfaces or ambient shadows. Cards are the same cream as the page, distinguished only by a 2px frame. The informational notice is a 10% aegean tint inside a 2px aegean-at-40% border. The app header is the one translucent surface (cream at 95%, 2px blur) so content scrolling under it stays faintly visible.

### Shadow Vocabulary
- **Primary lift** (`box-shadow: 0 2px 6px -2px rgba(30,26,23,0.35)`): the primary button at rest, so it reads as the one pressable object on a page of flat cream.
- **Primary lift, hover** (`box-shadow: 0 3px 10px -2px rgba(168,74,37,0.45)`): the same lift, warmed and spread slightly, on hover-capable devices only.

### Named Rules
**The One Shadow Rule.** Only the primary button casts a shadow. Cards, inputs, navigation and the header stay flat; if an element needs separation, give it a 2px border or set it on glaze.

## Shapes

Square frames, softly rounded controls, and circles for status. Cards and bands (sign-in card, empty state, the glaze band, list rules) have no radius and 2px borders; a card that carries the meander is framed on three sides with the strip as its top edge. Interactive controls (buttons, inputs, top-nav links, the notice) share one small radius (0.375rem). Dose markers are perfect circles (2.75rem, 3px border). The focus outline is 3px aegean, offset 3px, with a 2px radius so it hugs square and round elements alike.

Borders are always 2px (or 3px on markers), in glaze for structure and gold for ornament; 1px appears only on the footer's top edge and the app header's bottom edge, both in glaze at low opacity. The Greek key itself is a 40x20 tile drawn with a 3px gold stroke, repeated at 28x14px.

## Components

### Buttons
Confident and quiet: a single filled terracotta, a glaze outline, and an underlined link, all 3.5rem tall so they are easy to hit.
- **Shape:** softly rounded (0.375rem), 3.5rem minimum height, 1.75rem horizontal padding, Atkinson Bold 1.05rem, line-height 1.
- **Primary:** terracotta-deep fill, cream text, the primary lift shadow. Full width on phones, intrinsic width from `sm`.
- **Hover / Focus / Active:** on hover-capable devices the fill darkens to terracotta-pressed and the shadow warms; the whole button scales to 0.97 on press; focus uses the global 3px aegean outline. Transitions on background, transform and shadow over 160ms with the expo ease-out.
- **Secondary:** transparent with a 2px glaze border and glaze text; on hover it inverts to glaze fill with cream text.
- **Quiet:** aegean-deep underlined text (underline offset 4px), 3rem tall, 1rem padding, darkens to glaze on hover.
- **Disabled:** 60% opacity, not-allowed cursor; the label changes to a progress verb ("Sending…", "Checking…").

### Cards / Containers
- **Corner Style:** square.
- **Background:** cream, same as the page.
- **Shadow Strategy:** none (see Elevation).
- **Border:** 2px gold at 70% for the framed card (sign-in), with the 14px meander strip as its top edge and the top border removed; 2px gold at 60% for the empty state; 2px glaze rules for lists.
- **Internal Padding:** 1.75rem top, 1.5rem sides, 2rem bottom on phones; 2.25rem sides and 2.5rem bottom from `md`. Empty states: 2.5rem vertical, 1.5rem / 2.5rem horizontal, centred text.

### Inputs / Fields
- **Style:** 2px glaze-at-70% border, white at 60% fill (the only white in the system, there to lift the field off cream), 0.375rem radius, 3rem minimum height, 1rem horizontal padding, 1.1rem text, ink-at-60% placeholder. The visible label sits above in Atkinson Bold with 0.5rem between. The one-time-code field is larger (1.4rem) with 0.35em tracking.
- **Focus:** border turns aegean and a 3px aegean-at-30% ring appears; the default outline is suppressed in favour of the ring.
- **Error:** border turns soft red via `aria-invalid`; the message sits 0.5rem below in red-deep with `role="alert"` and names the recovery.

### Notice
A 10% aegean tint inside a 2px aegean-at-40% border, 0.375rem radius, 1rem padding, ink text with a bold glaze first line. Used for status that is not an error (e.g. "Sign-in is not connected yet").

### Navigation
- **Wordmark:** a 22px gold ring (2.5px stroke) with a glaze centre dot, then "PHARMASEE" in Cinzel 1.15rem at 0.12em tracking, glaze, no underline. Links home.
- **Landing header:** the light wordmark centered at the top of the frame; there is no sign-in link, 1.25rem padding (3rem sides from `md`).
- **Top nav (md and up):** icon (20px) plus label, Atkinson Bold, 3rem tall, 1rem padding, 0.375rem radius, glaze text; hover fills cream-deep; the current page is a glaze pill with cream text (`aria-current="page"`).
- **Tab bar (phones):** fixed bottom, four equal columns, 4rem tall, icon (24px) over a 0.85rem bold label; ink at rest, terracotta-deep when current; cream fill with a 2px gold-at-60% top rule and safe-area padding.
- **Icons:** custom inline SVG, 24- or 32-unit viewBox, 2px round-capped strokes in `currentColor`. No icon font, no third-party set.

### Meander (signature ornament)
The thin gold Greek key: a 14px-tall strip (`.meander`, repeat-x, 28x14 tiles) or a 14px-wide strip (`.meander-v`, repeat-y). It separates the hero from the body, tops and tails the glaze band, underlines the app header, and forms the top edge of the framed card. Always `aria-hidden`. The second ornament is the running-dog wave (`.running-dog`, 24px tall, 48x24 gold tiles), the classical scroll named for a running hound; it closes the landing hero and tops and tails the "Why Argos" band. The laurel and column assets are not in the build.

The one raster is `public/art/ulysses-and-argus.jpg`: the 1885 Stacpoole engraving after Briton Rivière, public domain, tinted in a three-stop glaze, terracotta-deep and cream duotone so it reads as red-figure ware. Its source is embedded in the file. Always shown with its caption.

### Day Watch (signature component)
Three dose markers along one gold wave (3px stroke, round caps). A marker is a 2.75rem circle with a 3px border: olive fill with a cream check (taken), soft red fill with a cream alert (missed), cream fill with a glaze border and clock (upcoming). Above each marker a bold 0.95rem time stamp in ink; beside it the medicine name in Atkinson Bold 1.2rem and a note in the state's deep colour (olive-deep, red-deep, ink). Horizontal on `md`, vertical down the left on phones. The wave draws once (1200ms, 250ms delay) and markers settle in at 450ms + 140ms each; both are static under reduced motion. Always captioned "Example day" when the data is illustrative.

### Page Title
Headline Cinzel (2rem / 2.4rem) with an optional ink subtitle 0.25rem below and 2rem below the pair. Plain label first, theme second.

### Motion
One easing, `--ease-out-expo` (`cubic-bezier(0.16, 1, 0.3, 1)`). The landing hero uses `.rise` (900ms, 12px lift, staggered 90ms), the day watch uses `.draw` and `.settle`; all are wrapped in `prefers-reduced-motion: no-preference`. Button state transitions run 160ms. Nothing else animates.

## Do's and Don'ts

### Do:
- **Do** keep the page cream and reserve glaze fills for one story band per page, topped and tailed by the meander.
- **Do** set every text link in aegean-deep bold, and every error in red-deep with a recovery sentence.
- **Do** use the `-deep` variant whenever a brand colour becomes text or a small mark on cream.
- **Do** give every control at least 3rem height (buttons 3.5rem), a visible label above, and the 3px aegean focus outline.
- **Do** structure with 2px rules (glaze for lists, gold for ornament) and square frames; round only controls (0.375rem) and status markers (circles).
- **Do** keep one filled terracotta-deep button per viewport and let "Sign in" be a quiet link beside it.
- **Do** wrap every entrance animation in `prefers-reduced-motion: no-preference` and use the expo ease-out.

### Don't:
- **Don't** set Cinzel below h2 (except the step numerals and the wordmark), or use it in buttons, labels or navigation.
- **Don't** add shadows to cards, inputs, nav or headers; the primary button is the only element that lifts.
- **Don't** fill anything with gold or set gold body text; gold is a 2–3px stroke or a headline on glaze.
- **Don't** introduce white surfaces, grey chrome, parchment textures or fake-ancient body fonts; cream and glaze are the whole material.
- **Don't** use base terracotta, aegean, olive or red as text on cream.
- **Don't** replace the custom stroke icons with an icon font or a third-party set, or add glyphs that are not in `Icons.tsx`.
- **Don't** add a second ornament (laurel, column, vase texture) without a system change; the build carries only the meander and the wave.
