-- PROPOSED, NOT YET APPLIED. See web/NOTES.md. Run in the Supabase SQL editor after review.
-- Safe to run again (idempotent).

-- 1. Columns the web app writes and the agent may read.
alter table public.user_medications add column if not exists photo_path text;   -- 'medication-photos/{user_id}/{medication_id}.jpg'
alter table public.user_medications add column if not exists appearance text;   -- "orange bottle, white cap, small round white pills"
alter table public.users add column if not exists family_name text;             -- so Argos can say "Calling Minh now"

-- 2. Row Level Security: each signed-in user sees and edits only their own rows.
alter table public.users enable row level security;
alter table public.user_medications enable row level security;
alter table public.dose_logs enable row level security;

drop policy if exists "users: own row" on public.users;
create policy "users: own row" on public.users
  for all to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists "medications: own rows" on public.user_medications;
create policy "medications: own rows" on public.user_medications
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- dose_logs are read-only in the web app; the agent writes them with the service role (bypasses RLS).
drop policy if exists "dose_logs: read own" on public.dose_logs;
create policy "dose_logs: read own" on public.dose_logs
  for select to authenticated
  using (exists (
    select 1 from public.user_medications m
    where m.id = dose_logs.medication_id and m.user_id = (select auth.uid())
  ));

create index if not exists user_medications_user_id_idx on public.user_medications (user_id);
create index if not exists dose_logs_medication_id_idx on public.dose_logs (medication_id, scheduled_at desc);

-- 3. Private storage bucket for bottle photos, one folder per user.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('medication-photos', 'medication-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "photos: own folder read" on storage.objects;
create policy "photos: own folder read" on storage.objects
  for select to authenticated
  using (bucket_id = 'medication-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "photos: own folder write" on storage.objects;
create policy "photos: own folder write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'medication-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "photos: own folder update" on storage.objects;
create policy "photos: own folder update" on storage.objects
  for update to authenticated
  using (bucket_id = 'medication-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "photos: own folder delete" on storage.objects;
create policy "photos: own folder delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'medication-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
