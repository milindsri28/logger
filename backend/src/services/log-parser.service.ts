import { ExtractedSignals, StackFrame } from '../types';

const ERROR_PATTERNS = [
  /Error:\s*(.+)/gi,
  /TypeError:\s*(.+)/gi,
  /ReferenceError:\s*(.+)/gi,
  /SyntaxError:\s*(.+)/gi,
  /ECONNREFUSED[^\n]*/gi,
  /ECONNRESET[^\n]*/gi,
  /ETIMEDOUT[^\n]*/gi,
  /ENOMEM[^\n]*/gi,
  /FATAL ERROR[^\n]*/gi,
  /UnhandledPromiseRejectionWarning[^\n]*/gi,
  /\[error\][^\n]*/gi,
];

const STACK_FRAME_PATTERN = /at\s+(?:(.+?)\s+\()?(?:(.+?):(\d+):(\d+)|(.+?))\)?/g;

const HTTP_ERROR_PATTERN = /(?:HTTP\/\d\.\d"\s+)?(\d{3})\s+(?:[^\s]+\s+)?(?:GET|POST|PUT|DELETE|PATCH)\s+(\S+)/gi;

const SERVICE_PATTERNS = [
  /\[(\w+(?:-\w+)*)\]/g,
  /process\s+id\s+(\d+)/gi,
  /PM2\s+\|\s+(\S+)/gi,
  /container[:\s]+(\S+)/gi,
];

export function parseLogs(rawLogs: string): ExtractedSignals {
  const errors = new Set<string>();
  const fileReferences = new Set<string>();
  const serviceNames = new Set<string>();
  const stackTraces: { frames: StackFrame[] }[] = [];
  const httpErrors: { status: number; path?: string }[] = [];

  for (const pattern of ERROR_PATTERNS) {
    const matches = rawLogs.matchAll(pattern);
    for (const match of matches) {
      errors.add(match[0].trim().slice(0, 500));
    }
  }

  const stackBlocks = rawLogs.split(/\n(?=\s*at\s+)/);
  for (const block of stackBlocks) {
    if (!block.includes(' at ')) continue;
    const frames: StackFrame[] = [];
    const frameMatches = block.matchAll(STACK_FRAME_PATTERN);
    for (const match of frameMatches) {
      const functionName = match[1] || '<anonymous>';
      const file = match[2] || match[5] || '';
      const line = parseInt(match[3] || '0', 10);
      const column = parseInt(match[4] || '0', 10);
      if (file) {
        frames.push({ functionName, file, line, column });
        fileReferences.add(file);
        const basename = file.split(/[/\\]/).pop();
        if (basename) fileReferences.add(basename);
      }
    }
    if (frames.length > 0) stackTraces.push({ frames });
  }

  const httpMatches = rawLogs.matchAll(HTTP_ERROR_PATTERN);
  for (const match of httpMatches) {
    const status = parseInt(match[1], 10);
    if (status >= 400) {
      httpErrors.push({ status, path: match[2] });
    }
  }

  for (const pattern of SERVICE_PATTERNS) {
    const matches = rawLogs.matchAll(pattern);
    for (const match of matches) {
      if (match[1] && match[1].length > 2 && match[1].length < 50) {
        serviceNames.add(match[1]);
      }
    }
  }

  const filePathPattern = /(?:\/[\w.-]+)+\.(?:js|ts|jsx|tsx)/g;
  const fileMatches = rawLogs.matchAll(filePathPattern);
  for (const match of fileMatches) {
    fileReferences.add(match[0]);
    const basename = match[0].split('/').pop();
    if (basename) fileReferences.add(basename);
  }

  return {
    errors: [...errors].slice(0, 50),
    stackTraces: stackTraces.slice(0, 20),
    fileReferences: [...fileReferences].slice(0, 100),
    serviceNames: [...serviceNames].slice(0, 20),
    httpErrors: httpErrors.slice(0, 30),
  };
}
