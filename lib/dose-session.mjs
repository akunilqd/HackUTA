// Per-call medication logic: which doses this call is about, what the agent says, and the tools it may use.
import { llm } from '@livekit/agents';
import { z } from 'zod';
import { getDoseContext, getOpenDoses, setDoseStatus, zonedParts } from './db.mjs';
import { identifyMedication } from './vision.mjs';

export const CONFIRM_TIMEOUT_MS = 2 * 60_000;

function parseMetadata(raw) {
  try { return JSON.parse(raw || '{}') ?? {}; } catch { return {}; }
}

/** Outbound calls carry { userId, doseLogIds }; an inbound call has none, so it covers the patient's open doses. */
export async function loadDoses(ctx) {
  const meta = parseMetadata(ctx.job?.metadata);
  let rows;
  if (meta.doseLogIds?.length) rows = await getDoseContext(meta.doseLogIds);
  else if (meta.userId || process.env.DEMO_USER_ID) rows = await getOpenDoses(meta.userId || process.env.DEMO_USER_ID);
  else rows = [];

  rows.sort((a, b) => a.user_medications.name.localeCompare(b.user_medications.name)); // same order on every call
  const doses = rows.map((row, i) => ({
    number: i + 1,
    id: row.id,
    name: row.user_medications.name,
    dosage: row.user_medications.dosage,
    patient: row.user_medications.users?.name,
    timezone: row.user_medications.users?.timezone,
  }));
  return { doses, patientName: doses[0]?.patient ?? 'there', timezone: doses[0]?.timezone, outbound: Boolean(meta.doseLogIds?.length) };
}

const normalize = text => String(text ?? '').toLowerCase().replace(/[^a-z]/g, '');

function distance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

/** Tolerant name comparison: ignores case, strength and punctuation, allows small spelling or OCR slips. */
export function sameMedication(heard, expected) {
  const a = normalize(heard);
  const b = normalize(expected);
  if (!a || !b) return false;
  if (a === b || (Math.min(a.length, b.length) >= 5 && (a.includes(b) || b.includes(a)))) return true;
  return distance(a, b) <= Math.floor(Math.max(a.length, b.length) / 5);
}

const dayPart = timezone => {
  const hour = Number(zonedParts(new Date(), timezone || 'America/Chicago').hhmm.slice(0, 2));
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
};

/** The first thing said, once FaceTime is ready. Kept to one sentence: the Mac ends silent calls quickly. */
export function buildGreeting({ doses, patientName, timezone }) {
  const hello = `${dayPart(timezone)}, ${patientName}`;
  return doses.length
    ? `Say this in your own warm words, in one short sentence: "${hello}, this is PharmaSee, your AI medication helper. It is time for your medicine." Then wait for their reply before anything else.`
    : `Say in one short sentence: "${hello}, this is PharmaSee, an AI helper. Nothing is due right now. Take care, goodbye."`;
}

export function buildInstructions({ doses, patientName }) {
  if (!doses.length) {
    return `You are PharmaSee, a warm AI medication helper on a FaceTime call with ${patientName}.
There are no medications due right now. Say so in one short sentence, wish them well and say goodbye. You are an AI; say so if asked.`;
  }
  const list = doses.map(d => `${d.number}. ${d.name} - ${d.dosage}`).join('\n');
  return `You are PharmaSee, a warm, patient AI medication helper on a FaceTime call with ${patientName}, an older adult. You are an AI; say so if asked.

HOW TO SPEAK
- Speak slowly in short, plain sentences, at most two at a time, about 25 words or fewer per turn unless you are giving the dose. Ask one question at a time and wait for the answer.
- Answer right away; do not announce that you are about to check something.
- Use everyday words. Say numbers in words ("two tablets"), and repeat the amount once when you give it.
- The patient may have trouble hearing or seeing. If they seem confused or do not answer, gently repeat in simpler words. Never rush or scold.
- Do not mention tools, systems, databases or "records". Never read tool results aloud.
- If they ask about something unrelated, answer in a sentence and steer back to the medicine.

MEDICATIONS DUE NOW (from the patient's record, in this order)
${list}

FOR EACH MEDICATION, ONE AT A TIME (do not mention the next one until this one is confirmed)
1. Ask them to pick up the bottle or package and hold the label close to the camera, steady, in good light. Then call check_medication_on_camera. If it says there is no video, or the label is not legible, ask them to read the medication name aloud. After two failed attempts, ask them to read it letter by letter.
2. THE TOOLS ARE MANDATORY. Every time the patient shows, reads, or names a medicine, you MUST call verify_spoken_medication_name (or use the camera result) with the number of the medicine you are checking and the name you heard, BEFORE you say whether it is right. Say nothing about a match until the tool has answered. Never judge a match yourself.
3. If matchesExpected is true: say the exact dose from the list, for example "Please take two tablets of Metformin."
4. If matchesExpected is false: you MUST call flag_wrong_medication, then kindly say that it does not look like the right medicine and ask them to put it down and look for the right one. Never tell them to take a medication that did not match. When they find another bottle, go back to step 1.
5. Ask them to take it now with water and tell you when they have. When they clearly say they took it, you MUST call confirm_dose_taken before replying. "Okay" or "yes" to your instructions is not confirmation; ask "Did you take it?".
The record is how their caregiver knows what happened, so never skip a tool call. After every medication is confirmed, thank them warmly, remind them you will check in again at the next dose, and say goodbye.
6. After finishing taking the medicine, you should say thank you and remind them the next medicine schedule.

SAFETY RULES (these override everything above)
- Never advise a dose different from the list. Never suggest taking extra, doubling, skipping, or stopping. Never give medical advice or diagnoses.
- If they say they feel unwell, dizzy, in pain, short of breath, or confused, stop the medication steps. Calmly tell them to contact their doctor or caregiver now, and to call 911 if it feels serious. Do not call confirm_dose_taken.
- If they say they already took it earlier, do not tell them to take it again and do not call confirm_dose_taken. Say you will let their caregiver know and move on.
- If they refuse or do not want to take it, do not pressure them. Say that is okay, that their caregiver will be told, and say goodbye.`;
}

