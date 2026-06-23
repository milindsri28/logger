import { analyzeWithOpenAIChat, analyzeWithGeminiChat } from './llm.service';
import { getServiceLogs } from './vps.service';
import { getRepoFile } from './repo.service';
import { getRepository, getRecentCommits, getRelevantFiles } from './github.service';
import { getVpsConnection } from './vps.service';
import { ApiError } from '../utils/api-error';

export type ChatMode = 'question' | 'analyze_logs' | 'analyze_repository' | 'correlate';

export interface ChatMessageInput {
  repositoryId: string;
  vpsConnectionId: string;
  serviceName: string;
  selectedFile?: string;
  message: string;
  mode?: ChatMode;
}

export interface ChatMessageResult {
  reply: string;
  contextUsed: { service: string; file?: string };
}

export async function handleChatMessage(
  userId: string,
  input: ChatMessageInput
): Promise<ChatMessageResult> {
  const repo = await getRepository(userId, input.repositoryId);
  if (!repo || repo.clone_status !== 'ready') {
    throw new ApiError('REPO_NOT_READY', 'Repository not ready');
  }

  const vps = await getVpsConnection(userId, input.vpsConnectionId);
  if (!vps) throw new ApiError('VPS_NOT_FOUND', 'VPS not found', 404);

  const logs = await getServiceLogs(userId, input.vpsConnectionId, input.serviceName, 500);

  let fileSnippet = '';
  if (input.selectedFile) {
    try {
      const file = await getRepoFile(userId, input.repositoryId, input.selectedFile);
      fileSnippet = file.content.split('\n').slice(0, 100).join('\n');
    } catch {
      // skip
    }
  }

  const mode = input.mode || 'question';
  let commitsSection = '';
  let filesSection = '';

  if (mode === 'analyze_repository' || mode === 'correlate') {
    const files = await getRelevantFiles(repo, 10);
    filesSection = files.map((f) => `- ${f.path} (${f.changeCount} recent changes)`).join('\n');
  }

  if (mode === 'correlate') {
    const commits = await getRecentCommits(repo, 10);
    commitsSection = commits
      .map((c) => `- ${c.sha} ${c.message} by ${c.author} (${c.date})`)
      .join('\n');
  }

  const prompt = buildChatPrompt({
    message: input.message,
    serviceName: input.serviceName,
    repoName: `${repo.owner}/${repo.name}`,
    logs: mode === 'analyze_repository' ? '' : logs,
    filePath: input.selectedFile,
    fileSnippet: mode === 'analyze_logs' ? '' : fileSnippet,
    mode,
    commitsSection,
    filesSection,
  });

  const reply = await runChatLlm(prompt);

  return {
    reply,
    contextUsed: {
      service: input.serviceName,
      file: input.selectedFile,
    },
  };
}

function buildChatPrompt(ctx: {
  message: string;
  serviceName: string;
  repoName: string;
  logs: string;
  filePath?: string;
  fileSnippet: string;
  mode: ChatMode;
  commitsSection: string;
  filesSection: string;
}): string {
  const modeInstructions: Record<ChatMode, string> = {
    question: 'Answer the user question using available context.',
    analyze_logs: 'Focus on log patterns, errors, warnings, and anomalies. Identify likely root causes from logs.',
    analyze_repository: 'Focus on recently changed files and repository structure. Relate changes to potential issues.',
    correlate: 'Correlate log errors with recent commits and file changes. Identify which changes may have caused issues.',
  };

  return `You are a production incident assistant. ${modeInstructions[ctx.mode]}
Answer concisely in plain language (2-4 short paragraphs max).

Repository: ${ctx.repoName}
Service: ${ctx.serviceName}
${ctx.filePath ? `Selected file: ${ctx.filePath}` : ''}

${ctx.logs ? `## Recent logs\n\`\`\`\n${ctx.logs.slice(0, 12000)}\n\`\`\`` : ''}

${ctx.fileSnippet ? `## Selected file snippet\n\`\`\`\n${ctx.fileSnippet.slice(0, 8000)}\n\`\`\`` : ''}

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
