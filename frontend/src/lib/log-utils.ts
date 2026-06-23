export type LogSeverity = 'all' | 'info' | 'warn' | 'error';

export interface ParsedLogLine {
  lineNumber: number;
  raw: string;
  severity: 'info' | 'warn' | 'error' | 'unknown';
  timestamp: Date | null;
}

const SEVERITY_PATTERNS: Array<{ severity: ParsedLogLine['severity']; pattern: RegExp }> = [
  { severity: 'error', pattern: /\b(ERROR|FATAL|CRITICAL|ERR)\b/i },
  { severity: 'warn', pattern: /\b(WARN|WARNING)\b/i },
  { severity: 'info', pattern: /\b(INFO)\b/i },
];

const TIMESTAMP_PATTERNS = [
  // ISO / PM2: 2026-06-23T09:26:55 or 2026-06-23 09:26:55 +00:00
  /(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:\s*(?:Z|[+-]\d{2}:?\d{2}))?)/,
  // PM2 pipe prefix: 0|app | 2026-06-23 09:26:55:
  /\|\s*(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})/,
  // Bracketed: [2026-06-23 09:26:55]
  /\[(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:\.\d+)?)\]/,
  // US: 06/23/2026, 09:26:55
  /(\d{2}\/\d{2}\/\d{4},?\s+\d{2}:\d{2}:\d{2}(?:\.\d+)?)/,
  // Syslog-ish: Jun 23 09:26:55
  /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})/i,
];

export function detectSeverity(line: string): ParsedLogLine['severity'] {
  for (const { severity, pattern } of SEVERITY_PATTERNS) {
    if (pattern.test(line)) return severity;
  }
  return 'unknown';
}

export function extractTimestamp(line: string): Date | null {
  for (const pattern of TIMESTAMP_PATTERNS) {
    const match = line.match(pattern);
    if (match) {
      const d = new Date(match[1]);
      if (!isNaN(d.getTime())) return d;
    }
  }
  return null;
}

function enrichTimestamps(lines: ParsedLogLine[]): ParsedLogLine[] {
  let lastTs: Date | null = null;
  return lines.map((line) => {
    if (line.timestamp) {
      lastTs = line.timestamp;
      return line;
    }
    if (lastTs) {
      return { ...line, timestamp: lastTs };
    }
    return line;
  });
}

export function parseLogLines(raw: string): ParsedLogLine[] {
  const lines = raw.split('\n').map((line, i) => ({
    lineNumber: i + 1,
    raw: line,
    severity: detectSeverity(line),
    timestamp: extractTimestamp(line),
  }));
  return enrichTimestamps(lines);
}

export function filterLogLines(
  lines: ParsedLogLine[],
  opts: {
    severity: LogSeverity;
    timeRangeMinutes: number | null;
    search: string;
  }
): ParsedLogLine[] {
  const now = Date.now();
  const searchLower = opts.search.trim().toLowerCase();

  return lines.filter((line) => {
    if (opts.severity !== 'all') {
      if (opts.severity === 'info' && line.severity !== 'info') return false;
      if (opts.severity === 'warn' && line.severity !== 'warn') return false;
      if (opts.severity === 'error' && line.severity !== 'error') return false;
    }

    if (opts.timeRangeMinutes != null && opts.timeRangeMinutes > 0) {
      if (!line.timestamp) return false;
      const ageMs = now - line.timestamp.getTime();
      if (ageMs > opts.timeRangeMinutes * 60 * 1000) return false;
    }

    if (searchLower && !line.raw.toLowerCase().includes(searchLower)) return false;

    return true;
  });
}

export const TIME_RANGE_OPTIONS = [
  { value: '', label: 'All' },
  { value: '15', label: '15m' },
  { value: '60', label: '1h' },
  { value: '360', label: '6h' },
  { value: '1440', label: '24h' },
] as const;

export const SEVERITY_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'info', label: 'Info' },
  { value: 'warn', label: 'Warn' },
  { value: 'error', label: 'Error' },
] as const;

export const LINES_PER_PAGE = 100;
