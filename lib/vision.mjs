// Reads a medication label from the caller's video. The realtime Gemini plugin in Node ignores video input,
// so frames go to a separate generateContent call.
import { mkdir, writeFile } from 'node:fs/promises';
import { GoogleGenAI } from '@google/genai';
import { TrackKind, VideoBufferType, VideoStream } from '@livekit/rtc-node';
import jpeg from 'jpeg-js';

const MODEL = 'gemini-2.5-flash';
const PROMPT = `These are video frames of an elderly patient holding a medication package or bottle to the camera.
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

/** Reads up to `count` frames spread over `spanMs`, JPEG-encoded. */
async function grabFrames(track, count = 4, spanMs = 3000) {
  const frames = [];
  const reader = new VideoStream(track).getReader();
  const gap = spanMs / count;
  let next = 0;
  const started = Date.now();
  try {
    while (frames.length < count && Date.now() - started < spanMs + 4000) {
      const { value, done } = await reader.read();
      if (done) break;
      if (Date.now() - started < next) continue;
      next += gap;
      const rgba = value.frame.convert(VideoBufferType.RGBA);
      frames.push(jpeg.encode({ data: rgba.data, width: rgba.width, height: rgba.height }, 85).data);
    }
  } finally {
    reader.releaseLock();
  }
  return frames;
}

/** Returns { video: false } without a camera track, otherwise { video: true, name, strength, confidence }. */
export async function identifyMedication(room, participantIdentity) {
  const track = findVideoTrack(room, participantIdentity);
  if (!track) return { video: false };

  const frames = await grabFrames(track);
  if (!frames.length) return { video: true, name: null, confidence: 'low' };

  await mkdir('debug-frames', { recursive: true }).catch(() => {});
  const stamp = Date.now();
  await Promise.all(frames.map((frame, i) => writeFile(`debug-frames/${stamp}-${i}.jpg`, frame).catch(() => {})));

  const response = await client().models.generateContent({
    model: MODEL,
    contents: [{
      role: 'user',
      parts: [...frames.map(frame => ({ inlineData: { mimeType: 'image/jpeg', data: Buffer.from(frame).toString('base64') } })), { text: PROMPT }],
    }],
    config: { responseMimeType: 'application/json' },
  });
  try {
    return { video: true, ...JSON.parse(response.text) };
  } catch {
    return { video: true, name: null, confidence: 'low' };
  }
}
