import type { Request } from 'express';

export function qStr(v: unknown): string | undefined {
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}

export interface FilterParams {
  from?: string;
  to?: string;
  severity?: string;
  type?: string;
  includeRejected?: boolean;
}

export function filterParamsFromRequest(req: Request): FilterParams {
  return {
    from: qStr(req.query.from),
    to: qStr(req.query.to),
    severity: qStr(req.query.severity),
    type: qStr(req.query.type),
    includeRejected: qStr(req.query.includeRejected) === 'true',
  };
}

/** Builds a `WHERE ...` clause (or '') plus its bound params from filter query params. */
export function buildWhere(q: FilterParams): { clause: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (!q.includeRejected) {
    conditions.push("(vuln_status IS NULL OR vuln_status != 'Rejected')");
  }
  if (q.from) {
    conditions.push('published >= ?');
    params.push(q.from);
  }
  if (q.to) {
    conditions.push('published <= ?');
    params.push(q.to);
  }
  if (q.severity) {
    const list = q.severity
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    if (list.length) {
      conditions.push(`severity IN (${list.map(() => '?').join(',')})`);
      params.push(...list);
    }
  }
  if (q.type) {
    const list = q.type
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (list.length) {
      conditions.push(`vuln_type IN (${list.map(() => '?').join(',')})`);
      params.push(...list);
    }
  }

  return {
    clause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}
