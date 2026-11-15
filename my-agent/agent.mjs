import { monitorEventLoopDelay } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { StartSensitivity } from '@google/genai';
import { AutoSubscribe, defineAgent, voice } from '@livekit/agents';
import * as google from '@livekit/agents-plugin-google';
import { LocalVideoTrack, RoomEvent, TrackKind, TrackSource, VideoBufferType, VideoFrame, VideoSource } from '@livekit/rtc-node';
import { FPS, HEIGHT, WIDTH } from './face.mjs';
import { startFaceThread } from './lib/face-thread.mjs';
import { clipStream, renderSpeech } from './lib/speech-clip.mjs';
import { runAgent } from './chert-rooms.mjs';
import { greetOnBridgeReady } from './greet.mjs';
import { getDoseStatuses, setDoseStatus } from './lib/db.mjs';
import { buildInstructions, buildTools, CONFIRM_TIMEOUT_MS, greetingLine, loadDoses } from './lib/dose-session.mjs';

const VOICE = 'Puck';
const LIVE_MODEL = process.env.GEMINI_LIVE_MODEL || 'gemini-2.5-flash-native-audio-preview-12-2025';

/** Gemini's own speech detection; GEMINI_START_SENSITIVITY=low|high and GEMINI_PREFIX_PADDING_MS tune it. */
function activityDetection() {
  const config = {};
  if (process.env.GEMINI_START_SENSITIVITY === 'low') config.startOfSpeechSensitivity = StartSensitivity.START_SENSITIVITY_LOW;
  if (process.env.GEMINI_START_SENSITIVITY === 'high') config.startOfSpeechSensitivity = StartSensitivity.START_SENSITIVITY_HIGH;
  if (process.env.GEMINI_PREFIX_PADDING_MS) config.prefixPaddingMs = Number(process.env.GEMINI_PREFIX_PADDING_MS);
  if (process.env.GEMINI_SILENCE_MS) config.silenceDurationMs = Number(process.env.GEMINI_SILENCE_MS);
  return config;
}

