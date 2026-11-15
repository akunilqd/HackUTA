// Talks to the my-agent worker straight through LiveKit (mic + webcam in the browser), with no Chert and no FaceTime.
// Run (from my-agent/): npm run harness   then open http://localhost:5174. Reads credentials from ../.env.local.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { AccessToken, AgentDispatchClient, RoomServiceClient } from 'livekit-server-sdk';
import jpeg from 'jpeg-js';
import { supabase } from '../lib/db.mjs';
import { configure as configureFace, drawFace, FPS, HEIGHT, react, WIDTH } from '../face.mjs';

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
    metadata: JSON.stringify({ userId: DEMO_USER_ID, doseLogIds: testDoseIds, test: true }), // test: never message the family
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

// Face preview: draws the agent's video here, in this process, as an MJPEG stream; no LiveKit, no model.
const preview = { speaking: false, clients: new Set(), tick: 0, timer: undefined };

function streamFace(req, res) {
  res.writeHead(200, { 'content-type': 'multipart/x-mixed-replace; boundary=frame', 'cache-control': 'no-store' });
  preview.clients.add(res);
  req.on('close', () => preview.clients.delete(res));
  preview.timer ??= setInterval(() => {
    if (!preview.clients.size) { clearInterval(preview.timer); preview.timer = undefined; return; }
    let image;
    try { image = jpeg.encode({ data: drawFace(preview.tick++, preview.speaking), width: WIDTH, height: HEIGHT }, 80).data; }
    catch (error) { console.error('[face preview]', error); return; }
    for (const client of preview.clients) client.write(`--frame\r\ncontent-type: image/jpeg\r\ncontent-length: ${image.length}\r\n\r\n`), client.write(image), client.write('\r\n');
  }, 1000 / FPS);
}

function setFace(url) {
  const params = new URL(url, 'http://localhost').searchParams;
  if (params.has('event')) react(params.get('event'));
  if (params.has('hour')) configureFace({ hour: params.get('hour') === 'now' ? null : Number(params.get('hour')) });
  if (params.has('speaking')) preview.speaking = params.get('speaking') === '1';
  return { ok: true };
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
    if (req.method === 'GET' && req.url === '/face') return send(res, 200, await readFile(new URL('./face-preview.html', import.meta.url), 'utf8'), 'text/html; charset=utf-8');
    if (req.method === 'GET' && req.url.startsWith('/face/stream')) return streamFace(req, res);
    if (req.method === 'POST' && req.url.startsWith('/face/set')) return send(res, 200, setFace(req.url));
    if (req.method === 'POST' && req.url === '/session') return send(res, 200, await startSession());
    if (req.method === 'GET' && req.url === '/doses') return send(res, 200, await doseStatuses());
    send(res, 404, { error: 'not found' });
  } catch (error) {
    console.error(error);
    send(res, 500, { error: error.message });
  }
});

// Local only: the page gets a LiveKit token, so it must not be reachable from the network.
server.listen(PORT, '127.0.0.1', () => console.log(`Test harness: http://localhost:${PORT}  (Ctrl+C removes the test dose_logs)\nFace preview: http://localhost:${PORT}/face`));

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => { await cleanup(); process.exit(0); });
}
