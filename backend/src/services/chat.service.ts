import { analyzeWithOpenAIChat, analyzeWithGeminiChat } from './llm.service';
import { getRepoFile } from './repo.service';
import { getRepository, getRecentCommits, getRelevantFiles, getCommitsForFiles } from './github.service';
import { getAgentForUser } from './agents/agent.service';
import { fetchAgentServiceLogs } from './agents/agent-logs.service';
import { parseLogs } from './log-parser.service';
import { searchCodeIndex, getCodeSnippets } from './code-index.service';
import { ApiError } from '../utils/api-error';

export type ChatMode = 'question' | 'analyze_logs' | 'analyze_repository' | 'correlate';

export interface ChatMessageInput {
  repositoryId: string;
  agentId: string;
  serviceName: string;
  selectedFile?: string;
  message: string;
  mode?: ChatMode;
}

export interface ChatMessageResult {
  reply: string;
  contextUsed: {
    service: string;
    file?: string;
    logLineCount: number;
    fileCount: number;
    commitCount: number;
  };
}

function extractQueryKeywords(message: string): string[] {
  return message
    .toLowerCase()
    .split(/[^a-z0-9_./-]+/)
    .filter((w) => w.length > 3)
    .slice(0, 12);
}

export async function handleChatMessage(
  userId: string,
  input: ChatMessageInput
): Promise<ChatMessageResult> {
  const repo = await getRepository(userId, input.repositoryId);
  if (!repo || repo.clone_status !== 'ready') {
    throw new ApiError('REPO_NOT_READY', 'Repository not ready');
  }
  if (repo.index_status !== 'ready') {
    throw new ApiError('REPO_NOT_READY', 'Repository index is not ready');
  }

  const agent = await getAgentForUser(userId, input.agentId);
  if (!agent) throw new ApiError('AGENT_NOT_FOUND', 'Agent not found', 404);

  const mode = input.mode || 'question';
  const logs =
    mode === 'analyze_repository'
      ? ''
      : await fetchAgentServiceLogs(input.agentId, input.serviceName, 500);

  const signals = logs ? parseLogs(logs) : null;
  const queryKeywords = extractQueryKeywords(input.message);
  const fileRefs = [
    ...(signals?.fileReferences || []),
    ...queryKeywords.filter((k) => k.includes('/') || k.includes('.')),
  ];
  const functionNames = signals?.stackTraces.flatMap((st) => st.frames.map((f) => f.functionName)) || [];

  const matchedFiles = await searchCodeIndex(repo.id, fileRefs, functionNames);
  let filePaths = matchedFiles.map((f) => f.file_path);

  if (input.selectedFile && !filePaths.includes(input.selectedFile)) {
    filePaths = [input.selectedFile, ...filePaths].slice(0, 12);
  }

  let fileSnippet = '';
  if (input.selectedFile) {
    try {
      const file = await getRepoFile(userId, input.repositoryId, input.selectedFile);
      fileSnippet = file.content.split('\n').slice(0, 100).join('\n');
    } catch {
      // skip
    }
  }

  let codeSnippets =
    mode === 'analyze_logs' ? [] : await getCodeSnippets(repo, filePaths.slice(0, 8));
  let commitsSection = '';
  let filesSection = '';

  if (mode === 'analyze_repository' || mode === 'correlate') {
    const files = await getRelevantFiles(repo, 10);
    filesSection = files.map((f) => `- ${f.path} (${f.changeCount} recent changes)`).join('\n');
  }

  if (mode === 'correlate' || mode === 'question') {
    const commits = await getCommitsForFiles(repo, filePaths.slice(0, 8));
    const recent = mode === 'correlate' ? await getRecentCommits(repo, 10) : commits;
    const merged = [...commits, ...recent].filter(
      (c, i, arr) => arr.findIndex((x) => x.sha === c.sha) === i
    );
    commitsSection = merged
      .slice(0, 12)
      .map((c) => `- ${c.sha.slice(0, 7)} ${c.message} by ${c.author} (${c.date})`)
      .join('\n');
  }

  if (codeSnippets.length === 0 && filePaths.length > 0 && mode !== 'analyze_logs') {
    codeSnippets = await getCodeSnippets(repo, filePaths.slice(0, 5));
  }

  const codeSection = codeSnippets
    .map((s) => `### ${s.path}\n\`\`\`\n${s.code.slice(0, 2000)}\n\`\`\``)
    .join('\n\n');

  const prompt = buildChatPrompt({
    message: input.message,
    serviceName: input.serviceName,
    repoName: `${repo.owner}/${repo.name}`,
    logs,
    signalsSummary: signals
      ? `Errors: ${signals.errors.slice(0, 8).join('; ') || 'none'}\nHTTP errors: ${signals.httpErrors.map((e) => `${e.status} ${e.path || ''}`).join(', ') || 'none'}`
      : '',
    filePath: input.selectedFile,
    fileSnippet: mode === 'analyze_logs' ? '' : fileSnippet,
    mode,
    commitsSection,
    filesSection,
    codeSection,
  });

  const reply = await runChatLlm(prompt);

  return {
    reply,
    contextUsed: {
      service: input.serviceName,
      file: input.selectedFile,
      logLineCount: logs ? logs.split('\n').filter(Boolean).length : 0,
      fileCount: codeSnippets.length,
      commitCount: commitsSection ? commitsSection.split('\n').filter(Boolean).length : 0,
    },
  };
}

function buildChatPrompt(ctx: {
  message: string;
  serviceName: string;
  repoName: string;
  logs: string;
  signalsSummary: string;
  filePath?: string;
  fileSnippet: string;
  mode: ChatMode;
  commitsSection: string;
  filesSection: string;
  codeSection: string;
}): string {
  const modeInstructions: Record<ChatMode, string> = {
    question: 'Answer using only the context below.',
    analyze_logs: 'Focus on log patterns, errors, and anomalies from the provided logs only.',
    analyze_repository: 'Focus on repository files and commits provided below only.',
    correlate: 'Correlate log errors with commits and code snippets provided below only.',
  };

  return `${modeInstructions[ctx.mode]}

Repository: ${ctx.repoName}
Service: ${ctx.serviceName}
${ctx.filePath ? `Selected file: ${ctx.filePath}` : ''}

${ctx.logs ? `## Recent logs\n\`\`\`\n${ctx.logs.slice(0, 12000)}\n\`\`\`` : ''}

${ctx.signalsSummary ? `## Parsed signals\n${ctx.signalsSummary}` : ''}

${ctx.fileSnippet ? `## Selected file snippet\n\`\`\`\n${ctx.fileSnippet.slice(0, 8000)}\n\`\`\`` : ''}

${ctx.codeSection ? `## Relevant code\n${ctx.codeSection}` : ''}

${ctx.filesSection ? `## Recently relevant files\n${ctx.filesSection}` : ''}

${ctx.commitsSection ? `## Recent commits\n${ctx.commitsSection}` : ''}

User question: ${ctx.message}`;
}

async function runChatLlm(prompt: string): Promise<string> {
  const { config } = await import('../config');
  if (config.llm.provider === 'gemini') {
    return analyzeWithGeminiChat(prompt);
  }
  return analyzeWithOpenAIChat(prompt);
}
