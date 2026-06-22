'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const Monaco = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

const LANG_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  json: 'json',
  md: 'markdown',
  yml: 'yaml',
  yaml: 'yaml',
  css: 'css',
  html: 'html',
  sh: 'shell',
  sql: 'sql',
  env: 'plaintext',
};

interface CodeEditorProps {
  value: string;
  language?: string;
  readOnly?: boolean;
  path?: string;
}

export function CodeEditor({ value, language, readOnly = false, path }: CodeEditorProps) {
  const ext = path?.split('.').pop() || language || 'plaintext';
  const monacoLang = LANG_MAP[ext] || ext;

  return (
    <div className="relative isolate z-0 h-full w-full min-w-0 overflow-hidden">
      <Monaco
        height="100%"
        language={monacoLang}
        value={value}
        theme="vs-dark"
        options={{
          readOnly,
          minimap: { enabled: !readOnly },
          fontSize: 13,
          fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          automaticLayout: true,
          padding: { top: 8 },
          renderLineHighlight: readOnly ? 'none' : 'line',
        }}
      />
    </div>
  );
}
