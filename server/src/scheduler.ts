import cron from 'node-cron';
import { incrementalSync } from './nvd/sync.js';

let syncInProgress = false;

export async function runIncrementalSync(): Promise<{ recordsSynced: number }> {
  if (syncInProgress) {
    throw new Error('Sync already in progress');
  }
  syncInProgress = true;
  try {
    const result = await incrementalSync();
    console.log(`[sync] incremental sync complete: ${result.recordsSynced} records`);
    return result;
  } catch (err) {
    console.error('[sync] incremental sync failed:', err);
    throw err;
  } finally {
    syncInProgress = false;
  }
}

export function isSyncInProgress(): boolean {
  return syncInProgress;
}

export function startScheduler(intervalHours: number): void {
  const hours = Math.max(1, Math.floor(intervalHours));
  const cronExpr = `0 */${hours} * * *`;
  cron.schedule(cronExpr, () => {
    runIncrementalSync().catch(() => {
      /* already logged */
    });
  });
  console.log(`[sync] scheduled incremental sync every ${hours}h (${cronExpr})`);
}
