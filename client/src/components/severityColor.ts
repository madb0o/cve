const MAP: Record<string, string> = {
  CRITICAL: 'var(--status-critical)',
  HIGH: 'var(--status-serious)',
  MEDIUM: 'var(--status-warning)',
  LOW: 'var(--status-good)',
  NONE: 'var(--status-none)',
  UNKNOWN: 'var(--status-none)',
};

export function severityColor(severity: string | null | undefined): string {
  if (!severity) return MAP.UNKNOWN;
  return MAP[severity.toUpperCase()] ?? MAP.UNKNOWN;
}
