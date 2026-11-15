import { AccessToken, AgentDispatchClient, RoomServiceClient } from 'livekit-server-sdk';
import { getLine, placeCall } from './chert.mjs';

/**
 * Dials `phone` on FaceTime and dispatches the agent into a fresh room.
 * `metadata` reaches the agent as ctx.job.metadata. Outbound video is disabled by Chert, so audio only.
 */
export async function startReminderCall({ phone, metadata }) {
  const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, AGENT_NAME } = process.env;
  const agentName = AGENT_NAME || 'my-agent';
  const room = `outbound-${Date.now()}`;

  await new AgentDispatchClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
    .createDispatch(room, agentName, { metadata: JSON.stringify(metadata ?? {}) });

  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity: 'chert-bridge', ttl: 3600 });
  token.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true });

  try {
    const line = await getLine();
    const call = await placeCall({
      direction: 'outbound',
      mode: 'customer_managed',
      line_id: line.id,
      destination: phone,
      destination_type: 'phone',
      media: { audio: true, video: false },
      livekit_url: LIVEKIT_URL,
      participant_token: await token.toJwt(),
      remote_participant_identity: agentName,
    });
    return { callId: call.id, room, line };
  } catch (error) {
    // No call will ever join this room; free the agent that was dispatched into it.
    await new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET).deleteRoom(room).catch(() => {});
    throw error;
  }
}
