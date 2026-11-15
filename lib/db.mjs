import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const OPEN = ['pending', 'missed_no_answer', 'unconfirmed'];

const fail = (what, error) => { throw new Error(`${what}: ${error.message}`); };

/** Wall-clock parts of `date` in an IANA timezone. */
export function zonedParts(date, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date).map(p => [p.type, p.value]));
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hhmm: `${parts.hour}:${parts.minute}`, parts };
}

/** The UTC instant at which `day` (YYYY-MM-DD) + `hhmm` happens on the wall clock of `timeZone`. */
export function zonedInstant(day, hhmm, timeZone) {
  const guess = new Date(`${day}T${hhmm}:00Z`);
  const { parts } = zonedParts(guess, timeZone);
  const shown = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return new Date(guess.getTime() - (shown - guess.getTime()));
}

/** Active medications whose reminder time is right now in the patient's own timezone. */
export async function getDueMedications(now = new Date()) {
  const { data, error } = await supabase
    .from('user_medications')
    .select('id, user_id, name, dosage, reminder_times, start_date, end_date, users(id, name, phone, timezone)');
  if (error) fail('getDueMedications', error);
  const due = [];
  for (const med of data) {
    const user = med.users;
    if (!user?.phone) continue;
    const { day, hhmm } = zonedParts(now, user.timezone);
    if (med.start_date > day || (med.end_date && med.end_date < day)) continue;
    for (const time of med.reminder_times ?? []) {
      if (time.slice(0, 5) === hhmm) due.push({ med, user, scheduledAt: zonedInstant(day, hhmm, user.timezone) });
    }
  }
  return due;
}

/** Inserts missing dose_logs; returns only the rows created now. */
export async function createDoseLogs(rows) {
  if (!rows.length) return [];
  const { data, error } = await supabase
    .from('dose_logs')
    .upsert(rows, { onConflict: 'medication_id,scheduled_at', ignoreDuplicates: true })
    .select();
  if (error) fail('createDoseLogs', error);
  return data;
}

export async function getDoseContext(doseLogIds) {
  const { data, error } = await supabase
    .from('dose_logs')
    .select('id, status, scheduled_at, user_medications(id, name, dosage, users(id, name, phone, timezone))')
    .in('id', doseLogIds);
  if (error) fail('getDoseContext', error);
  return data;
}

/** Doses of the last 24 hours that still need the patient's attention. */
export async function getOpenDoses(userId) {
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data, error } = await supabase
    .from('dose_logs')
    .select('id, status, scheduled_at, user_medications!inner(id, name, dosage, user_id, users(id, name, phone, timezone))')
    .eq('user_medications.user_id', userId)
    .in('status', OPEN)
    .gte('scheduled_at', since)
    .order('scheduled_at');
  if (error) fail('getOpenDoses', error);
  return data;
}

/** Doses scheduled in the last `windowMinutes` that nobody has started calling about yet. */
export async function getPendingDoses(windowMinutes = 15) {
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  const { data, error } = await supabase
    .from('dose_logs')
    .select('id, status, scheduled_at, user_medications!inner(id, name, dosage, user_id, users(id, name, phone, timezone))')
    .eq('status', 'pending')
    .lte('scheduled_at', new Date().toISOString())
    .gte('scheduled_at', since);
  if (error) fail('getPendingDoses', error);
  return data;
}

/** Pending doses older than the retry window: the reminder never went out. */
export async function getStalePendingDoses(windowMinutes = 15) {
  const before = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  const { data, error } = await supabase
    .from('dose_logs')
    .select('id, user_medications!inner(name, users(name, phone))')
    .eq('status', 'pending')
    .lt('scheduled_at', before);
  if (error) fail('getStalePendingDoses', error);
  return data;
}

export async function getDoseStatuses(ids) {
  const { data, error } = await supabase.from('dose_logs').select('id, status').in('id', ids);
  if (error) fail('getDoseStatuses', error);
  return data;
}

export async function setDoseStatus(ids, status, { takenAt } = {}) {
  const patch = { status, ...(takenAt ? { taken_at: takenAt } : {}) };
  const { error } = await supabase.from('dose_logs').update(patch).in('id', [].concat(ids));
  if (error) fail('setDoseStatus', error);
}
