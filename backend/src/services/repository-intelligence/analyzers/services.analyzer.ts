export function analyzeServices(files: Map<string, string>): string[] {
  const services = new Set<string>();

  for (const [filePath, content] of files) {
    const base = filePath.split('/').pop()?.toLowerCase() || '';
    if (
      base === 'docker-compose.yml' ||
      base === 'docker-compose.yaml' ||
      base === 'docker-compose.prod.yml' ||
      base === 'docker-compose.prod.yaml' ||
      base.startsWith('docker-compose.')
    ) {
      parseDockerComposeServices(content, services);
    }

    if (base === 'dockerfile' || base.startsWith('dockerfile.')) {
      const name = inferDockerImageName(content, filePath);
      if (name) services.add(name);
    }
  }

  return Array.from(services).sort();
}

function parseDockerComposeServices(content: string, services: Set<string>): void {
  const lines = content.split('\n');
  let inServices = false;
  let servicesIndent = -1;

  for (const line of lines) {
    if (/^\s*services\s*:/.test(line)) {
      inServices = true;
      servicesIndent = line.search(/\S/);
      continue;
    }

    if (!inServices) continue;

    const indent = line.search(/\S/);
    if (indent === -1) continue;

    if (indent <= servicesIndent && /^\s*\w+/.test(line) && !/^\s*services/.test(line)) {
      inServices = false;
      continue;
    }

    const serviceMatch = line.match(new RegExp(`^\\s{${servicesIndent + 2}}([a-zA-Z0-9._-]+)\\s*:`));
    if (serviceMatch && indent === servicesIndent + 2) {
      const name = serviceMatch[1];
      if (!['version', 'networks', 'volumes', 'configs', 'secrets'].includes(name)) {
        services.add(name);
      }
    }
  }

  if (services.size === 0) {
    const blockMatch = content.match(/services\s*:\s*\n([\s\S]*?)(?:\n[a-z]+\s*:|$)/i);
    if (blockMatch) {
      const serviceNamePattern = /^\s{2}([a-zA-Z0-9._-]+)\s*:/gm;
      let m: RegExpExecArray | null;
      while ((m = serviceNamePattern.exec(blockMatch[1])) !== null) {
        services.add(m[1]);
      }
    }
  }
}

function inferDockerImageName(content: string, filePath: string): string | null {
  const labelMatch = content.match(/LABEL\s+[^=\n]*service[.\s]*name\s*=\s*["']?([^"'\n]+)/i);
  if (labelMatch) return labelMatch[1].trim();

  const dir = filePath.includes('/') ? filePath.split('/').slice(-2, -1)[0] : null;
  if (dir && dir !== '.') return dir;

  return 'docker-image';
}
