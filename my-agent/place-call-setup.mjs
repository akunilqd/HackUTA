// One-off helper: creates a LiveKit room with an explicit dispatch for this
// agent, and prints a participant token scoped to that room. Paste the
// LiveKit URL and this token into the Chert console's "Place a call" form
// (Agent: "Your own room (LiveKit or direct)").
import { AccessToken, AgentDispatchClient } from 'livekit-server-sdk';

const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, AGENT_NAME } = process.env;
if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
  console.error('Missing LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET (run with --env-file=.env.local).');
  process.exit(1);
}

const roomName = `outbound-${Date.now()}`;
const agentName = AGENT_NAME || 'my-agent';

const dispatchClient = new AgentDispatchClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
await dispatchClient.createDispatch(roomName, agentName);

const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity: 'chert-bridge' });
token.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });
const jwt = await token.toJwt();

console.log(JSON.stringify({ liveKitUrl: LIVEKIT_URL, room: roomName, agentName, participantToken: jwt }, null, 2));
