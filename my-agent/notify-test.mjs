// Dry run: prints the family messages for every status. Sends nothing.
import { buildMessage, NOTIFY_STATUSES } from './lib/family-notify.mjs';

const doses = [{ name: 'Metformin', dosage: '500 mg' }, { name: 'Lisinopril', dosage: '10 mg' }];
for (const status of NOTIFY_STATUSES) {
  console.log(`\n[${status}]\n${buildMessage({ status, patientName: 'Margaret', timezone: 'America/Chicago', doses: status === 'taken' ? doses.slice(0, 1) : doses, takenAt: new Date().toISOString() })}`);
}
