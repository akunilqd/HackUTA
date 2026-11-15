// Tells the patient's family (users.family_phone_number) by iMessage what happened with each dose.
// Text only. Fire-and-forget: a failed message is logged and never disturbs the call or the record.
import { supabase } from './db.mjs';
import { getLine, sendMessage } from './chert.mjs';

/** Statuses the family hears about. calling / pending are internal steps and stay silent. */
export const NOTIFY_STATUSES = new Set(['taken', 'wrong_medication_flagged', 'unconfirmed', 'missed_no_answer']);

const RETRY_MS = 30_000;
const enabled = () => String(process.env.FAMILY_NOTIFY ?? 'on').toLowerCase() !== 'off';

const clock = (iso, timeZone) => new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

/** One sentence per status. No pronouns: the patient's gender is not on record. */
const LINES = {
  taken: (name, meds, at, tz) => `${name} took ${meds} at ${clock(at, tz)}.`,
  wrong_medication_flagged: (name, meds) => `${name} showed a medication that did not match ${meds}. The dose was not confirmed. Please check in.`,
  unconfirmed: (name, meds) => `${meds} not confirmed: the call ended before ${name} said it was taken. Please check in.`,
  missed_no_answer: (name, meds) => `${name} did not answer the reminder for ${meds}. Please check in.`,
};

/** Pure: turns doses that just changed to `status` into the message text. */
export function buildMessage({ status, patientName, timezone, doses, takenAt }) {
  const meds = doses.map(d => `${d.name} (${d.dosage})`).join(' and ');
  return `PharmaSee: ${LINES[status](patientName, meds, takenAt ?? new Date().toISOString(), timezone)}`;
}

async function loadFamilyContext(ids) {
  const { data, error } = await supabase
    .from('dose_logs')
    .select('id, taken_at, user_medications(name, dosage, users(id, name, timezone, family_phone_number))')
    .in('id', ids);
  if (error) throw new Error(`family context: ${error.message}`);
  return data;
}

async function deliver(rows, status) {
  const withPhone = rows.filter(r => r.user_medications?.users?.family_phone_number);
  // One message per patient, covering all of that patient's doses that changed together.
  const byPatient = Map.groupBy(withPhone, r => r.user_medications.users.id);
  const line = await getLine();
  for (const group of byPatient.values()) {
    const user = group[0].user_medications.users;
    const text = buildMessage({
      status, patientName: user.name, timezone: user.timezone,
      doses: group.map(r => r.user_medications), takenAt: group[0].taken_at,
    });
    const send = () => sendMessage({
      lineId: line.id, recipient: user.family_phone_number, text,
      idempotencyKey: `family-${status}-${group.map(r => r.id).sort().join(',')}`,
    });
    try {
      await send();
      console.log(`[family] sent "${status}" update for ${group.length} dose(s)`);
    } catch (error) {
      console.error(`[family] send failed (${error.code ?? error.message}); retrying in ${RETRY_MS / 1000}s`);
      await new Promise(resolve => setTimeout(resolve, RETRY_MS));
      await send().then(
        () => console.log(`[family] sent "${status}" update on retry`),
        retryError => console.error(`[family] gave up: ${retryError.code ?? retryError.message}`),
      );
    }
  }
}

/** Call after doses actually changed to `status`. Never throws, never blocks. */
export function notifyFamily(ids, status) {
  if (!enabled() || !NOTIFY_STATUSES.has(status) || !ids.length) return;
  void loadFamilyContext(ids)
    .then(rows => deliver(rows, status))
    .catch(error => console.error(`[family] ${error.message}`));
}
