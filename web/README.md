# Pharmasee web

The family-facing website for Pharmasee (the Argos agent). A family opens the landing page, presses
**Get started**, and fills in three steps: the person Argos calls, a family contact, and their medicines.
The answers are saved straight into the same Supabase tables the agent reads. There is no login.

## Run it

```sh
cd web
npm install
cp .env.example .env.local   # fill SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (same as the backend)
npm run dev                  # http://localhost:3000
```

`.env.local` is git-ignored. Never commit it.

## How it connects to the backend

The form posts to `POST /api/onboarding` (`src/app/api/onboarding/route.ts`). That route runs on the
server with the service-role key, so no Supabase settings need changing (no anon key, no anonymous
sign-ins, RLS does not matter). For each family it:

1. creates an `auth.users` row with a placeholder email `family-<uuid>@pharmasee.local` (`users.id`
   references `auth.users`, the same way `seed.mjs` does it);
2. inserts one `users` row;
3. inserts one `user_medications` row per medicine.

If step 3 fails, steps 1 and 2 are undone, so no half-saved patients are left behind.

| Form field | Column | Stored as |
| --- | --- | --- |
| Their name | `users.name` | text |
| Their iPhone number | `users.phone` | E.164, US default: `(214) 555-0134` → `+12145550134` |
| Their time zone | `users.timezone` | IANA name, defaults to the browser's |
| Date of birth | `users.date_of_birth` | `YYYY-MM-DD` or null |
| Height (ft, in) / weight (lb) | `users.height_cm`, `users.weight_kg` | converted, 1 decimal, or null |
| Family phone number | `users.family_phone_number` | E.164 or null |
| Medicine name / dosage | `user_medications.name`, `.dosage` | text |
| Reminder times | `user_medications.reminder_times` | `time[]`, sorted, no duplicates, in the patient's time zone |
| Start / end date | `user_medications.start_date`, `.end_date` | end date after start, or null |
| Is it taken after a meal? | `user_medications.after_meal` | `"Yes"` or `"No"` (matches the table's check constraint) |

The success screen shows the new `users.id` as a "Reference number". Put it in the backend's
`DEMO_USER_ID` to make inbound demo calls use that patient. The scheduler picks up the new
medicines on its own, because `getDueMedications()` reads every `user_medications` row.

**For the demo:** the iPhone number must be one Chert can call (a verified number), and the scheduler
calls at each reminder time, so use your own phone and a time a few minutes ahead.

## Dashboard (`/dashboard`)

The **Open dashboard** button next to **Get started** opens a list of every patient. Each patient has four
tabs, all readable and editable:

| Tab | Route | Table | Edits |
| --- | --- | --- | --- |
| Patient profile | `/dashboard/{id}/profile` | `users` | name, phone, time zone, birth date, height, weight, family contact |
| Prescriptions | `/dashboard/{id}/prescriptions` | `user_medications` | add, edit, delete medicines and reminder times |
| Dose history | `/dashboard/{id}/history` | `dose_logs` | change a status, log a dose by hand, delete an entry (7/30/90-day range) |
| Appointments | `/dashboard/{id}/appointments` | `doctor_appointments` | add, edit, delete doctor visits |

Edits are Server Actions in `src/app/dashboard/actions.ts`. They use the same service-role key as
onboarding, and each one checks that the row belongs to the patient in the URL. Times are shown and
entered on the patient's own clock (`users.timezone`).

`doctor_appointments` is new: run `../supabase/005_doctor_appointments.sql` once in the Supabase SQL
editor. Until then the Appointments tab says so instead of failing.

**No login:** anyone who can open the site can see and change every patient. That is fine for the
hackathon demo; put a passcode or real sign-in in front of `/dashboard` before real patients use it.

## Deploy (Vercel)

Set the root directory to `web` and add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as environment
variables. The `/api/onboarding` route is public, which is fine for a hackathon demo; add a rate limit
or a shared passcode before real use.

## Where things are

- `src/app/page.tsx`: the landing page.
- `src/app/onboarding/`: the three-step form (client) and its page.
- `src/app/api/onboarding/route.ts`: the server save.
- `src/lib/onboarding.ts`: validation rules shared by the form, the server and the dashboard.
- `src/app/dashboard/`: the dashboard pages and their Server Actions; `src/components/dashboard/`: its forms.
- `public/art/ulysses-and-argus.jpg`: the hero art, Frederick Stacpoole's 1885 engraving after Briton
  Rivière (public domain, Wikimedia Commons / British Museum 2010,7081.6046), tinted to the palette.
- `NOTES.md`: design and build notes. `../DESIGN.md`: the visual system.

Checks: `npx tsc --noEmit`, `npx eslint src`, `npm run build`. Screenshots of every step at 1440 and
390 wide: `npm run shots` (Playwright).
