-- Run in the Supabase SQL editor (safe to run again).
-- Doctor appointments for each patient, shown and edited on the web dashboard (/dashboard/{id}/appointments).
-- The web app writes with the service role, so RLS below only matters for future signed-in clients.

create table if not exists public.doctor_appointments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users (id) on delete cascade,
  doctor_name  text not null,
  specialty    text,                                  -- "Cardiology", "Family medicine"
  location     text,                                  -- clinic name or address
  scheduled_at timestamptz not null,                  -- entered on the wall clock of users.timezone
  status       text not null default 'scheduled',
  notes        text,                                  -- "Bring blood pressure log", "Fasting 8h before"
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.doctor_appointments drop constraint if exists doctor_appointments_status_check;
alter table public.doctor_appointments add constraint doctor_appointments_status_check
  check (status in ('scheduled', 'completed', 'cancelled', 'missed'));

create index if not exists doctor_appointments_user_time_idx
  on public.doctor_appointments (user_id, scheduled_at);

-- Keep updated_at current on every edit.
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists doctor_appointments_touch on public.doctor_appointments;
create trigger doctor_appointments_touch before update on public.doctor_appointments
  for each row execute function public.touch_updated_at();

-- Row Level Security: same own-row rule as 004_web_app.sql.
alter table public.doctor_appointments enable row level security;

drop policy if exists "appointments: own rows" on public.doctor_appointments;
create policy "appointments: own rows" on public.doctor_appointments
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Make the new table visible to the REST API right away.
notify pgrst, 'reload schema';

-- Check:
select count(*) from public.doctor_appointments;
