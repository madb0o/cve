import 'dotenv/config';
import { backfill, NVD_EPOCH } from '../src/nvd/sync.js';
import { hasApiKey } from '../src/nvd/apiClient.js';

const to = new Date();

console.log(`Starting NVD backfill: ${NVD_EPOCH.toISOString()} -> ${to.toISOString()}`);
console.log(`API key: ${hasApiKey() ? 'present (50 req/30s)' : 'absent (5 req/30s, this will be slow)'}`);

const startedAt = Date.now();
let totalRecords = 0;

await backfill(NVD_EPOCH, to, (p) => {
  totalRecords += p.recordsInWindow;
  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(0);
  const pct = ((p.windowIndex / p.windowCount) * 100).toFixed(1);
  console.log(
    `[${pct}%] window ${p.windowIndex}/${p.windowCount} ` +
      `(${p.windowStart.toISOString().slice(0, 10)} -> ${p.windowEnd.toISOString().slice(0, 10)}): ` +
      `${p.recordsInWindow} records | total so far: ${totalRecords} | elapsed: ${elapsedSec}s`
  );
});

console.log(`Backfill complete. ${totalRecords} records synced in ${((Date.now() - startedAt) / 1000).toFixed(0)}s.`);
