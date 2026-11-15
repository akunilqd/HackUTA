# PharmaSee

An AI medication-reminder system: it phones the patient over FaceTime, checks that they hold the right
medicine, and logs the dose. Families set the patient up on the website.

```
HackUTA/
├─ my-agent/   Backend (Node): voice agent, scheduler, Supabase access, Chert/LiveKit calls
├─ web/        Frontend (Next.js): landing page and onboarding, saves to Supabase
├─ supabase/   Database SQL, run by hand in the Supabase SQL editor, in number order
├─ docs/       SYSTEM_DESIGN.md (architecture), PLAN.md (backend build plan)
├─ DESIGN.md   Visual system for the website
└─ PRODUCT.md  Product brief for the website
```

## How the parts connect

```
web (onboarding form) ──POST /api/onboarding──▶ Supabase ◀── my-agent/scheduler.mjs (every minute)
                         service role, server-only    │              │ creates dose_logs, places the call
                                                      │              ▼
                                                      └──── my-agent/agent.mjs ◀── Chert ◀── FaceTime
                                                            (Gemini voice; writes dose_logs status)
```

Both sides use the same Supabase project and the same `users`, `user_medications` and `dose_logs` tables.

## Run it

Backend (see `my-agent/README.md` for Chert and LiveKit setup):

```sh
cd my-agent
npm install
# create .env.local with the LiveKit, Gemini, Chert and Supabase keys (see my-agent/README.md)
npm run seed                    # demo patient
npm start                       # agent
npm run scheduler               # reminders (second terminal)
```

Frontend:

```sh
cd web
npm install
cp .env.example .env.local      # SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, the same values as the backend
npm run dev                     # http://localhost:3000
```

## Database

Run the files in `supabase/` once, in order. All are safe to run again.

| File | What it does | Used by |
|---|---|---|
| `001_pharmasee.sql` | `users.phone`, unique `(medication_id, scheduled_at)` on `dose_logs` | backend |
| `002_dose_status.sql` | extra `dose_logs.status` values for reminder calls | backend |
| `003_meal_timing.sql` | `user_medications.after_meal` (`Yes` / `No`) | backend and web |
| `004_web_app.sql` | optional: photo and family-name columns, RLS, photo bucket. **Proposed, not applied.** | later web pages |

Each side keeps its own `.env.local` (git-ignored). The web app only needs the two Supabase values.
