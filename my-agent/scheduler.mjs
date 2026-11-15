// Every minute: create dose_logs for medications due now, call the patient, retry once, then fall back to iMessage.
import cron from 'node-cron';
import { setTimeout as sleep } from 'node:timers/promises';
import {
  createDoseLogs, getDoseStatuses, getDueMedications, getPendingDoses, getStalePendingDoses, setDoseStatus,
} from './lib/db.mjs';
import { endCall, getCall, getLine, lineHealth, sendMessage } from './lib/chert.mjs';
import { startReminderCall } from './lib/outbound.mjs';

const RETRY_DELAY_MS = 2 * 60_000;
const RING_TIMEOUT_MS = 75_000;
const MAX_CALL_MS = 10 * 60_000;
const log = (...args) => console.log(new Date().toISOString(), '[scheduler]', ...args);

const inFlight = new Set();
let queue = Promise.resolve();

/** Resolves 'answered' (call ended afterwards), or 'unanswered' when Chert never connected the patient. */
async function watchCall(callId) {
  const started = Date.now();
  let answered = false;
  for (;;) {
    await sleep(5000);
    const call = await getCall(callId).catch(() => undefined);
    if (call) {
      if (call.answered_at) answered = true;
      const over = call.ended_at || ['ended', 'failed', 'declined', 'canceled'].includes(call.status);
      const dying = over || call.status === 'ending';
      if (answered && over) return 'answered';
      if (!answered && dying) return 'unanswered';
    }
    if (!answered && Date.now() - started > RING_TIMEOUT_MS) return 'unanswered';
    if (Date.now() - started > MAX_CALL_MS) return answered ? 'answered' : 'unanswered';
  }
}

async function attemptCall(group) {
  try {
    const health = await lineHealth();
    if (!health.ready) {
      log(`line not ready (${health.reason}); not dialing, will check again next minute`);
      return 'infra_error';
    }
    const { callId, video } = await startReminderCall({
      phone: group.user.phone,
      metadata: { userId: group.user.id, doseLogIds: group.doseLogIds },
    });
    log(`calling ${group.user.name} (${video ? 'video' : 'AUDIO ONLY: Chert refused video'}), call ${callId}`);
    const result = await watchCall(callId);
    // Hang up a call that never connected so it cannot keep the shared line busy.
    if (result === 'unanswered') await endCall(callId).catch(error => log(`end call failed: ${error.message}`));
    return result;
  } catch (error) {
    log(`infra_error: ${error.message}`);
    return 'infra_error';
  }
}

async function sendFallback(group) {
  const names = group.medications.join(' and ');
  try {
    const line = await getLine();
    const number = line.phone_number ?? line.masked_identity;
    await sendMessage({
      lineId: line.id,
      recipient: group.user.phone,
      text: `Hi ${group.user.name}, it is time for your ${names}. We could not reach you. Tap to call us back on FaceTime video: facetime://${number}  (or call ${number})`,
    });
    log(`iMessage fallback sent to ${group.user.name}`);
  } catch (error) {
    log(`iMessage fallback failed: ${error.message}`);
  }
}

async function handleReminder(group) {
  const key = group.key;
  try {
    await setDoseStatus(group.doseLogIds, 'calling');
    let result = await attemptCall(group);
    if (result === 'infra_error') {
      await setDoseStatus(group.doseLogIds, 'pending'); // picked up again on a later tick
      return;
    }
    if (result === 'unanswered') {
      log(`no answer from ${group.user.name}, retrying in 2 minutes`);
      await sleep(RETRY_DELAY_MS);
      result = await attemptCall(group);
      if (result === 'infra_error') { await setDoseStatus(group.doseLogIds, 'pending'); return; }
    }
    if (result === 'unanswered') {
      await sendFallback(group);
      await setDoseStatus(group.doseLogIds, 'missed_no_answer');
      return;
    }
    // The agent writes the final status; anything it left unfinished counts as unconfirmed.
    const left = (await getDoseStatuses(group.doseLogIds)).filter(d => d.status === 'calling').map(d => d.id);
    if (left.length) await setDoseStatus(left, 'unconfirmed');
  } catch (error) {
    log(`handleReminder failed: ${error.message}`);
  } finally {
    inFlight.delete(key);
  }
}

function groupDoses(doses) {
  const groups = new Map();
  for (const dose of doses) {
    const med = dose.user_medications;
    const user = med.users;
    const key = `${user.id}|${dose.scheduled_at}`;
    if (inFlight.has(key) || !user.phone) continue;
    const group = groups.get(key) ?? { key, user, doseLogIds: [], medications: [] };
    group.doseLogIds.push(dose.id);
    group.medications.push(med.name);
    groups.set(key, group);
  }
  return [...groups.values()];
}

async function tick() {
  try {
    const due = await getDueMedications();
    await createDoseLogs(due.map(d => ({
      medication_id: d.med.id, scheduled_at: d.scheduledAt.toISOString(), status: 'pending',
    })));

    for (const group of groupDoses(await getPendingDoses())) {
      inFlight.add(group.key);
      queue = queue.then(() => handleReminder(group));
    }

    for (const dose of await getStalePendingDoses()) {
      const user = dose.user_medications.users;
      log(`dose ${dose.id} never reached ${user.name}; falling back`);
      await sendFallback({ user, medications: [dose.user_medications.name] });
      await setDoseStatus(dose.id, 'missed_no_answer');
    }
  } catch (error) {
    log(`tick failed: ${error.message}`);
  }
}

cron.schedule('* * * * *', tick);
log('running; checking every minute');
tick();
