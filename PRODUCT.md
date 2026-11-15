# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js (App Router) + TypeScript, Tailwind CSS, Supabase (`@supabase/ssr`, email OTP / magic link), React Hook Form + Zod, deployed to Vercel. Pinned by the owner's plan (ARGOS_FRONTEND_PLAN.md).

## Users

Adult children (and sometimes other family caregivers) setting up medication reminders for an elderly parent, typically on a phone or laptop in a spare moment, often anxious and not technical. Secondary: the older person themselves, who may read the dashboard. (Inferred from the owner's plan; not interviewed.)

## Product Purpose

ARGOS is an AI agent that FaceTimes an elderly person at medication time (through Chert), checks on camera that they hold the right bottle, confirms the dose, and tells the family. This web app is where the family enters what the agent needs (the person, the family contact, medicines, reminder times, bottle photos) and where they read the dose history the agent writes. Success: a family finishes setup in minutes without confusion, and can see at a glance whether today's doses were taken.

## Positioning

The only reminder that places a live video call and verifies the bottle visually, instead of sending a notification nobody answers. The Odyssey frame: Argos, the dog who waited twenty years and still recognized Odysseus.

## Operating Context

- Backend: Node agent in this repo (`agent.mjs`, `scheduler.mjs`, `lib/db.mjs`) reads Supabase with the service role; the web app saves through its own server route with the same service-role key (server-only).
- Tables: `users`, `user_medications`, `dose_logs` (agent-written). Statuses the agent writes: pending, taken, missed, skipped, calling, unconfirmed, missed_no_answer, wrong_medication_flagged.
- Live demo at a hackathon: a "Call now" button may trigger a demo call.

## Capabilities and Constraints

- Pages: one-screen landing with a single "Get started", 3-step onboarding with no login (saved server-side), home dashboard (today timeline, week), medicines CRUD with bottle photo, dose history, settings.
- Never expose the service role key. Do not change agent tables beyond approved migrations.
- Times are wall-clock in the patient's timezone; phones in E.164.
- Copy rule: plain label first, theme second ("Medicines", subtitle "The remedies Argos guards each day"; button "Add medicine").
- Undecided: whether the backend will consume `photo_path` / `appearance` (today it reads label text with Gemini and uses no reference photo).

## Brand Commitments

Name: Pharmasee (the web app and service); Argos is the watchdog persona of the agent. Theme: The Odyssey (Ithaca), carried by look and small copy touches, never by confusing labels. Binding visuals from the owner: palette cream #F3E9D2, glaze #1E1A17, terracotta #C8643B, aegean #2E6E9E, gold #D4A64A, olive #6B8E4E, soft red #B5483A; Cinzel for titles only, Atkinson Hyperlegible for everything else at a 20px base (owner asked for larger, easier text on 2026-11-15); thin gold Greek-key borders; red-figure vase texture sparingly; calm flat surfaces; no parchment textures or fake-ancient body fonts. Original visuals or public-domain classical art. On 2026-11-15 the owner asked to replace the real dog video with Odyssey artwork in the manner of Rivière's "Ulysses and Argus" and to make the Odyssey theme stand out more.

## Evidence on Hand

- Hero art: `web/public/art/ulysses-and-argus.jpg`, Frederick Stacpoole's 1885 engraving after Briton Rivière (Wikimedia Commons, British Museum 2010,7081.6046), public domain, tinted to the palette.
- Quote: Homer, Odyssey Book XVII, Samuel Butler translation (public domain, Project Gutenberg #1727).
- Video loops of Argos (`ui/assets/video/*.mp4`) belong to the FaceTime UI and are no longer used on the web.
- Fonts: `ui/assets/fonts/` (Atkinson Hyperlegible Regular/Bold, Cinzel Bold). Ornaments: `ui/assets/svg/` (meander, wave, laurel, column).
- No testimonials, customers, or metrics exist; do not invent any.

## Product Principles

1. Clarity beats decoration; the theme is a layer, not a puzzle.
2. One careful setup, then calm: the dashboard answers "did Mom take her pills?" in one glance.
3. Forgiving data entry: defaults (today, browser timezone, US phone), visible labels, plain errors.
4. The agent's truth is read-only here: dose history is displayed, never edited.

## Accessibility & Inclusion

WCAG AA minimum, AAA for body text where possible. Inputs at least 48px tall, visible labels (never placeholder-only), full keyboard support, reduced-motion respected. Readers may be older adults with low vision.
