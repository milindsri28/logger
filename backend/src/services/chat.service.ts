import { analyzeWithOpenAIChat, analyzeWithGeminiChat } from './llm.service';
import { getServiceLogs } from './vps.service';
import { getRepoFile } from './repo.service';
import { getRepository } from './github.service';
import { getVpsConnection } from './vps.service';
import { ApiError } from '../utils/api-error';

export interface ChatMessageInput {
  repositoryId: string;
  vpsConnectionId: string;
  serviceName: string;
  selectedFile?: string;
  message: string;
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

  const logs = await getServiceLogs(userId, input.vpsConnectionId, input.serviceName, 300);

  let fileSnippet = '';
  if (input.selectedFile) {
    try {
      const file = await getRepoFile(userId, input.repositoryId, input.selectedFile);
      fileSnippet = file.content.split('\n').slice(0, 100).join('\n');
    } catch {
      // skip
    }
  }

  const prompt = buildChatPrompt({
    message: input.message,
    serviceName: input.serviceName,
    repoName: `${repo.owner}/${repo.name}`,
    logs,
    filePath: input.selectedFile,
    fileSnippet,
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
}): string {
  return `You are a production incident assistant. Answer concisely in plain language (2-4 short paragraphs max).

Repository: ${ctx.repoName}
Service: ${ctx.serviceName}
${ctx.filePath ? `Selected file: ${ctx.filePath}` : ''}

## Recent logs
\`\`\`
${ctx.logs.slice(0, 12000)}
\`\`\`

${ctx.fileSnippet ? `## Selected file snippet\n\`\`\`\n${ctx.fileSnippet.slice(0, 8000)}\n\`\`\`` : ''}

User question: ${ctx.message}`;
}

async function runChatLlm(prompt: string): Promise<string> {
  const { config } = await import('../config');
  if (config.llm.provider === 'gemini') {
    return analyzeWithGeminiChat(prompt);
  }
  return analyzeWithOpenAIChat(prompt);
}
