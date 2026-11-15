// Talks to the my-agent worker straight through LiveKit (mic + webcam in the browser), with no Chert and no FaceTime.
// Run (from my-agent/): npm run harness   then open http://localhost:5174. Reads credentials from ../.env.local.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { AccessToken, AgentDispatchClient, RoomServiceClient } from 'livekit-server-sdk';
import { supabase } from '../lib/db.mjs';

const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, DEMO_USER_ID } = process.env;
const AGENT_NAME = process.env.AGENT_NAME || 'my-agent';
const PORT = 5174;

for (const [name, value] of Object.entries({ LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, DEMO_USER_ID })) {
  if (!value) { console.error(`Missing ${name}; run it with npm run harness from my-agent/ (loads .env.local).`); process.exit(1); }
}

let testDoseIds = [];
let testRoom;

const rooms = new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

async function cleanup() {
  if (testDoseIds.length) await supabase.from('dose_logs').delete().in('id', testDoseIds);
  testDoseIds = [];
  if (testRoom) await rooms.deleteRoom(testRoom).catch(() => {});
  testRoom = undefined;
}

async function startSession() {
  await cleanup();
  const { data: meds, error } = await supabase.from('user_medications').select('id, name').eq('user_id', DEMO_USER_ID);
  if (error) throw error;
  if (!meds.length) throw new Error('The demo patient has no medications. Run `npm run seed` in my-agent first.');

  // Status "calling" keeps the scheduler (which only picks up "pending") away from these rows.
  const scheduledAt = new Date().toISOString();
  const { data: doses, error: insertError } = await supabase
    .from('dose_logs')
    .insert(meds.map(med => ({ medication_id: med.id, scheduled_at: scheduledAt, status: 'calling' })))
    .select('id');
  if (insertError) throw insertError;
  testDoseIds = doses.map(d => d.id);

  testRoom = `test-${Date.now()}`;
  await new AgentDispatchClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET).createDispatch(testRoom, AGENT_NAME, {
    metadata: JSON.stringify({ userId: DEMO_USER_ID, doseLogIds: testDoseIds }),
  });
  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity: `tester-${Date.now()}`, ttl: 1800 });
  token.addGrant({ roomJoin: true, room: testRoom, canPublish: true, canSubscribe: true });
  return { url: LIVEKIT_URL, token: await token.toJwt(), room: testRoom };
}

async function doseStatuses() {
  if (!testDoseIds.length) return [];
  const { data, error } = await supabase
    .from('dose_logs').select('id, status, taken_at, user_medications(name, dosage)').in('id', testDoseIds);
  if (error) throw error;
  return data.map(d => ({ name: d.user_medications.name, dosage: d.user_medications.dosage, status: d.status, takenAt: d.taken_at }));
}

const send = (res, status, body, type = 'application/json') => {
  res.writeHead(status, { 'content-type': type });
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
};

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/') return send(res, 200, await readFile(new URL('./index.html', import.meta.url), 'utf8'), 'text/html; charset=utf-8');
    if (req.method === 'GET' && req.url === '/livekit-client.js') {
      return send(res, 200, await readFile(new URL('../node_modules/livekit-client/dist/livekit-client.umd.js', import.meta.url), 'utf8'), 'text/javascript');
    }
    if (req.method === 'POST' && req.url === '/session') return send(res, 200, await startSession());
    if (req.method === 'GET' && req.url === '/doses') return send(res, 200, await doseStatuses());
    send(res, 404, { error: 'not found' });
  } catch (error) {
    console.error(error);
    send(res, 500, { error: error.message });
  }
});

// Local only: the page gets a LiveKit token, so it must not be reachable from the network.
server.listen(PORT, '127.0.0.1', () => console.log(`Test harness: http://localhost:${PORT}  (Ctrl+C removes the test dose_logs)`));

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => { await cleanup(); process.exit(0); });
}
