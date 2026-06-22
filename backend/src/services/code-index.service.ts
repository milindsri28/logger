import fs from 'fs/promises';
import path from 'path';
import { parse } from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { query, queryOne } from '../config/database';
import { CodeIndexEntry, CodeSymbols, Repository } from '../types';

const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);
const SKIP_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'coverage', '.cache']);

export async function indexRepository(repo: Repository): Promise<number> {
  if (!repo.local_path) throw new Error('Repository not cloned');

  await query('DELETE FROM code_index WHERE repository_id = $1', [repo.id]);

  const files = await walkDir(repo.local_path);
  let count = 0;

  for (const filePath of files) {
    const relativePath = path.relative(repo.local_path, filePath).replace(/\\/g, '/');
    const ext = path.extname(filePath);
    const language = ext.slice(1);

    try {
      const content = await fs.readFile(filePath, 'utf8');
      const symbols = extractSymbols(content, ext);
      const contentHash = await hashContent(content);

      await query(
        `INSERT INTO code_index (repository_id, file_path, language, symbols, content_hash)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (repository_id, file_path) DO UPDATE SET symbols = $4, content_hash = $5, indexed_at = NOW()`,
        [repo.id, relativePath, language, JSON.stringify(symbols), contentHash]
      );
      count++;
    } catch (err) {
      console.warn(`Failed to index ${relativePath}:`, err);
    }
  }

  await query(
    `UPDATE repositories SET index_status = 'ready', file_count = $1, last_synced_at = NOW() WHERE id = $2`,
    [count, repo.id]
  );

  return count;
}

async function walkDir(dir: string): Promise<string[]> {
  const results: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await walkDir(fullPath)));
    } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      results.push(fullPath);
    }
  }
  return results;
}

function extractSymbols(content: string, ext: string): CodeSymbols {
  const symbols: CodeSymbols = { functions: [], classes: [], exports: [] };

  try {
    const plugins: ('jsx' | 'typescript')[] = ext === '.tsx' || ext === '.jsx' ? ['jsx'] : [];
    if (ext === '.ts' || ext === '.tsx') plugins.push('typescript');

    const ast = parse(content, {
      sourceType: 'module',
      plugins,
      errorRecovery: true,
    });

    traverse(ast, {
      FunctionDeclaration(nodePath: NodePath<t.FunctionDeclaration>) {
        if (nodePath.node.id?.name) symbols.functions.push(nodePath.node.id.name);
      },
      FunctionExpression(nodePath: NodePath<t.FunctionExpression>) {
        if (nodePath.node.id?.name) symbols.functions.push(nodePath.node.id.name);
      },
      ArrowFunctionExpression(nodePath: NodePath<t.ArrowFunctionExpression>) {
        if (nodePath.parent.type === 'VariableDeclarator' && nodePath.parent.id.type === 'Identifier') {
          symbols.functions.push(nodePath.parent.id.name);
        }
      },
      ClassDeclaration(nodePath: NodePath<t.ClassDeclaration>) {
        if (nodePath.node.id?.name) symbols.classes.push(nodePath.node.id.name);
      },
      ClassMethod(nodePath: NodePath<t.ClassMethod>) {
        if (nodePath.node.key.type === 'Identifier') symbols.functions.push(nodePath.node.key.name);
      },
      ExportNamedDeclaration(nodePath: NodePath<t.ExportNamedDeclaration>) {
        if (nodePath.node.declaration?.type === 'FunctionDeclaration' && nodePath.node.declaration.id) {
          symbols.exports.push(nodePath.node.declaration.id.name);
        }
        if (nodePath.node.declaration?.type === 'ClassDeclaration' && nodePath.node.declaration.id) {
          symbols.exports.push(nodePath.node.declaration.id.name);
        }
      },
      ExportDefaultDeclaration(nodePath: NodePath<t.ExportDefaultDeclaration>) {
        if (nodePath.node.declaration.type === 'Identifier') {
          symbols.exports.push(nodePath.node.declaration.name);
        }
      },
    });
  } catch {
    const fnMatches = content.matchAll(/(?:function|const|let|var)\s+(\w+)\s*(?:=\s*(?:async\s*)?\(|\()/g);
    for (const m of fnMatches) symbols.functions.push(m[1]);
    const classMatches = content.matchAll(/class\s+(\w+)/g);
    for (const m of classMatches) symbols.classes.push(m[1]);
  }

  symbols.functions = [...new Set(symbols.functions)];
  symbols.classes = [...new Set(symbols.classes)];
  symbols.exports = [...new Set(symbols.exports)];
  return symbols;
}

async function hashContent(content: string): Promise<string> {
  const crypto = await import('crypto');
  return crypto.createHash('sha256').update(content).digest('hex');
}

export async function searchCodeIndex(
  repositoryId: string,
  fileReferences: string[],
  functionNames: string[]
): Promise<CodeIndexEntry[]> {
  const results: CodeIndexEntry[] = [];
  const seen = new Set<string>();

  for (const ref of fileReferences) {
    const basename = ref.split(/[/\\]/).pop() || ref;
    const rows = await query<CodeIndexEntry>(
      `SELECT * FROM code_index WHERE repository_id = $1 AND (
        file_path ILIKE $2 OR file_path ILIKE $3 OR file_path = $4
      )`,
      [repositoryId, `%${ref}%`, `%${basename}%`, ref]
    );
    for (const row of rows) {
      if (!seen.has(row.id)) {
        seen.add(row.id);
        results.push({ ...row, symbols: row.symbols as CodeSymbols });
      }
    }
  }

  for (const fn of functionNames) {
    const rows = await query<CodeIndexEntry>(
      `SELECT * FROM code_index WHERE repository_id = $1 AND (
        symbols->'functions' ? $2 OR symbols->'classes' ? $2 OR symbols->'exports' ? $2
      )`,
      [repositoryId, fn]
    );
    for (const row of rows) {
      if (!seen.has(row.id)) {
        seen.add(row.id);
        results.push({ ...row, symbols: row.symbols as CodeSymbols });
      }
    }
  }

  return results;
}

export async function getCodeSnippets(
  repo: Repository,
  filePaths: string[],
  contextLines = 15
): Promise<{ path: string; startLine: number; endLine: number; code: string }[]> {
  if (!repo.local_path) return [];
  const snippets: { path: string; startLine: number; endLine: number; code: string }[] = [];

  for (const filePath of filePaths.slice(0, 10)) {
    const fullPath = path.join(repo.local_path, filePath);
    try {
      const content = await fs.readFile(fullPath, 'utf8');
      const lines = content.split('\n');
      const endLine = Math.min(lines.length, contextLines * 2);
      snippets.push({
        path: filePath,
        startLine: 1,
        endLine,
        code: lines.slice(0, endLine).join('\n'),
      });
    } catch {
      // file not found locally
    }
  }
  return snippets;
}

export async function updateIndexStatus(repoId: string, status: string): Promise<void> {
  await query('UPDATE repositories SET index_status = $1 WHERE id = $2', [status, repoId]);
}