const agent = defineAgent({
  entry: async ctx => {
    // Video too: the patient's camera is read for the medication label when the call has video.
    await ctx.connect(undefined, AutoSubscribe.SUBSCRIBE_ALL);
    // Chert prepares a room before a caller exists. Join promptly so Chert can
    // find us, but wait before opening a paid model session or sending video.
    const caller = await ctx.waitForParticipant();
    const { doses, patientName, timezone, outbound, test } = await loadDoses(ctx);
    // The greeting must introduce the agent by name every time, and Gemini Live sometimes merged it with the next
    // step and dropped "I'm Argos". It is rendered now, while the phone is still ringing, and played word for word.
    const greetingText = greetingLine({ doses, patientName, timezone });
    const greetingClip = renderSpeech(greetingText, VOICE).catch(error => { console.error(`[greet] could not pre-render: ${error.message}`); return null; });
    const instructions = buildInstructions({ doses, patientName, opening: greetingText });

    // Video: one camera track, published by this agent. The Mac shows video only
    // from the participant that speaks, so the picture and the voice stay together.
    // The face is drawn on its own thread so drawing never delays the call's audio.
    const source = new VideoSource(WIDTH, HEIGHT);
    const track = LocalVideoTrack.createVideoTrack('agent-video', source);
    let firstFrame, videoOpen = true;
    const faceReady = new Promise(resolve => { firstFrame = resolve; });
    const face = startFaceThread(pixels => {
      if (!videoOpen) return;
      source.captureFrame(new VideoFrame(pixels, WIDTH, HEIGHT, VideoBufferType.RGBA));
      firstFrame();
    });
    face.configure({ timezone }); // the sky follows the patient's time of day
    face.react(doses.length ? 'waiting' : 'idle');

    // Smoothness check: how long the main event loop (which carries the audio) was ever blocked, every 30 s.
    const loopDelay = monitorEventLoopDelay({ resolution: 10 });
    loopDelay.enable();
    const perfTimer = setInterval(() => {
      const ms = ns => (ns / 1e6).toFixed(0);
      console.log(`[perf] event loop delay p50 ${ms(loopDelay.percentile(50))} ms, p99 ${ms(loopDelay.percentile(99))} ms, max ${ms(loopDelay.max)} ms; memory ${Math.round(process.memoryUsage().rss / 1e6)} MB`);
      loopDelay.reset();
    }, 30_000);

    let confirmTimer;
    // Whatever the patient did not finish ends the call as unconfirmed, however the call ends.
    const settleOpenDoses = async () => {
      if (!doses.length) return;
      const open = (await getDoseStatuses(doses.map(d => d.id)))
        .filter(d => ['calling', 'pending', 'missed_no_answer'].includes(d.status)).map(d => d.id);
      if (open.length) await setDoseStatus(open, 'unconfirmed', { notify: !test });
    };
    const GOODBYES = {
      done: `Thank you, ${patientName}. You did great today. I will check in again at your next dose. Goodbye!`,
      quiet: `I will let your caregiver know how today went. Take care, ${patientName}. Goodbye!`,
      trouble: `I am sorry, I am having trouble with the connection, so I will let your caregiver know. Take care, ${patientName}. Goodbye!`,
    };
    // Rendered now, in the agent's voice, so the goodbye can be played word for word whenever the call ends.
    const goodbyeClips = Object.fromEntries(Object.entries(GOODBYES).map(([key, text]) => [key,
      renderSpeech(text, VOICE).catch(error => { console.error(`[goodbye] could not pre-render "${key}": ${error.message}`); return null; })]));
    // Every way the agent ends the call goes through here, so the patient always hears a goodbye before it leaves.
    // (When the patient hangs up there is nobody left to hear one.)
    let leaving = false;
    const leave = async (reason, goodbye) => {
      if (leaving || ending) return;
      leaving = true;
      clearTimeout(confirmTimer);
      console.log(`[leave] ${reason}`);
      if (goodbye && ctx.room.remoteParticipants.has(caller.identity)) await sayGoodbye(goodbye);
      await settleOpenDoses().catch(error => console.error('[settle] failed', error));
      ctx.shutdown(reason);
    };
    const finish = () => leave('caller hung up');
    // 2 minutes without progress ends the call; each tool call counts as progress.
    const arm = () => { clearTimeout(confirmTimer); confirmTimer = setTimeout(() => void leave('no progress for 2 minutes', 'quiet').catch(() => {}), CONFIRM_TIMEOUT_MS); };

    const { tools, isConfirmed } = buildTools({
      doses, room: ctx.room, callerIdentity: caller.identity, test,
      onProgress: () => { arm(); lastActivityAt = Date.now(); },
      onEvent: face.react,
      onAllConfirmed: () => void leave('all doses confirmed', 'done').catch(() => {}),
    });

    await faceReady;
    // One layer, capped: the flat cartoon looks the same at 600 kbps, and the laptop's upload is shared with the
    // label photos sent to Gemini, which stalled for 15-25 s while video was saturating it.
    await ctx.room.localParticipant.publishTrack(track, {
      source: TrackSource.SOURCE_CAMERA,
      simulcast: false,
      videoEncoding: { maxBitrate: 600_000n, maxFramerate: FPS },
    });

    // Thinking is off: with it on, Gemini Live closes the session mid-answer (code 1007), and answers are slower.
    // Speech detection stays at Gemini's defaults unless GEMINI_START_SENSITIVITY / GEMINI_PREFIX_PADDING_MS /
    // GEMINI_SILENCE_MS are set: low sensitivity cut background interruptions in a noisy room, but in testing it
    // also missed ordinary speech, and a shorter end-of-speech silence did not answer faster.
    const makeSession = () => new voice.AgentSession({
      llm: new google.beta.realtime.RealtimeModel({
        model: LIVE_MODEL,
        voice: VOICE,
        // 2.5 models turn thinking off with a zero budget; gemini-3.8-live rejects any thinking setting.
        ...(LIVE_MODEL.startsWith('gemini-2.5') ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        realtimeInputConfig: { automaticActivityDetection: activityDetection() },
      }),
    });

    let session;
    let ending = false;
    let agentState = 'initializing', agentStateAt = Date.now();
    let userState = 'listening', lastActivityAt = Date.now(), userHasReplied = false, startNudged = false, nudgesInARow = 0;
    let restarts = 0;
    // Captions: the words the agent speaks, drawn above the dog. Gemini's transcript of a whole sentence arrives
    // before the audio has played, so captions listen *after* the room's transcription synchronizer, which releases
    // the words in step with the audio playback. A turn's text builds up until flush(); the next word starts anew.
    let captionText = '', captionFresh = true;
    const listenForCaptions = output => {
      const target = output?.nextInChain ?? output; // the synchronizer's downstream: words paced to the audio
      if (!target || target.__captioned) return;
      target.__captioned = true;
      const capture = target.captureText.bind(target), flush = target.flush.bind(target);
      target.captureText = async text => {
        if (captionFresh) { captionText = ''; captionFresh = false; }
        captionText += typeof text === 'string' ? text : text?.text ?? '';
        face.caption(captionText);
        return capture(text);
      };
      target.flush = () => { captionFresh = true; face.captionDone(); return flush(); };
    };

    const openSession = async agentInstructions => {
      const current = makeSession();
      session = current;
      current.on(voice.AgentSessionEventTypes.UserStateChanged, event => {
        userState = event.newState;
        lastActivityAt = Date.now();
        if (event.newState === 'speaking') { userHasReplied = true; nudgesInARow = 0; }
      });
      current.on(voice.AgentSessionEventTypes.AgentStateChanged, event => {
        agentState = event.newState;
        agentStateAt = Date.now();
        lastActivityAt = Date.now();
        face.setSpeaking(event.newState === 'speaking');
      });
      // The plugin does not retry when Gemini fails (for example "Internal error", code 1011); without this the call goes silent.
      current.on(voice.AgentSessionEventTypes.Close, event => {
        if (current !== session || ending) return;
        if (event.reason === 'error') void recover().catch(error => console.error('[recover] failed', error));
        else void finish().catch(error => console.error('[finish] failed', error)); // the caller hung up
      });
      await current.start({
        room: ctx.room,
        agent: new voice.Agent({ instructions: agentInstructions, tools }),
        record: false,
        inputOptions: {
          participantIdentity: caller.identity,
          audioEnabled: true,
          videoEnabled: false,
          textEnabled: false,
          closeOnDisconnect: true,
          deleteRoomOnClose: false,
        },
        // Transcription on, so Gemini's transcript of what the agent says reaches the captions on its video.
        outputOptions: { audioEnabled: true, transcriptionEnabled: true },
      });
      listenForCaptions(current.output.transcription);
    };
    const recover = async () => {
      const remaining = doses.filter(d => !isConfirmed(d.id));
      if (!remaining.length) return;
      if (restarts >= 2) {
        console.log('[recover] giving up; leaving the unfinished doses unconfirmed');
        return leave('Gemini kept failing', 'trouble');
      }
      restarts++;
      console.log(`[recover] Gemini session failed; reconnecting (${restarts}/2)`);
      await replaceSession(buildInstructions({ doses: remaining, patientName }));
      session.generateReply({ userInput: '(The connection dropped for a moment and is back. Say one short sentence like "Sorry about that, I am back." and continue with the medication you were on.)' });
      arm();
    };

    // The failed session still holds the room's "lk.agent.session" byte stream handler, and a new session that
    // registers it again throws, which left the call silent. Detach the old one (so its Close event is not taken
    // for the caller hanging up), close it, release the handler, then open the new one.
    const replaceSession = async agentInstructions => {
      const failed = session;
      session = undefined;
      await failed?.close().catch(() => {});
      try { ctx.room.unregisterByteStreamHandler('lk.agent.session'); } catch { /* already released */ }
      await openSession(agentInstructions);
    };
    const within = (promise, ms) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms))]);
    // Waits until the agent has been neither speaking nor thinking for a moment, so a goodbye never cuts it off.
    const waitUntilQuiet = async (maxMs = 20_000) => {
      const started = Date.now();
      await new Promise(resolve => setTimeout(resolve, 1500)); // a reply to the last tool result may be about to start
      while (Date.now() - started < maxMs) {
        if (!['speaking', 'thinking'].includes(agentState) && Date.now() - agentStateAt > 1200) return;
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    };
    const sayGoodbye = async key => {
      const text = GOODBYES[key];
      try {
        if (session) await waitUntilQuiet();
        else await within(replaceSession(buildInstructions({ doses, patientName })), 8000); // Gemini failed: a fresh session just for this
        const clip = await within(goodbyeClips[key], 3000).catch(() => null);
        // The pre-rendered clip says the line exactly; asking the model is the fallback, and it may paraphrase.
        const handle = clip
          ? session.say(text, { audio: clipStream(clip), allowInterruptions: false, addToChatCtx: false })
          : session.generateReply({ userInput: `(The call is ending now. Say exactly this to the patient, warmly and slowly, and nothing else: "${text}")` });
        console.log(`[goodbye] ${clip ? 'playing the pre-rendered' : 'asking the model for the'} "${key}" goodbye`);
        await within(handle.waitForPlayout(), 15_000);
        await new Promise(resolve => setTimeout(resolve, 800)); // let the last words reach the phone before hanging up
      } catch (error) {
        console.error('[goodbye] could not say goodbye:', error?.message ?? error);
      }
    };

    ctx.addShutdownCallback(async () => {
      ending = true;
      clearTimeout(confirmTimer);
      clearInterval(perfTimer);
      loopDelay.disable();
      videoOpen = false;
      await face.stop();
      await settleOpenDoses().catch(error => console.error('[settle] failed', error));
      await session?.close();
      await track.close();
      await source.close();
    });
    await openSession(instructions);
    // Greet once, only when the call is really connected: the Mac ends a call that hears nothing within
    // 10 seconds of bridge_ready, and speech while the phone is still ringing is lost. Participant arrival
    // is not readiness (an outbound caller is in the room while the phone rings).
    // Gemini Live never speaks first, so a patient who does not know to answer would sit in silence until the
    // 2-minute limit. After the greeting, 6 s of silence moves on to the first step; after that, every 20 s of
    // silence brings a gentle check-in (at most 3 in a row; any word from the patient resets them).
    const FIRST_NUDGE_MS = 6000, NUDGE_MS = 20_000, MAX_NUDGES = 3;
    // Sent as a note from the patient's side: the Gemini plugin sends generateReply "instructions" as a model turn,
    // so the model believed it had already said them and skipped ahead.
    const NUDGES = {
      start: '(The patient has not answered your greeting. Carry on warmly: ask them to pick up their first medicine and hold the label close to the camera.)',
      check: '(The patient has been quiet for a while. Gently check that they are still there, for example "Are you still there? Take your time.", then repeat what you last asked them to do, in simpler words.)',
    };
    let nudgeTimer;
    const watchSilence = () => {
      nudgeTimer = setInterval(() => {
        if (leaving || ending || !session || !doses.length) return;
        if (['speaking', 'thinking'].includes(agentState) || userState === 'speaking') return;
        const quietFor = Date.now() - lastActivityAt;
        const kind = !userHasReplied && !startNudged ? (quietFor > FIRST_NUDGE_MS ? 'start' : null)
          : (quietFor > NUDGE_MS && nudgesInARow < MAX_NUDGES ? 'check' : null);
        if (!kind) return;
        if (kind === 'start') startNudged = true; else nudgesInARow++;
        lastActivityAt = Date.now();
        console.log(`[nudge] ${kind} after ${Math.round(quietFor / 1000)} s of silence${kind === 'check' ? ` (check-in ${nudgesInARow}/${MAX_NUDGES})` : ''}`);
        session.generateReply({ userInput: NUDGES[kind] });
      }, 500);
    };

    let greeted = false;
    const greet = why => {
      if (greeted) return;
      greeted = true;
      console.log(`[greet] ${why}`);
      // Speak within a couple of seconds whatever happens: the Mac ends a call that stays silent for 10 s.
      void (async () => {
        const clip = await Promise.race([greetingClip, new Promise(resolve => setTimeout(() => resolve(null), 2000))]);
        if (clip) session.say(greetingText, { audio: clipStream(clip), allowInterruptions: true });
        else session.generateReply(); // the instructions' OPENING tells the model its first words
        console.log(`[greet] ${clip ? 'playing the pre-rendered greeting' : 'asking the model to greet'}: "${greetingText}"`);
      })().catch(error => console.error('[greet] failed:', error?.message ?? error));
      lastActivityAt = Date.now();
      watchSilence();
      if (doses.length) arm();
      else setTimeout(() => void leave('nothing due').catch(() => {}), 15_000); // the greeting itself says goodbye
    };
    const stopGreeting = greetOnBridgeReady(ctx.room, () => greet('bridge_ready in room metadata'));
    // For outbound calls the bridge_ready signal may not reach the room, so also greet shortly after the
    // phone's audio appears (the Mac publishes it when the call is answered).
    let audioTimer;
    const onTrack = (publication, participant) => {
      if (outbound && participant.identity === caller.identity && publication.kind === TrackKind.KIND_AUDIO) {
        console.log('[greet] caller audio track published');
        audioTimer = setTimeout(() => greet('1.5s after caller audio appeared'), 1500);
      }
    };
    ctx.room.on(RoomEvent.TrackPublished, onTrack);
    // A microphone published before this listener existed would otherwise never trigger the greeting.
    const alreadyPublished = [...(ctx.room.remoteParticipants.get(caller.identity)?.trackPublications.values() ?? [])]
      .some(publication => publication.kind === TrackKind.KIND_AUDIO);
    if (outbound && alreadyPublished) audioTimer = setTimeout(() => greet('caller audio was already published'), 1500);
    ctx.room.on(RoomEvent.RoomMetadataChanged, metadata => console.log(`[room] metadata: ${metadata}`));
    ctx.addShutdownCallback(async () => { clearInterval(nudgeTimer); stopGreeting(); clearTimeout(audioTimer); ctx.room.off(RoomEvent.TrackPublished, onTrack); });
  },
});

export default agent;

// Your own LiveKit project when .env.local has its three LIVEKIT_ values; otherwise Chert rooms through chert dev.
runAgent(agent, { file: fileURLToPath(import.meta.url), agentName: process.env.AGENT_NAME || 'video-agent' });
