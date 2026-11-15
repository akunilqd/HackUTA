// Creates the demo patient and two medications due in a few minutes.
// Usage: npm run seed -- +1XXXXXXXXXX [minutesFromNow=3]
import { supabase, zonedParts } from './lib/db.mjs';

const phone = process.argv[2];
const minutes = Number(process.argv[3] ?? 3);
if (!phone?.startsWith('+')) { console.error('Usage: npm run seed -- +1XXXXXXXXXX [minutesFromNow]'); process.exit(1); }

const timezone = 'America/Chicago';
const email = 'demo-patient@pharmasee.local';

let userId;
const created = await supabase.auth.admin.createUser({ email, password: crypto.randomUUID(), email_confirm: true });
if (created.error) {
  const { data: list, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  userId = list.users.find(u => u.email === email)?.id;
  if (!userId) throw created.error;
} else {
  userId = created.data.user.id;
}

const check = async (what, { error }) => { if (error) throw new Error(`${what}: ${error.message}`); };

await check('users', await supabase.from('users').upsert({ id: userId, name: 'Margaret', timezone, phone, date_of_birth: '1944-03-12' }));

const at = zonedParts(new Date(Date.now() + minutes * 60_000), timezone);
const reminder = `${at.hhmm}:00`;
const today = at.day;

await check('clean', await supabase.from('user_medications').delete().eq('user_id', userId));
await check('medications', await supabase.from('user_medications').insert([
  { user_id: userId, name: 'Lisinopril', dosage: '1 tablet (10 mg)', reminder_times: [reminder], start_date: today },
  { user_id: userId, name: 'Metformin', dosage: '2 tablets (500 mg each)', reminder_times: [reminder], start_date: today },
]));

console.log(`Seeded patient ${userId}. Medications are due at ${at.hhmm} (${timezone}).`);
console.log(`Add this to .env.local:  DEMO_USER_ID=${userId}`);
