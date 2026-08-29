import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, 'cve.db'));
db.exec('PRAGMA journal_mode = WAL;');
db.exec(readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8'));

export interface ClassifiedCve {
  id: string;
  published: string;
  lastModified: string;
  vulnStatus: string | null;
  description: string | null;
  cvssVersion: string | null;
  cvssScore: number | null;
  severity: string | null;
  cweIds: string[];
  vulnType: string;
  raw: unknown;
}

const upsertStmt = db.prepare(`
  INSERT INTO cves (id, published, last_modified, vuln_status, description, cvss_version, cvss_score, severity, cwe_ids, vuln_type, raw_json)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    published=excluded.published,
    last_modified=excluded.last_modified,
    vuln_status=excluded.vuln_status,
    description=excluded.description,
    cvss_version=excluded.cvss_version,
    cvss_score=excluded.cvss_score,
    severity=excluded.severity,
    cwe_ids=excluded.cwe_ids,
    vuln_type=excluded.vuln_type,
    raw_json=excluded.raw_json
`);

// node:sqlite's DatabaseSync API is synchronous, so a single BEGIN..COMMIT
// covering an entire NVD page (up to ~2000 records) blocks the event loop —
// and with it every in-flight HTTP request, including the liveness probe —
// for the whole write. Committing in smaller chunks and yielding to the
// event loop between them keeps any one blocking stretch short enough for
// the server to keep serving requests during a large sync.
const UPSERT_CHUNK_SIZE = 200;

export async function upsertCves(records: ClassifiedCve[]): Promise<void> {
  if (records.length === 0) return;
  for (let i = 0; i < records.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = records.slice(i, i + UPSERT_CHUNK_SIZE);
    db.exec('BEGIN');
    try {
      for (const c of chunk) {
        upsertStmt.run(
          c.id,
          c.published,
          c.lastModified,
          c.vulnStatus,
          c.description,
          c.cvssVersion,
          c.cvssScore,
          c.severity,
          JSON.stringify(c.cweIds),
          c.vulnType,
          JSON.stringify(c.raw)
        );
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
    await new Promise((resolve) => setImmediate(resolve));
  }
}

const getStateStmt = db.prepare('SELECT value FROM sync_state WHERE key = ?');
const setStateStmt = db.prepare(
  'INSERT INTO sync_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
);

export function getSyncState(key: string): string | null {
  const row = getStateStmt.get(key) as { value: string } | undefined;
  return row ? row.value : null;
}

export function setSyncState(key: string, value: string): void {
  setStateStmt.run(key, value);
}