/**
 * @param {{ doses: any[], room: any, callerIdentity: string, onProgress: () => void, onAllConfirmed: () => void }} args
 */
export function buildTools({ doses, room, callerIdentity, onProgress, onAllConfirmed }) {
  const confirmed = new Set();
  const byNumber = number => doses.find(d => d.number === number);
  const number = z.number().int().describe('The medication number from the list');
  // A mismatch is recorded by the checking tools themselves, so the record never depends on the model remembering a second call.
  const flagWrong = async dose => { if (!confirmed.has(dose.id)) await setDoseStatus(dose.id, 'wrong_medication_flagged'); };

  const tools = {
    check_medication_on_camera: llm.tool({
      description: 'Look at the patient\'s camera and read the medication label they are holding. Call after asking them to show it.',
      parameters: z.object({ medicationNumber: number }),
      execute: async ({ medicationNumber }) => {
        onProgress();
        const dose = byNumber(medicationNumber);
        if (!dose) return { error: 'unknown medication number' };
        const seen = await identifyMedication(room, callerIdentity);
        if (!seen.video) return { video: false, instruction: 'No camera video. Ask the patient to read the medication name aloud.' };
        if (!seen.name) return { video: true, readable: false, instruction: 'Label not legible. Ask them to hold it closer and steadier, or read it aloud.' };
        const matchesExpected = sameMedication(seen.name, dose.name);
        if (!matchesExpected) await flagWrong(dose);
        return { video: true, readable: true, seenName: seen.name, matchesExpected };
      },
    }),

    verify_spoken_medication_name: llm.tool({
      description: 'Check a medication name the patient read aloud against the expected medication.',
      parameters: z.object({ medicationNumber: number, spokenName: z.string().describe('The name as you heard it') }),
      execute: async ({ medicationNumber, spokenName }) => {
        onProgress();
        const dose = byNumber(medicationNumber);
        if (!dose) return { error: 'unknown medication number' };
        const matchesExpected = sameMedication(spokenName, dose.name);
        if (!matchesExpected) await flagWrong(dose);
        return { matchesExpected };
      },
    }),

    flag_wrong_medication: llm.tool({
      description: 'Record that the patient is holding the wrong medication.',
      parameters: z.object({ medicationNumber: number, seenName: z.string().describe('What they showed or read') }),
      execute: async ({ medicationNumber }) => {
        onProgress();
        const dose = byNumber(medicationNumber);
        if (!dose) return { recorded: false };
        await flagWrong(dose);
        return { recorded: true };
      },
    }),

    confirm_dose_taken: llm.tool({
      description: 'Record that the patient has clearly said they took this medication.',
      parameters: z.object({ medicationNumber: number }),
      execute: async ({ medicationNumber }) => {
        onProgress();
        const dose = byNumber(medicationNumber);
        if (!dose) return { error: 'unknown medication number' };
        await setDoseStatus(dose.id, 'taken', { takenAt: new Date().toISOString() });
        confirmed.add(dose.id);
        const remaining = doses.filter(d => !confirmed.has(d.id)).map(d => d.number);
        if (!remaining.length) onAllConfirmed();
        return { recorded: true, remainingMedicationNumbers: remaining };
      },
    }),
  };
  for (const [name, entry] of Object.entries(tools)) {
    const run = entry.execute;
    entry.execute = async (args, ctx) => {
      const result = await run(args, ctx);
      console.log(`[tool] ${name} ${JSON.stringify(args)} -> ${JSON.stringify(result)}`);
      return result;
    };
  }
  return { tools, isConfirmed: id => confirmed.has(id) };
}
