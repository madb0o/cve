import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { statsRouter } from './routes/stats.js';
import { cvesRouter } from './routes/cves.js';
import { metaRouter } from './routes/meta.js';
import { syncRouter } from './routes/sync.js';
import { startScheduler } from './scheduler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 4000);
const SYNC_INTERVAL_HOURS = Number(process.env.SYNC_INTERVAL_HOURS ?? 6);

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/stats', statsRouter);
app.use('/api/cves', cvesRouter);
app.use('/api/meta', metaRouter);
app.use('/api/sync', syncRouter);

const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    next();
    return;
  }
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) next();
  });
});

app.listen(PORT, () => {
  console.log(`CVE dashboard server listening on http://localhost:${PORT}`);
  startScheduler(SYNC_INTERVAL_HOURS);
});
