import { Router } from 'express';
import { db } from '../db/client.js';
import { buildWhere, filterParamsFromRequest, qStr } from './queryFilters.js';

export const statsRouter = Router();

const GRANULARITY_BUCKETS: Record<string, string> = {
  daily: "strftime('%Y-%m-%d', published)",
  weekly: "date(published, 'weekday 0', '-6 days')",
  monthly: "strftime('%Y-%m-01', published)",
  yearly: "strftime('%Y-01-01', published)",
};

function countWhere(clause: string, params: unknown[]): number {
  const row = db.prepare(`SELECT COUNT(*) as count FROM cves ${clause}`).get(...(params as never[])) as {
    count: number;
  };
  return row.count;
}

function shiftYears(d: Date, years: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear() + years, d.getUTCMonth(), d.getUTCDate(), 0, 0, 0));
}

function pct(current: number, baseline: number): number | null {
  return baseline > 0 ? ((current - baseline) / baseline) * 100 : null;
}

statsRouter.get('/summary', (req, res) => {
  const filters = filterParamsFromRequest(req);
  const { clause: baseClause, params: baseParams } = buildWhere({
    severity: filters.severity,
    type: filters.type,
  });

  const withDate = (extraClause: string, extraParams: unknown[]) => {
    const clause = baseClause ? `${baseClause} AND ${extraClause}` : `WHERE ${extraClause}`;
    return countWhere(clause, [...baseParams, ...extraParams]);
  };

  const now = new Date();

  if (filters.from) {
    // Range mode: the selected date range drives every number, including YoY.
    const rangeFrom = new Date(filters.from);
    const rangeTo = filters.to ? new Date(filters.to) : now;
    const rangeMs = rangeTo.getTime() - rangeFrom.getTime();

    const total = withDate('published >= ? AND published <= ?', [rangeFrom.toISOString(), rangeTo.toISOString()]);

    const prevFrom = new Date(rangeFrom.getTime() - rangeMs);
    const prevTo = rangeFrom;
    const previousPeriodCount = withDate('published >= ? AND published < ?', [
      prevFrom.toISOString(),
      prevTo.toISOString(),
    ]);

    const yoyFrom = shiftYears(rangeFrom, -1);
    const yoyTo = shiftYears(rangeTo, -1);
    const yoyCount = withDate('published >= ? AND published <= ?', [yoyFrom.toISOString(), yoyTo.toISOString()]);

    res.json({
      mode: 'range',
      total,
      rangeFrom: rangeFrom.toISOString(),
      rangeTo: rangeTo.toISOString(),
      previousPeriodCount,
      periodDeltaPct: pct(total, previousPeriodCount),
      yoyCount,
      yoyDeltaPct: pct(total, yoyCount),
    });
    return;
  }

  // All-time mode (no date filter selected): fixed calendar-period tiles.
  const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).toISOString();
  const startOfLastYear = new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1)).toISOString();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const sameDayLastYear = new Date(
    Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), now.getUTCDate())
  ).toISOString();

  const total = countWhere(baseClause, baseParams);
  const thisYear = withDate('published >= ?', [startOfYear]);
  const lastYearToDate = withDate('published >= ? AND published <= ?', [startOfLastYear, sameDayLastYear]);
  const thisMonth = withDate('published >= ?', [startOfMonth]);
  const thisWeek = withDate('published >= ?', [startOfWeek]);
  const today = withDate('published >= ?', [startOfToday]);

  res.json({
    mode: 'alltime',
    total,
    thisYear,
    thisMonth,
    thisWeek,
    today,
    lastYearToDate,
    yoyDeltaPct: pct(thisYear, lastYearToDate),
  });
});

statsRouter.get('/trend', (req, res) => {
  const filters = filterParamsFromRequest(req);
  const granularity = qStr(req.query.granularity) ?? 'monthly';
  const bucketExpr = GRANULARITY_BUCKETS[granularity];
  if (!bucketExpr) {
    res.status(400).json({ error: `invalid granularity, expected one of ${Object.keys(GRANULARITY_BUCKETS)}` });
    return;
  }

  const groupBy = qStr(req.query.groupBy); // 'severity' | 'type' | undefined
  const groupCol = groupBy === 'severity' ? 'severity' : groupBy === 'type' ? 'vuln_type' : null;

  const { clause, params } = buildWhere(filters);

  if (groupCol) {
    const rows = db
      .prepare(
        `SELECT ${bucketExpr} as bucket, COALESCE(${groupCol}, 'UNKNOWN') as group_key, COUNT(*) as count
         FROM cves ${clause}
         GROUP BY bucket, group_key
         ORDER BY bucket ASC`
      )
      .all(...(params as never[]));
    res.json({ granularity, groupBy: groupCol, rows });
    return;
  }

  const rows = db
    .prepare(
      `SELECT ${bucketExpr} as bucket, COUNT(*) as count
       FROM cves ${clause}
       GROUP BY bucket
       ORDER BY bucket ASC`
    )
    .all(...(params as never[]));

  res.json({ granularity, groupBy: null, rows });
});

statsRouter.get('/by-severity', (req, res) => {
  const filters = filterParamsFromRequest(req);
  const { clause, params } = buildWhere(filters);
  const rows = db
    .prepare(
      `SELECT COALESCE(severity, 'UNKNOWN') as severity, COUNT(*) as count
       FROM cves ${clause}
       GROUP BY severity
       ORDER BY count DESC`
    )
    .all(...(params as never[]));
  res.json({ rows });
});

statsRouter.get('/by-type', (req, res) => {
  const filters = filterParamsFromRequest(req);
  const limit = Number(qStr(req.query.limit) ?? '15') || 15;
  const { clause, params } = buildWhere(filters);
  const rows = db
    .prepare(
      `SELECT COALESCE(vuln_type, 'Other') as vuln_type, COUNT(*) as count
       FROM cves ${clause}
       GROUP BY vuln_type
       ORDER BY count DESC`
    )
    .all(...(params as never[])) as { vuln_type: string; count: number }[];

  const top = rows.slice(0, limit);
  const rest = rows.slice(limit);
  if (rest.length) {
    const otherCount = rest.reduce((sum, r) => sum + r.count, 0);
    const existingOther = top.find((r) => r.vuln_type === 'Other');
    if (existingOther) {
      existingOther.count += otherCount;
    } else {
      top.push({ vuln_type: 'Other', count: otherCount });
    }
  }
  top.sort((a, b) => b.count - a.count);

  res.json({ rows: top, truncated: rest.length > 0 });
});
