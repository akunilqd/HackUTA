// The drawing thread behind lib/face-thread.mjs: draws a frame every 1/FPS s and posts it to the main thread.
import { parentPort } from 'node:worker_threads';
import { configure, drawFaceInto, endCaption, FPS, HEIGHT, react, setCaption, WIDTH } from '../face.mjs';

const pool = [];      // buffers the main thread has handed back
let inFlight = 0;     // frames posted but not yet handed back
let speaking = false, tick = 0;

parentPort.on('message', message => {
  if (message.recycle) { inFlight--; if (pool.length < 3) pool.push(message.recycle); }
  if ('speaking' in message) speaking = message.speaking;
  if (message.event) react(message.event);
  if (message.configure) configure(message.configure);
  if ('caption' in message) setCaption(message.caption);
  if (message.captionDone) endCaption();
});

function draw() {
  const frameTick = tick++; // the animation keeps time even when a frame is skipped
  if (inFlight >= 2) return; // the main thread is behind: skip rather than queue frames up
  const pixels = drawFaceInto(frameTick, speaking, new Uint8Array(pool.pop() ?? new ArrayBuffer(WIDTH * HEIGHT * 4)));
  inFlight++;
  parentPort.postMessage({ pixels }, [pixels.buffer]);
}

draw();
setInterval(draw, 1000 / FPS);
