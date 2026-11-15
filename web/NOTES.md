# Pharmasee web app — notes (F1)

## What I found in the repo

- **No web frontend existed.** `HackUTA/ui/` is a Python sidecar that renders the agent's *video face* for FaceTime (scenes, captions, clips), not a website. The top-level `Documents/*.html` files belong to a different project (Goodminton/strung).
- **Backend:** Node 22 ESM in `HackUTA/`. `agent.mjs` (LiveKit + Gemini voice agent), `scheduler.mjs` (cron: creates `dose_logs` rows and places outbound Chert calls), `lib/db.mjs` (all Supabase access), `lib/vision.mjs` (reads the label text off camera frames with Gemini; it does **not** compare against a reference photo today), `seed.mjs` (demo patient "Margaret" + two medications via `auth.admin.createUser`).
- **Supabase connection:** `lib/db.mjs` uses `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from `.env.local`. On this machine `.env.local` still holds the `your_project.supabase.co` placeholder, so I **could not introspect the live schema, RLS, or storage**. Everything below is based on the plan + the two SQL files in `supabase/`.
- **No HTTP server in the backend.** There is no `/demo/call` endpoint; `call-me.mjs` / `place-call-setup.mjs` are CLI scripts. The "Call now" button (F3) needs a tiny endpoint added to the backend, or a Next.js route handler that calls Chert directly with a server-side `CHERT_API_KEY`. Decide at F3.
- **Statuses the agent writes** (`supabase/002_dose_status.sql`): `pending, taken, missed, skipped, calling, unconfirmed, missed_no_answer, wrong_medication_flagged`. A DB check also requires `taken_at` only with `status = 'taken'`. The plan's `corrected` / `escalated` do not exist.
- `users.id = auth.users.id` (seed creates an auth user first), which fits magic-link sign-in: the signed-in family member *is* the `users` row. Note that this means the **row represents the patient but is owned by whoever signs in**; one account = one patient for now.
- Assets: `ui/assets/video/*.mp4` (720×1280 portrait loops of Argos), fonts (Atkinson Regular/Bold, Cinzel Bold), ornament SVGs. Per your request the web app no longer uses the dog video or a photo; the hero uses public-domain Odyssey art (see below).

## What I built (F1)

`HackUTA/web/` — Next.js 16 (App Router, `src/`), TypeScript, Tailwind v4, `@supabase/ssr`, React Hook Form + Zod, Playwright for screenshots.

- Design tokens in `src/app/globals.css` (`@theme`): the Ithaca palette plus `*-deep` variants used only where the brand colour fails WCAG AA on cream (terracotta 3.3:1 → `terracotta-deep` #A84A25 at 4.7:1 for button fills; olive/red/aegean deep variants for text). Fonts self-hosted via `next/font/local`; 20px base (raised from 18px for readability), inputs 60px tall.
- Greek-key meander as a CSS background tile (`.meander`, `.meander-v`), used as the single ornament.
- `/` landing (owner request, 2026-11-15): one screen. The "Ulysses and Argus" engraving (Stacpoole after Rivière, 1885, public domain, tinted terracotta like red-figure ware) fills the background under a glaze scrim, a gold Greek-key frame runs around the page, and the centered title, one sentence and a single "Get started" button sit in the middle, with Butler's Odyssey line at the foot. One authored entrance animation.
- Brand: the site is **Pharmasee**; Argos stays as the watchdog persona in copy ("Argos watches over the ones you love").
- **No login (owner request, 2026-11-15).** The form posts to `/api/onboarding`, which saves on the server with `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (server-only env, never sent to the browser). It creates an `auth.users` row with a placeholder email for each family, then the `users` row and the `user_medications` rows, and undoes everything if a step fails. No anon key, anonymous sign-ins, or RLS changes are needed. Verified on 2026-11-15 against the real project: one test patient saved with every column correct, then deleted.
- `/onboarding`: three steps over the dimmed artwork, progress drawn as a ship sailing to Ithaca. Field-to-column mapping is in README.md. `after_meal` is stored as `"Yes"` / `"No"`, which is what the table's check constraint allows.
- **`after_meal` (text, required, check constraint `"Yes"`/`"No"`):** asked per medicine. The backend does not read it yet; if the agent should say it on the call, `lib/dose-session.mjs` needs to load it.
- `src/proxy.ts` (Next 16's middleware) refreshes the session cookie and sends visitors without one from `/home /medicines /history /settings` back to `/`.
- `(app)/layout.tsx`: signed-in shell (top nav on desktop, tab bar on phones). Redirects to `/onboarding` when the `users` row is missing. The four pages are honest placeholders until F2/F3.
- `src/lib/database.types.ts` is hand-written; regenerate with `supabase gen types` once credentials exist.

## Proposed schema changes — NOT applied, waiting for your go-ahead

`supabase/004_web_app.sql`:

1. `user_medications.photo_path text`, `user_medications.appearance text`, `users.family_name text`.
2. Enable RLS on all three tables with own-row policies (`dose_logs` read-only for the web; the agent's service role bypasses RLS).
3. Private bucket `medication-photos` with per-user folder policies.

Risk check: the backend uses the service role, so RLS does not affect it. If RLS is already on with different policies, tell me and I will adapt instead of replacing them.

## Questions for you

1. **Supabase credentials:** done. `web/.env.local` has `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (server-only). The backend's own `HackUTA/.env.local` still holds placeholders.
2. **OK to run the migration above?** And is RLS currently on or off? If RLS is on with no policies, saving will fail with a clear message until the policies exist. The three new columns in it are optional; the form only writes the columns in your current schema.
3. Should the backend start using `photo_path` / `appearance`? Today `lib/vision.mjs` only reads label text. I will not touch the backend unless you say so.
4. "Call now" at F3: add `POST /demo/call` to the backend, or let the web app call Chert directly from a server route?
5. Spelling: I used "Pharmasee". The agent prompt in the backend says "PharmaSee". Tell me which one is right.

## Run

```sh
cd HackUTA/web
cp .env.example .env.local   # fill SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
npm run dev                  # http://localhost:3000
npm run shots                # Playwright screenshots at 1440 and 390 into .impeccable/review/
```
