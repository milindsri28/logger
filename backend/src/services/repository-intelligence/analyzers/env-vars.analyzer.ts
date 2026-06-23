const ENV_LINE = /^(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=/;

const PROCESS_ENV_PATTERNS = [
  /process\.env\.([A-Z][A-Z0-9_]*)/g,
  /process\.env\[['"]([A-Z][A-Z0-9_]*)['"]\]/g,
  /os\.environ\[['"]([A-Z][A-Z0-9_]*)['"]\]/g,
  /os\.environ\.get\(['"]([A-Z][A-Z0-9_]*)['"]\)/g,
  /os\.getenv\(['"]([A-Z][A-Z0-9_]*)['"]\)/g,
];

export function analyzeEnvVars(files: Map<string, string>): string[] {
  const vars = new Set<string>();

  for (const [filePath, content] of files) {
    const base = filePath.split('/').pop() || '';
    if (base === '.env.example' || base === '.env.sample' || base === '.env.template' || base.startsWith('.env.')) {
      if (base === '.env' || base === '.env.local' || base === '.env.production') continue;
      parseEnvExample(content, vars);
    }

    for (const pattern of PROCESS_ENV_PATTERNS) {
      const re = new RegExp(pattern.source, pattern.flags);
      let m: RegExpExecArray | null;
      while ((m = re.exec(content)) !== null) {
        vars.add(m[1]);
      }
    }
  }

  return Array.from(vars).sort();
}

function parseEnvExample(content: string, vars: Set<string>): void {
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(ENV_LINE);
    if (match) vars.add(match[1]);
  }
}
