import { getFileContent } from '../file-walker';
import type { ProjectInfo } from '../types';

export function analyzeProjectInfo(files: Map<string, string>): ProjectInfo {
  const packageJson = getFileContent(files, 'package.json');
  const requirements = getFileContent(files, 'requirements.txt');
  const pomXml = getFileContent(files, 'pom.xml');
  const dockerfile = findDockerfile(files);

  let framework = '';
  let language = '';
  let packageManager = detectPackageManager(files);

  if (packageJson) {
    try {
      const pkg = JSON.parse(packageJson) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      framework = detectNodeFramework(deps, files);
      language = detectJsLanguage(files);
    } catch {
      language = 'JavaScript';
    }
  } else if (requirements) {
    framework = detectPythonFramework(requirements);
    language = 'Python';
    packageManager = packageManager || 'pip';
  } else if (pomXml) {
    framework = detectJavaFramework(pomXml);
    language = 'Java';
    packageManager = 'maven';
  } else if (dockerfile) {
    language = detectLanguageFromDockerfile(dockerfile);
    framework = detectFrameworkFromDockerfile(dockerfile);
  }

  if (!language) {
    language = inferLanguageFromExtensions(files);
  }

  return {
    framework: framework || 'Unknown',
    language: language || 'Unknown',
    packageManager: packageManager || 'Unknown',
  };
}

function findDockerfile(files: Map<string, string>): string | null {
  for (const [path, content] of files) {
    const base = path.split('/').pop()?.toLowerCase() || '';
    if (base === 'dockerfile' || base.startsWith('dockerfile.')) return content;
  }
  return null;
}

function detectPackageManager(files: Map<string, string>): string {
  if (files.has('pnpm-lock.yaml')) return 'pnpm';
  if (files.has('yarn.lock')) return 'yarn';
  if (files.has('package-lock.json')) return 'npm';
  if (files.has('bun.lockb') || files.has('bun.lock')) return 'bun';
  if (files.has('poetry.lock')) return 'poetry';
  if (files.has('Pipfile')) return 'pipenv';
  if (files.has('requirements.txt')) return 'pip';
  if (files.has('pom.xml')) return 'maven';
  if (files.has('build.gradle') || files.has('build.gradle.kts')) return 'gradle';
  return '';
}

function detectNodeFramework(
  deps: Record<string, string>,
  files: Map<string, string>
): string {
  if (deps.next) return 'Next.js';
  if (deps['@nestjs/core']) return 'NestJS';
  if (deps.express) return 'Express';
  if (deps.fastify) return 'Fastify';
  if (deps.react && !deps.next) return 'React';
  if (deps.vue) return 'Vue';
  if (deps['@angular/core']) return 'Angular';
  if (deps.svelte || deps['@sveltejs/kit']) return 'Svelte';

  const hasNextConfig = Array.from(files.keys()).some(
    (p) => p === 'next.config.js' || p === 'next.config.mjs' || p === 'next.config.ts'
  );
  if (hasNextConfig) return 'Next.js';

  return '';
}

function detectJsLanguage(files: Map<string, string>): string {
  let ts = 0;
  let js = 0;
  for (const p of files.keys()) {
    if (p.endsWith('.ts') || p.endsWith('.tsx')) ts++;
    if (p.endsWith('.js') || p.endsWith('.jsx')) js++;
  }
  if (ts > 0) return 'TypeScript';
  if (js > 0) return 'JavaScript';
  return '';
}

function detectPythonFramework(requirements: string): string {
  const lower = requirements.toLowerCase();
  if (lower.includes('fastapi')) return 'FastAPI';
  if (lower.includes('django')) return 'Django';
  if (lower.includes('flask')) return 'Flask';
  return '';
}

function detectJavaFramework(pomXml: string): string {
  const lower = pomXml.toLowerCase();
  if (lower.includes('spring-boot')) return 'Spring Boot';
  if (lower.includes('quarkus')) return 'Quarkus';
  return '';
}

function detectLanguageFromDockerfile(content: string): string {
  const lower = content.toLowerCase();
  if (lower.includes('node:') || lower.includes('nodejs')) return 'JavaScript';
  if (lower.includes('python:')) return 'Python';
  if (lower.includes('openjdk') || lower.includes('eclipse-temurin')) return 'Java';
  if (lower.includes('golang:') || lower.includes('go:')) return 'Go';
  return '';
}

function detectFrameworkFromDockerfile(content: string): string {
  const lower = content.toLowerCase();
  if (lower.includes('next')) return 'Next.js';
  if (lower.includes('nestjs')) return 'NestJS';
  if (lower.includes('django')) return 'Django';
  if (lower.includes('fastapi')) return 'FastAPI';
  return '';
}

function inferLanguageFromExtensions(files: Map<string, string>): string {
  const counts: Record<string, number> = {};
  for (const p of files.keys()) {
    const ext = p.split('.').pop()?.toLowerCase() || '';
    if (ext) counts[ext] = (counts[ext] || 0) + 1;
  }
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const top = ranked[0]?.[0];
  const map: Record<string, string> = {
    ts: 'TypeScript',
    tsx: 'TypeScript',
    js: 'JavaScript',
    jsx: 'JavaScript',
    py: 'Python',
    java: 'Java',
    go: 'Go',
    rs: 'Rust',
    rb: 'Ruby',
    php: 'PHP',
  };
  return map[top || ''] || '';
}
