import { Router } from 'express';
import { db } from '../db/client.js';
import { qStr } from './queryFilters.js';

export const vendorsRouter = Router();

// CPE vendor slugs are underscore-joined lowercase tokens (e.g. "eric_allman");
// humanize purely for display, the slug itself stays the filter/query value.
function humanize(slug: string): string {
  return slug
    .split('_')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

vendorsRouter.get('/', (req, res) => {
  const q = qStr(req.query.q);
  const limit = Math.min(50, Math.max(1, Number(qStr(req.query.limit) ?? '20') || 20));

  const rows = q
    ? (db
        .prepare(
          `SELECT vendor, COUNT(DISTINCT cve_id) as count
           FROM cve_vendors
           WHERE vendor LIKE ?
           GROUP BY vendor
           ORDER BY count DESC
           LIMIT ?`
        )
        .all(`%${q.toLowerCase().replace(/\s+/g, '_')}%`, limit) as { vendor: string; count: number }[])
    : (db
        .prepare(
          `SELECT vendor, COUNT(DISTINCT cve_id) as count
           FROM cve_vendors
           GROUP BY vendor
           ORDER BY count DESC
           LIMIT ?`
        )
        .all(limit) as { vendor: string; count: number }[]);

  res.json({
    vendors: rows.map((r) => ({ slug: r.vendor, label: humanize(r.vendor), count: r.count })),
  });
});
