-- Run in the Supabase SQL editor (safe to run again). Replaces dose_logs_status_check with:
--   your original values:  pending, taken, missed, skipped
--   reminder-call states:  calling, unconfirmed, missed_no_answer, wrong_medication_flagged
-- A dose the patient confirmed is stored as 'taken', because the table's other check (dose_logs_check)
-- only allows taken_at to be set together with status 'taken'.
alter table dose_logs drop constraint if exists dose_logs_status_check;
alter table dose_logs add constraint dose_logs_status_check check (status in (
  'pending', 'taken', 'missed', 'skipped',
  'calling', 'unconfirmed', 'missed_no_answer', 'wrong_medication_flagged'
));
