import { Router } from 'express';
import { db } from '../db/client.js';
import { buildWhere, filterParamsFromRequest, qStr } from './queryFilters.js';

export const cvesRouter = Router();

cvesRouter.get('/', (req, res) => {
  const filters = filterParamsFromRequest(req);
  const q = qStr(req.query.q);
  const page = Math.max(1, Number(qStr(req.query.page) ?? '1') || 1);
  const pageSize = Math.min(100, Math.max(1, Number(qStr(req.query.pageSize) ?? '25') || 25));

  const { clause, params } = buildWhere(filters);
  let finalClause = clause;
  const finalParams = [...params];
  if (q) {
    const searchClause = '(id LIKE ? OR description LIKE ?)';
    finalClause = finalClause ? `${finalClause} AND ${searchClause}` : `WHERE ${searchClause}`;
    finalParams.push(`%${q}%`, `%${q}%`);
  }

  const totalRow = db.prepare(`SELECT COUNT(*) as count FROM cves ${finalClause}`).get(...(finalParams as never[])) as {
    count: number;
  };

  const rows = db
    .prepare(
      `SELECT id, published, last_modified, severity, cvss_score, cvss_version, vuln_type, description
       FROM cves ${finalClause}
       ORDER BY published DESC
       LIMIT ? OFFSET ?`
    )
    .all(...(finalParams as never[]), pageSize, (page - 1) * pageSize);

  res.json({ total: totalRow.count, page, pageSize, rows });
});
