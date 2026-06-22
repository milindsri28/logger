/**
 * Worker placeholder for future Redis/BullMQ job processing.
 *
 * MVP runs analysis jobs in-process on the API server (see incident.service.ts).
 * This worker can be extended to:
 * - clone-repo jobs
 * - index-repo jobs
 * - analyze-incident jobs
 *
 * Start with: npm run dev (from worker/)
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

console.log('AI Debug Investigator Worker');
console.log('MVP: jobs run in-process on the API server.');
console.log('Worker ready for future BullMQ integration.');

// Keep process alive for docker-compose / process managers
setInterval(() => {}, 60_000);
