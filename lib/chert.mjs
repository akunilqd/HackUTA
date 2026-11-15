import { randomUUID } from 'node:crypto';

const API = 'https://app.trychert.com/api/v1';

async function request(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${process.env.CHERT_API_KEY}`,
      'x-chert-project-id': process.env.CHERT_PROJECT_ID,
      'content-type': 'application/json',
      ...(method === 'POST' ? { 'idempotency-key': randomUUID() } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok && response.status !== 202) {
    const error = new Error(`Chert ${method} ${path} failed: ${response.status} ${JSON.stringify(json)}`);
    error.status = response.status;
    error.code = json?.error?.code;
    throw error;
  }
  return json.data ?? json;
}

export async function getLine() {
  const { items } = await request('/lines');
  if (!items?.length) throw new Error('No lines found on this Chert project.');
  return items[0];
}

/** Whether the Mac behind the line can take a call right now. Dialing into an unready line is what leaves calls stuck. */
export async function lineHealth() {
  const line = await getLine();
  const session = line.session_health?.status;
  const ready = line.availability === 'available' && session === 'accepting';
  return { ready, line, reason: `availability=${line.availability}, session=${session ?? 'unknown'}` };
}

export const placeCall = body => request('/calls', { method: 'POST', body });
export const getCall = id => request(`/calls/${id}`);
/** Asks Chert to end a call (202 only acknowledges; keep reading the call until it is terminal). */
export const endCall = id => request(`/calls/${id}/end`, { method: 'POST', body: {} });

export async function sendMessage({ lineId, recipient, text }) {
  return request('/shared-messages', { method: 'POST', body: { line_id: lineId, recipient, text } });
}
