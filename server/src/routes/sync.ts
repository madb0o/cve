import { Router } from 'express';
import { runIncrementalSync, isSyncInProgress } from '../scheduler.js';

export const syncRouter = Router();

syncRouter.post('/trigger', (_req, res) => {
  if (isSyncInProgress()) {
    res.status(409).json({ error: 'sync already in progress' });
    return;
  }
  runIncrementalSync()
    .then((result) => res.json(result))
    .catch((err) => res.status(500).json({ error: String(err?.message ?? err) }));
});
