import { Router } from 'express';
import { db, getSyncState } from '../db/client.js';
import { isSyncInProgress } from '../scheduler.js';

export const metaRouter = Router();

metaRouter.get('/', (_req, res) => {
  const severities = db
    .prepare("SELECT DISTINCT severity FROM cves WHERE severity IS NOT NULL ORDER BY severity")
    .all() as { severity: string }[];
  const types = db
    .prepare("SELECT DISTINCT vuln_type FROM cves WHERE vuln_type IS NOT NULL ORDER BY vuln_type")
    .all() as { vuln_type: string }[];
  const range = db.prepare('SELECT MIN(published) as min, MAX(published) as max FROM cves').get() as {
    min: string | null;
    max: string | null;
  };
  const totalRow = db.prepare('SELECT COUNT(*) as count FROM cves').get() as { count: number };

  res.json({
    severities: severities.map((s) => s.severity),
    types: types.map((t) => t.vuln_type),
    dateRange: range,
    totalCves: totalRow.count,
    lastIncrementalSync: getSyncState('last_incremental_sync'),
    backfillCursor: getSyncState('backfill_cursor'),
    syncInProgress: isSyncInProgress(),
  });
});
