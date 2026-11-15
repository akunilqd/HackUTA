-- Run in the Supabase SQL editor (safe to run again).
-- Adds whether each medication is taken after a meal:
--   'Yes'  take after eating
--   'No'   take before eating
alter table user_medications drop constraint if exists user_medications_meal_timing_check;
alter table user_medications drop column if exists meal_timing;   -- the earlier four-value version, if it was run

alter table user_medications add column if not exists after_meal text not null default 'No';

alter table user_medications drop constraint if exists user_medications_after_meal_check;
alter table user_medications add constraint user_medications_after_meal_check
  check (after_meal in ('Yes', 'No'));

comment on column user_medications.after_meal is
  'Yes = take after a meal, No = take before a meal.';

-- Demo patient's medications: Metformin is taken after a meal; set Bandson from its label or prescription.
update user_medications set after_meal = 'Yes' where name ilike 'metformin%';
-- update user_medications set after_meal = 'Yes' where name ilike 'bandson%';

-- Check:
select name, dosage, after_meal from user_medications order by name;
