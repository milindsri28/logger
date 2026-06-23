import type { ApiEndpoint } from '../types';

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const;

const EXPRESS_PATTERN = new RegExp(
  `(?:router|app)\\.(${HTTP_METHODS.join('|')})\\s*\\(\\s*['"\`]([^'"\`]+)['"\`]`,
  'gi'
);

const NEST_CONTROLLER = /@Controller\s*\(\s*['"\`]?([^'"\`)]*)['"\`]?\s*\)/;
const NEST_METHOD = /@(Get|Post|Put|Patch|Delete|Head|Options)\s*\(\s*['"\`]?([^'"\`)]*)['"\`]?\s*\)/g;

const NEXT_EXPORT_METHOD = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g;
const NEXT_EXPORT_CONST = /export\s+const\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*=/g;

export function analyzeApiInventory(files: Map<string, string>): ApiEndpoint[] {
  const endpoints: ApiEndpoint[] = [];
  const seen = new Set<string>();

  for (const [filePath, content] of files) {
    const normalized = filePath.replace(/\\/g, '/');

    if (isNextAppRoute(normalized)) {
      detectNextAppRoutes(normalized, content, endpoints, seen);
      continue;
    }

    if (isNextPagesApi(normalized)) {
      detectNextPagesApi(normalized, endpoints, seen);
      continue;
    }

    if (isNestFile(content)) {
      detectNestRoutes(normalized, content, endpoints, seen);
    }

    detectExpressRoutes(normalized, content, endpoints, seen);
  }

  return endpoints.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}

function addEndpoint(
  endpoints: ApiEndpoint[],
  seen: Set<string>,
  method: string,
  routePath: string,
  file: string
) {
  const key = `${method}:${routePath}:${file}`;
  if (seen.has(key)) return;
  seen.add(key);
  endpoints.push({ method: method.toUpperCase(), path: routePath, file });
}

function isNextAppRoute(filePath: string): boolean {
  return /(^|\/)app\/api\/.+\/route\.(ts|js|tsx|jsx)$/.test(filePath);
}

function isNextPagesApi(filePath: string): boolean {
  return /(^|\/)pages\/api\/.+\.(ts|js|tsx|jsx)$/.test(filePath);
}

function nextAppRouteToPath(filePath: string): string {
  const match = filePath.match(/(?:^|\/)app(\/api(?:\/.*)?)\/route\.(ts|js|tsx|jsx)$/);
  if (!match) return '/api';
  let route = match[1].replace(/\/route$/, '');
  route = route.replace(/\[\.\.\.(\w+)\]/g, '*').replace(/\[(\w+)\]/g, ':$1');
  return route || '/api';
}

function nextPagesApiToPath(filePath: string): string {
  const match = filePath.match(/(?:^|\/)pages(\/api(?:\/.*)?)\.(ts|js|tsx|jsx)$/);
  if (!match) return '/api';
  let route = match[1];
  route = route.replace(/\[\.\.\.(\w+)\]/g, '*').replace(/\[(\w+)\]/g, ':$1');
  return route || '/api';
}

function detectNextAppRoutes(
  filePath: string,
  content: string,
  endpoints: ApiEndpoint[],
  seen: Set<string>
) {
  const routePath = nextAppRouteToPath(filePath);
  const methods = new Set<string>();

  let m: RegExpExecArray | null;
  const fnPattern = new RegExp(NEXT_EXPORT_METHOD.source, 'g');
  while ((m = fnPattern.exec(content)) !== null) {
    methods.add(m[1]);
  }
  const constPattern = new RegExp(NEXT_EXPORT_CONST.source, 'g');
  while ((m = constPattern.exec(content)) !== null) {
    methods.add(m[1]);
  }

  if (methods.size === 0) {
    addEndpoint(endpoints, seen, 'GET', routePath, filePath);
    return;
  }

  for (const method of methods) {
    addEndpoint(endpoints, seen, method, routePath, filePath);
  }
}

function detectNextPagesApi(filePath: string, endpoints: ApiEndpoint[], seen: Set<string>) {
  const routePath = nextPagesApiToPath(filePath);
  addEndpoint(endpoints, seen, 'ALL', routePath, filePath);
}

function isNestFile(content: string): boolean {
  return content.includes('@Controller') || content.includes('@nestjs/common');
}

function detectNestRoutes(
  filePath: string,
  content: string,
  endpoints: ApiEndpoint[],
  seen: Set<string>
) {
  const controllerMatch = content.match(NEST_CONTROLLER);
  const basePath = normalizePath(controllerMatch?.[1] || '');

  const methodPattern = new RegExp(NEST_METHOD.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = methodPattern.exec(content)) !== null) {
    const method = m[1];
    const subPath = normalizePath(m[2] || '');
    const fullPath = joinPaths(basePath, subPath) || '/';
    addEndpoint(endpoints, seen, method, fullPath, filePath);
  }
}

function detectExpressRoutes(
  filePath: string,
  content: string,
  endpoints: ApiEndpoint[],
  seen: Set<string>
) {
  const pattern = new RegExp(EXPRESS_PATTERN.source, 'gi');
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(content)) !== null) {
    addEndpoint(endpoints, seen, m[1], normalizePath(m[2]), filePath);
  }
}

function normalizePath(p: string): string {
  if (!p) return '';
  let route = p.trim();
  if (!route.startsWith('/')) route = `/${route}`;
  return route.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
}

function joinPaths(base: string, sub: string): string {
  if (!base && !sub) return '/';
  if (!base) return normalizePath(sub);
  if (!sub) return normalizePath(base);
  return normalizePath(`${base}/${sub.replace(/^\//, '')}`);
}
