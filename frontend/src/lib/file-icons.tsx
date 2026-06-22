import {
  FileCode2,
  FileJson,
  FileText,
  Folder,
  FolderOpen,
  Image,
  Settings,
  Braces,
  Database,
  Container,
} from 'lucide-react';

export function getFileIcon(name: string, isOpen?: boolean) {
  const ext = name.split('.').pop()?.toLowerCase();
  const cls = 'size-4 shrink-0 opacity-80';

  if (name === 'package.json' || name === 'tsconfig.json') return <FileJson className={cls} />;
  if (name === 'docker-compose.yml' || name === 'Dockerfile') return <Container className={cls} />;
  if (name.includes('docker')) return <Container className={cls} />;

  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
      return <FileCode2 className={cls} />;
    case 'json':
      return <FileJson className={cls} />;
    case 'md':
      return <FileText className={cls} />;
    case 'png':
    case 'jpg':
    case 'svg':
      return <Image className={cls} />;
    case 'sql':
      return <Database className={cls} />;
    case 'env':
      return <Settings className={cls} />;
    case 'yml':
    case 'yaml':
      return <Braces className={cls} />;
    default:
      return <FileText className={cls} />;
  }
}

export function getFolderIcon(isOpen: boolean) {
  const cls = 'size-4 shrink-0 text-amber-400/80';
  return isOpen ? <FolderOpen className={cls} /> : <Folder className={cls} />;
}
