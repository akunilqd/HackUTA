// Places a test reminder call. With dose_log ids it behaves like the scheduler; without, the agent uses today's open doses.
// Usage: node --env-file=.env.local call-me.mjs +1XXXXXXXXXX [userId] [doseLogId,...]
import { startReminderCall } from './lib/outbound.mjs';

const [phone, userId, ids] = process.argv.slice(2);
if (!phone) { console.error('Usage: node --env-file=.env.local call-me.mjs +1XXXXXXXXXX [userId] [doseLogId,...]'); process.exit(1); }

const metadata = userId ? { userId, doseLogIds: ids ? ids.split(',') : [] } : {};
const { callId, room, line } = await startReminderCall({ phone, metadata });
console.log(`Calling ${phone} from ${line.phone_number ?? line.id} (room ${room}, call ${callId})…`);
