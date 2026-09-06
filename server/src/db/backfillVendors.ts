import { db, getSyncState, setSyncState } from './client.js';

// Existing rows were synced before cve_vendors existed, so their vendor data
// has to be derived from the raw_json already on disk. Runs in small,
// yielding chunks (same reasoning as upsertCves's chunking) so it never
// blocks the event loop long enough to fail the liveness probe, and is
// resumable via a cursor in sync_state in case the pod restarts mid-run.
const BACKFILL_CHUNK_SIZE = 500;
const DONE_KEY = 'vendor_backfill_done';
const CURSOR_KEY = 'vendor_backfill_cursor';

const deleteVendorsStmt = db.prepare('DELETE FROM cve_vendors WHERE cve_id = ?');
const insertVendorStmt = db.prepare(
  'INSERT INTO cve_vendors (cve_id, vendor) VALUES (?, ?) ON CONFLICT(cve_id, vendor) DO NOTHING'
);
const nextChunkStmt = db.prepare(
  'SELECT id, raw_json FROM cves WHERE id > ? ORDER BY id LIMIT ?'
);

function vendorFromCriteria(criteria: string): string | null {
  const parts = criteria.split(':');
  const vendor = parts[3];
  return vendor && vendor !== '*' && vendor !== '-' ? vendor : null;
}

interface ConfigNode {
  cpeMatch?: { criteria?: string }[];
  children?: ConfigNode[];
}

function collectVendorsFromNodes(nodes: ConfigNode[] | undefined, out: Set<string>): void {
  for (const node of nodes ?? []) {
    for (const match of node.cpeMatch ?? []) {
      if (match.criteria) {
        const vendor = vendorFromCriteria(match.criteria);
        if (vendor) out.add(vendor);
      }
    }
    collectVendorsFromNodes(node.children, out);
  }
}

function vendorsFromRawJson(rawJson: string): string[] {
  const record = JSON.parse(rawJson) as { configurations?: { nodes?: ConfigNode[] }[] };
  const vendors = new Set<string>();
  for (const config of record.configurations ?? []) {
    collectVendorsFromNodes(config.nodes, vendors);
  }
  return [...vendors];
}

export async function backfillVendorsIfNeeded(): Promise<void> {
  if (getSyncState(DONE_KEY) === 'true') return;

  let cursor = getSyncState(CURSOR_KEY) ?? '';
  let processed = 0;

  for (;;) {
    const rows = nextChunkStmt.all(cursor, BACKFILL_CHUNK_SIZE) as { id: string; raw_json: string }[];
    if (rows.length === 0) break;

    db.exec('BEGIN');
    try {
      for (const row of rows) {
        deleteVendorsStmt.run(row.id);
        for (const vendor of vendorsFromRawJson(row.raw_json)) {
          insertVendorStmt.run(row.id, vendor);
        }
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    cursor = rows[rows.length - 1].id;
    processed += rows.length;
    setSyncState(CURSOR_KEY, cursor);
    await new Promise((resolve) => setImmediate(resolve));
  }

  setSyncState(DONE_KEY, 'true');
  console.log(`[vendor-backfill] complete: ${processed} rows processed this run`);
}
