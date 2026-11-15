// Reads a medication label from the caller's video. The realtime Gemini plugin in Node ignores video input,
// so a frame goes to a separate generateContent call.
import { mkdir, writeFile } from 'node:fs/promises';
import { GoogleGenAI } from '@google/genai';
import { TrackKind, VideoBufferType, VideoStream } from '@livekit/rtc-node';
import jpeg from 'jpeg-js';

// gemini-2.5-flash is no longer offered to new users (404). Both of these read real label frames correctly;
// 3.5-flash has a small free daily quota, 3.5-flash-lite a larger one. [model, start after ms]:
const ATTEMPTS = [['gemini-3.5-flash', 0], ['gemini-3.5-flash-lite', 0], ['gemini-3.5-flash-lite', 2500], ['gemini-3.5-flash-lite', 5000]];
const READ_DEADLINE_MS = 9000;
const PROMPT = `This is a video frame of an elderly patient holding a medication package or bottle to the camera.
Read the medication name printed on the label. Reply as JSON: {"name": string | null, "strength": string | null, "confidence": "high" | "medium" | "low"}.
Use null for name when no label text is legible. Never guess from pill shape or color.`;

let genai;
const client = () => (genai ??= new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY }));

/** The first video track a remote participant has published, if any. */
export function findVideoTrack(room, participantIdentity) {
  const participant = room.remoteParticipants.get(participantIdentity);
  for (const publication of participant?.trackPublications.values() ?? []) {
    if (publication.kind === TrackKind.KIND_VIDEO && publication.track) return publication.track;
  }
  return undefined;
}

/** Reads up to `count` RGBA frames spread over `spanMs`. */
async function grabFrames(track, count = 3, spanMs = 1200) {
  const frames = [];
  const reader = new VideoStream(track).getReader();
  const gap = spanMs / count;
  let next = 0;
  const started = Date.now();
  try {
    while (frames.length < count && Date.now() - started < spanMs + 3000) {
      const { value, done } = await reader.read();
      if (done) break;
      if (Date.now() - started < next) continue;
      next += gap;
      const rgba = value.frame.convert(VideoBufferType.RGBA);
      frames.push({ data: rgba.data, width: rgba.width, height: rgba.height });
    }
  } finally {
    // Cancel, not just release: an uncancelled VideoStream keeps copying every incoming frame into memory for the rest
    // of the call, on the same event loop as the agent's audio (gigabytes within minutes, and choppy speech).
    await reader.cancel().catch(() => {});
  }
  return frames;
}

/**
 * The part of the frame that is picture: the Mac sends the caller's video letterboxed in black, so the label
 * would otherwise be a small part of the image.
 */
function pictureBox({ data, width, height }) {
  let x0 = width, x1 = -1, y0 = height, y1 = -1;
  for (let y = 0; y < height; y += 4) {
    for (let x = 0; x < width; x += 4) {
      const i = (y * width + x) * 4;
      if (data[i] + data[i + 1] + data[i + 2] > 60) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
  }
  if (x1 < 0) return { x: 0, y: 0, w: width, h: height };
  x0 = Math.max(0, x0 - 4); y0 = Math.max(0, y0 - 4);
  return { x: x0, y: y0, w: Math.min(width, x1 + 8) - x0, h: Math.min(height, y1 + 8) - y0 };
}

/** How sharp a region is (mean absolute horizontal and vertical brightness change); motion blur scores low. */
function sharpness({ data, width }, box) {
  let sum = 0, n = 0;
  const lum = i => data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11;
  for (let y = box.y + 2; y < box.y + box.h - 2; y += 3) {
    for (let x = box.x + 2; x < box.x + box.w - 2; x += 3) {
      const i = (y * width + x) * 4;
      sum += Math.abs(lum(i) - lum(i + 8)) + Math.abs(lum(i) - lum(i + width * 8));
      n++;
    }
  }
  return n ? sum / n : 0;
}

function cropToJpeg(frame, box) {
  const out = new Uint8Array(box.w * box.h * 4);
  for (let y = 0; y < box.h; y++) {
    const from = ((box.y + y) * frame.width + box.x) * 4;
    out.set(frame.data.subarray(from, from + box.w * 4), y * box.w * 4);
  }
  return jpeg.encode({ data: out, width: box.w, height: box.h }, 88).data;
}

/** One sharp, cropped JPEG from RGBA frames: it reads as well as several full frames and far faster (about 1 s against 8 s). */
export function labelImage(frames) {
  const box = pictureBox(frames[0]);
  const best = frames.reduce((a, b) => (sharpness(b, box) > sharpness(a, box) ? b : a));
  return cropToJpeg(best, box);
}

/**
 * Reads the label, hedging against slow requests: the same image takes about 1 s most of the time but 15-25 s now
 * and then, whatever its size, so a second request starts if no answer has come after a couple of seconds and
 * the first answer wins. A model that fails fast (quota, 404) simply drops out.
 */
export async function readLabel(image) {
  const data = Buffer.from(image).toString('base64');
  const stop = new AbortController();
  const deadline = AbortSignal.timeout(READ_DEADLINE_MS);
  const ask = async (model, delayMs) => {
    if (delayMs) await new Promise(resolve => setTimeout(resolve, delayMs));
    if (stop.signal.aborted || deadline.aborted) throw new Error('not needed');
    const response = await client().models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ inlineData: { mimeType: 'image/jpeg', data } }, { text: PROMPT }] }],
      config: { responseMimeType: 'application/json', thinkingConfig: { thinkingLevel: 'MINIMAL' }, abortSignal: AbortSignal.any([stop.signal, deadline]) },
    });
    return { model, ...JSON.parse(response.text) };
  };
  try {
    return await Promise.any(ATTEMPTS.map(([model, delayMs]) => ask(model, delayMs)));
  } catch (error) {
    const reasons = (error.errors ?? [error]).map((e, i) => `${ATTEMPTS[i]?.[0] ?? 'model'}: ${String(e?.message ?? e).slice(0, 100)}`);
    console.error(`[vision] no model could read the label: ${reasons.join(' | ')}`);
    return { name: null, confidence: 'low', error: 'label reading is unavailable right now' };
  } finally {
    stop.abort(); // the other requests' answers are no longer needed
  }
}

/** Returns { video: false } without a camera track, otherwise { video: true, name, strength, confidence }. */
export async function identifyMedication(room, participantIdentity) {
  const track = findVideoTrack(room, participantIdentity);
  if (!track) return { video: false };

  const frames = await grabFrames(track);
  if (!frames.length) return { video: true, name: null, confidence: 'low' };

  const image = labelImage(frames);
  await mkdir('debug-frames', { recursive: true }).catch(() => {});
  await writeFile(`debug-frames/${Date.now()}.jpg`, image).catch(() => {});

  const started = Date.now();
  const result = await readLabel(image);
  console.log(`[vision] ${result.model ?? 'failed'} read ${JSON.stringify(result.name)} in ${Date.now() - started} ms`);
  return { video: true, ...result };
}
