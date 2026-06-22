import fs from 'fs/promises';
import path from 'path';
import { getRepository } from './github.service';

const SKIP_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'coverage', '.cache']);

export interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
}

export async function getRepoTree(userId: string, repositoryId: string): Promise<TreeNode> {
  const repo = await getRepository(userId, repositoryId);
  if (!repo) throw new Error('Repository not found');
  if (!repo.local_path) throw new Error('Repository not cloned yet');
  if (repo.clone_status !== 'ready') throw new Error('Repository clone is not ready');

  const children = await buildTree(repo.local_path, '');
  return { name: 'root', path: '', type: 'directory', children };
}

async function buildTree(basePath: string, relativePath: string): Promise<TreeNode[]> {
  const fullPath = path.join(basePath, relativePath);
  const entries = await fs.readdir(fullPath, { withFileTypes: true });
  const nodes: TreeNode[] = [];

  const sorted = entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  for (const entry of sorted) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const entryPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      const children = await buildTree(basePath, entryPath);
      nodes.push({ name: entry.name, path: entryPath, type: 'directory', children });
    } else {
      nodes.push({ name: entry.name, path: entryPath, type: 'file' });
    }
  }
  return nodes;
}

export async function getRepoFile(
  userId: string,
  repositoryId: string,
  filePath: string
): Promise<{ path: string; content: string; language: string }> {
  const repo = await getRepository(userId, repositoryId);
  if (!repo?.local_path) throw new Error('Repository not available');

  const normalized = filePath.replace(/\\/g, '/').replace(/^\/+/, '');
  const fullPath = path.resolve(repo.local_path, normalized);
  const repoRoot = path.resolve(repo.local_path);

  if (!fullPath.startsWith(repoRoot)) {
    throw new Error('Invalid file path');
  }

  const content = await fs.readFile(fullPath, 'utf8');
  const ext = path.extname(normalized).slice(1);
  return { path: normalized, content, language: ext || 'plaintext' };
}

export async function searchRepoFiles(
  userId: string,
  repositoryId: string,
  query: string
): Promise<{ path: string; type: 'file' }[]> {
  const tree = await getRepoTree(userId, repositoryId);
  const results: { path: string; type: 'file' }[] = [];
  const q = query.toLowerCase();

  function walk(node: TreeNode) {
    if (node.type === 'file' && node.name.toLowerCase().includes(q)) {
      results.push({ path: node.path, type: 'file' });
    }
    node.children?.forEach(walk);
  }

  tree.children?.forEach(walk);
  return results.slice(0, 50);
}
