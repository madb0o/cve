import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { ClassifiedCve } from '../db/client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cweCategories: Record<string, string> = JSON.parse(
  readFileSync(path.join(__dirname, 'cweCategories.json'), 'utf-8')
);

interface CvssData {
  baseScore?: number;
  baseSeverity?: string;
}

interface CvssMetric {
  cvssData?: CvssData;
  baseSeverity?: string;
}

interface NvdCveRecord {
  id: string;
  published: string;
  lastModified: string;
  vulnStatus?: string;
  descriptions?: { lang: string; value: string }[];
  metrics?: {
    cvssMetricV40?: CvssMetric[];
    cvssMetricV31?: CvssMetric[];
    cvssMetricV30?: CvssMetric[];
    cvssMetricV2?: CvssMetric[];
  };
  weaknesses?: { description?: { lang: string; value: string }[] }[];
}

function bucketV2Severity(score: number): string {
  if (score >= 7.0) return 'HIGH';
  if (score >= 4.0) return 'MEDIUM';
  return 'LOW';
}

function resolveCvss(record: NvdCveRecord): {
  version: string | null;
  score: number | null;
  severity: string | null;
} {
  const m = record.metrics ?? {};
  const preferenceOrder: [string, CvssMetric[] | undefined][] = [
    ['3.1', m.cvssMetricV31],
    ['3.0', m.cvssMetricV30],
    ['4.0', m.cvssMetricV40],
    ['2.0', m.cvssMetricV2],
  ];

  for (const [version, metrics] of preferenceOrder) {
    const metric = metrics?.[0];
    if (!metric) continue;
    const score = metric.cvssData?.baseScore ?? null;
    let severity = metric.cvssData?.baseSeverity ?? metric.baseSeverity ?? null;
    if (!severity && version === '2.0' && score != null) {
      severity = bucketV2Severity(score);
    }
    if (score != null || severity) {
      return { version, score, severity };
    }
  }

  return { version: null, score: null, severity: null };
}

function resolveCweIds(record: NvdCveRecord): string[] {
  const ids = new Set<string>();
  for (const weakness of record.weaknesses ?? []) {
    for (const desc of weakness.description ?? []) {
      if (desc.lang === 'en' && /^CWE-\d+$/.test(desc.value)) {
        ids.add(desc.value);
      }
    }
  }
  return [...ids];
}

function resolveVulnType(cweIds: string[]): string {
  for (const id of cweIds) {
    const category = cweCategories[id];
    if (category) return category;
  }
  return 'Other';
}

export function classifyCve(record: NvdCveRecord): ClassifiedCve {
  const { version, score, severity } = resolveCvss(record);
  const cweIds = resolveCweIds(record);
  const description =
    record.descriptions?.find((d) => d.lang === 'en')?.value ?? record.descriptions?.[0]?.value ?? null;

  return {
    id: record.id,
    published: record.published,
    lastModified: record.lastModified,
    vulnStatus: record.vulnStatus ?? null,
    description,
    cvssVersion: version,
    cvssScore: score,
    severity: severity ? severity.toUpperCase() : null,
    cweIds,
    vulnType: resolveVulnType(cweIds),
    raw: record,
  };
}
