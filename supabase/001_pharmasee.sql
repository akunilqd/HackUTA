-- Run once in the Supabase SQL editor.
alter table users add column if not exists phone text; -- E.164, must be a number verified with Chert
create unique index if not exists dose_logs_med_time on dose_logs (medication_id, scheduled_at);
