import { fileURLToPath } from 'node:url';
import { AutoSubscribe, defineAgent, voice } from '@livekit/agents';
import * as google from '@livekit/agents-plugin-google';
import { LocalVideoTrack, RoomEvent, TrackKind, TrackSource, VideoBufferType, VideoFrame, VideoSource } from '@livekit/rtc-node';
import { drawFace, FPS, HEIGHT, WIDTH } from './face.mjs';
import { runAgent } from './chert-rooms.mjs';
import { greetOnBridgeReady } from './greet.mjs';
import { getDoseStatuses, setDoseStatus } from './lib/db.mjs';
import { buildGreeting, buildInstructions, buildTools, CONFIRM_TIMEOUT_MS, loadDoses } from './lib/dose-session.mjs';

const agent = defineAgent({
  entry: async ctx => {
    // Video too: the patient's camera is read for the medication label when the call has video.
    await ctx.connect(undefined, AutoSubscribe.SUBSCRIBE_ALL);
    // Chert prepares a room before a caller exists. Join promptly so Chert can
    // find us, but wait before opening a paid model session or sending video.
    const caller = await ctx.waitForParticipant();
    const { doses, patientName, timezone, outbound } = await loadDoses(ctx);
    const instructions = buildInstructions({ doses, patientName });
    const greeting = buildGreeting({ doses, patientName, timezone });

    let confirmTimer;
    // Whatever the patient did not finish ends the call as unconfirmed, however the call ends.
    const settleOpenDoses = async () => {
      if (!doses.length) return;
      const open = (await getDoseStatuses(doses.map(d => d.id)))
        .filter(d => ['calling', 'pending', 'missed_no_answer'].includes(d.status)).map(d => d.id);
      if (open.length) await setDoseStatus(open, 'unconfirmed');
    };
    const finish = async () => {
      clearTimeout(confirmTimer);
      await settleOpenDoses();
      ctx.shutdown('call finished');
    };
    // 2 minutes without progress ends the call; each tool call counts as progress.
    const arm = () => { clearTimeout(confirmTimer); confirmTimer = setTimeout(() => void finish().catch(() => {}), CONFIRM_TIMEOUT_MS); };

    const { tools, isConfirmed } = buildTools({
      doses, room: ctx.room, callerIdentity: caller.identity,
      onProgress: arm,
      onAllConfirmed: () => { clearTimeout(confirmTimer); setTimeout(() => ctx.shutdown('all doses confirmed'), 12_000); },
    });

    // Video: one camera track, published by this agent. The Mac shows video only
    // from the participant that speaks, so the picture and the voice stay together.
    const source = new VideoSource(WIDTH, HEIGHT);
    const track = LocalVideoTrack.createVideoTrack('agent-video', source);
    let tick = 0, speaking = false;
    const frame = () => source.captureFrame(new VideoFrame(drawFace(tick++, speaking), WIDTH, HEIGHT, VideoBufferType.RGBA));
    frame();
    await ctx.room.localParticipant.publishTrack(track, { source: TrackSource.SOURCE_CAMERA });
    const timer = setInterval(frame, 1000 / FPS);

    // Thinking is off: with it on, Gemini Live closes the session mid-answer (code 1007), and answers are slower.
    const makeSession = () => new voice.AgentSession({
      llm: new google.beta.realtime.RealtimeModel({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        voice: 'Puck',
        thinkingConfig: { thinkingBudget: 0 },
      }),
    });

    let session;
    let ending = false;
    let restarts = 0;
    const openSession = async agentInstructions => {
      const current = makeSession();
      session = current;
      current.on(voice.AgentSessionEventTypes.AgentStateChanged, event => { speaking = event.newState === 'speaking'; });
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
        outputOptions: { audioEnabled: true, transcriptionEnabled: false },
      });
    };
    const recover = async () => {
      const remaining = doses.filter(d => !isConfirmed(d.id));
      if (!remaining.length) return;
      if (restarts >= 2) { console.log('[recover] giving up; leaving the unfinished doses unconfirmed'); return finish(); }
      restarts++;
      console.log(`[recover] Gemini session failed; reconnecting (${restarts}/2)`);
      await openSession(buildInstructions({ doses: remaining, patientName }));
      session.generateReply({ instructions: 'The connection dropped for a moment. Say one short sentence: "Sorry about that, I am back." Then continue with the medication you were on.' });
      arm();
    };

    ctx.addShutdownCallback(async () => {
      ending = true;
      clearTimeout(confirmTimer);
      clearInterval(timer);
      await settleOpenDoses().catch(error => console.error('[settle] failed', error));
      await session?.close();
      await track.close();
      await source.close();
    });
    await openSession(instructions);
    // Greet once, only when the call is really connected: the Mac ends a call that hears nothing within
    // 10 seconds of bridge_ready, and speech while the phone is still ringing is lost. Participant arrival
    // is not readiness (an outbound caller is in the room while the phone rings).
    let greeted = false;
    const greet = why => {
      if (greeted) return;
      greeted = true;
      console.log(`[greet] ${why}`);
      session.generateReply({ instructions: greeting });
      if (doses.length) arm();
      else setTimeout(() => ctx.shutdown('nothing due'), 15_000);
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
    ctx.addShutdownCallback(async () => { stopGreeting(); clearTimeout(audioTimer); ctx.room.off(RoomEvent.TrackPublished, onTrack); });
  },
});

export default agent;

// Your own LiveKit project when .env.local has its three LIVEKIT_ values; otherwise Chert rooms through chert dev.
runAgent(agent, { file: fileURLToPath(import.meta.url), agentName: process.env.AGENT_NAME || 'video-agent' });
