const DATABASE_SIGNATURES: { name: string; patterns: RegExp[] }[] = [
  { name: 'MongoDB', patterns: [/\bmongoose\b/i, /\bmongodb\b/i, /from\s+['"]mongoose['"]/i] },
  { name: 'PostgreSQL', patterns: [/\bpostgres(?:ql)?\b/i, /\bfrom\s+['"]pg['"]/i, /\bpg-pool\b/i] },
  { name: 'MySQL', patterns: [/\bmysql\b/i, /\bmysql2\b/i] },
  { name: 'Redis', patterns: [/\bredis\b/i, /\bioredis\b/i, /from\s+['"]redis['"]/i] },
  { name: 'Firebase', patterns: [/\bfirebase\b/i, /\bfirebase-admin\b/i, /from\s+['"]firebase/i] },
];

export function analyzeDatabases(files: Map<string, string>): string[] {
  const found = new Set<string>();
  const corpus = Array.from(files.entries())
    .map(([p, c]) => `${p}\n${c}`)
    .join('\n');

  for (const { name, patterns } of DATABASE_SIGNATURES) {
    if (patterns.some((p) => p.test(corpus))) {
      found.add(name);
    }
  }

  return Array.from(found).sort();
}
