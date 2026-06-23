import fs from 'fs/promises';
import path from 'path';

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'coverage',
  '.cache',
  '__pycache__',
  'venv',
  '.venv',
  'target',
]);

const TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '.java',
  '.go',
  '.rs',
  '.rb',
  '.php',
  '.json',
  '.yml',
  '.yaml',
  '.xml',
  '.toml',
  '.env',
  '.md',
  '.sql',
  '.gradle',
  '.properties',
  '.dockerfile',
]);

const MAX_FILE_SIZE = 512 * 1024;

export interface WalkStats {
  totalFiles: number;
  totalFolders: number;
}

export async function walkRepository(
  rootPath: string
): Promise<{ files: Map<string, string>; stats: WalkStats }> {
  const files = new Map<string, string>();
  const stats: WalkStats = { totalFiles: 0, totalFolders: 0 };

  async function walk(dir: string, relative: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;

      const rel = relative ? `${relative}/${entry.name}` : entry.name;
      const full = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        stats.totalFolders++;
        await walk(full, rel);
      } else if (entry.isFile()) {
        stats.totalFiles++;
        const ext = path.extname(entry.name).toLowerCase();
        const base = entry.name.toLowerCase();
        const isText =
          TEXT_EXTENSIONS.has(ext) ||
          base === 'dockerfile' ||
          base.startsWith('.env') ||
          base === 'makefile' ||
          base === 'pom.xml' ||
          base === 'requirements.txt';

        if (!isText) continue;

        try {
          const stat = await fs.stat(full);
          if (stat.size > MAX_FILE_SIZE) continue;
          const content = await fs.readFile(full, 'utf8');
          files.set(rel.replace(/\\/g, '/'), content);
        } catch {
          // skip unreadable files
        }
      }
    }
  }

  await walk(rootPath, '');
  return { files, stats };
}

export function getFileContent(files: Map<string, string>, ...candidates: string[]): string | null {
  for (const candidate of candidates) {
    const normalized = candidate.replace(/\\/g, '/');
    const content = files.get(normalized);
    if (content !== undefined) return content;
  }
  return null;
}

export function findFilesMatching(files: Map<string, string>, pattern: RegExp): string[] {
  return Array.from(files.keys()).filter((p) => pattern.test(p));
}
