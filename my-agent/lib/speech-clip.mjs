// Pre-rendered speech for lines that must be said word for word, such as the goodbye. Gemini Live does not take
// per-reply instructions, so asking it to "say exactly this" sometimes produced its next script line instead;
// a clip played with session.say({ audio }) always says the line.
import { GoogleGenAI } from '@google/genai';
import { AudioFrame } from '@livekit/rtc-node';

// Both render a short line in 2-3 s with the agent's own voice; the second is a fallback.
const MODELS = ['gemini-3.8-flash-tts', 'gemini-2.5-flash-preview-tts'];

let genai;
const client = () => (genai ??= new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY }));

/** 16-bit mono PCM from a TTS answer, which comes either as a WAV file or as raw L16 with the rate in the MIME type. */
function decode(bytes, mimeType) {
  if (bytes.toString('ascii', 0, 4) === 'RIFF') {
    let offset = 12, rate = 24000, channels = 1;
    while (offset + 8 <= bytes.length) {
      const id = bytes.toString('ascii', offset, offset + 4), size = bytes.readUInt32LE(offset + 4);
      if (id === 'fmt ') { channels = bytes.readUInt16LE(offset + 10); rate = bytes.readUInt32LE(offset + 12); }
      if (id === 'data') {
        const samples = new Int16Array(bytes.buffer.slice(bytes.byteOffset + offset + 8, bytes.byteOffset + offset + 8 + size));
        if (channels === 1) return { pcm: samples, rate };
        const mono = new Int16Array(Math.floor(samples.length / channels));
        for (let i = 0; i < mono.length; i++) mono[i] = samples[i * channels];
        return { pcm: mono, rate };
      }
      offset += 8 + size + (size % 2);
    }
    throw new Error('WAV without audio data');
  }
  const rate = Number(/rate=(\d+)/i.exec(mimeType ?? '')?.[1] ?? 24000);
  return { pcm: new Int16Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + (bytes.length & ~1))), rate };
}

/** Renders `text` in the given Gemini voice. Resolves to { pcm, rate }. */
export async function renderSpeech(text, voice) {
  const errors = [];
  for (const model of MODELS) {
    try {
      const response = await client().models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text }] }], // the text alone: a style hint like "say warmly" gets read out loud
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
          abortSignal: AbortSignal.timeout(20_000),
        },
      });
      const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data);
      if (part) return decode(Buffer.from(part.inlineData.data, 'base64'), part.inlineData.mimeType);
      errors.push(`${model}: no audio`);
    } catch (error) {
      errors.push(`${model}: ${String(error?.message ?? error).slice(0, 100)}`);
    }
  }
  throw new Error(errors.join(' | '));
}

/** The clip as 10 ms audio frames, for session.say(text, { audio }). */
export function clipStream({ pcm, rate }) {
  const step = rate / 100;
  let position = 0;
  return new ReadableStream({
    pull(controller) {
      if (position >= pcm.length) return controller.close();
      const chunk = pcm.slice(position, position + step); // a copy: AudioFrame reads from the start of its buffer
      position += step;
      controller.enqueue(new AudioFrame(chunk, rate, 1, chunk.length));
    },
  });
}
