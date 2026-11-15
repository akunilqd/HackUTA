// Draws the agent's face on its own thread. The call's audio runs on the main event loop, and a frame takes
// about 9 ms to draw (up to ~40 ms with garbage collection), so drawing here keeps it out of the audio's way.
import { Worker } from 'node:worker_threads';

/**
 * Starts drawing. `onFrame(pixels)` receives each RGBA frame on the main thread; the buffer is handed back to the
 * drawing thread for reuse as soon as onFrame returns, so onFrame must copy what it keeps (captureFrame does).
 */
export function startFaceThread(onFrame) {
  const worker = new Worker(new URL('./face-worker.mjs', import.meta.url), { execArgv: [] });
  worker.on('message', ({ pixels }) => {
    try { onFrame(pixels); }
    finally { worker.postMessage({ recycle: pixels.buffer }, [pixels.buffer]); }
  });
  worker.on('error', error => console.error('[face] drawing thread failed', error));
  return {
    setSpeaking: speaking => worker.postMessage({ speaking }),
    react: event => worker.postMessage({ event }),
    configure: options => worker.postMessage({ configure: options }),
    caption: text => worker.postMessage({ caption: text }),
    captionDone: () => worker.postMessage({ captionDone: true }),
    stop: () => worker.terminate(),
  };
}
