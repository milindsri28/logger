import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config';
import { AnalysisResult, ExtractedSignals, RelevantCommit, CodeSnippet } from '../types';

const SYSTEM_PROMPT = `You are a Senior Staff Engineer and SRE analyzing a production incident.
Given production logs, stack traces, relevant code snippets, and recent commits, identify the root cause.

Respond ONLY with valid JSON matching this schema:
{
  "rootCause": "string - detailed root cause analysis",
  "confidenceScore": number (0-100),
  "affectedFiles": [{ "path": "string", "reason": "string" }],
  "affectedFunctions": [{ "name": "string", "file": "string", "line": number }],
  "relevantCommits": [{ "sha": "string", "message": "string", "author": "string", "date": "string" }],
  "suggestedFix": "string - actionable fix recommendation",
  "timeline": [{ "timestamp": "string", "event": "string" }]
}`;

export interface LlmContext {
  logs: string;
  signals: ExtractedSignals;
  codeSnippets: CodeSnippet[];
  commits: RelevantCommit[];
  repoName: string;
}

export async function analyzeWithLlm(context: LlmContext): Promise<AnalysisResult> {
  const userPrompt = buildPrompt(context);

  if (config.llm.provider === 'gemini') {
    return analyzeWithGemini(userPrompt);
  }
  return analyzeWithOpenAI(userPrompt);
}

function buildPrompt(context: LlmContext): string {
  return `## Repository: ${context.repoName}

## Production Logs
\`\`\`
${context.logs.slice(0, 15000)}
\`\`\`

## Extracted Signals
- Errors: ${context.signals.errors.slice(0, 10).join('; ')}
- File references: ${context.signals.fileReferences.slice(0, 20).join(', ')}
- Services: ${context.signals.serviceNames.join(', ')}
- HTTP errors: ${context.signals.httpErrors.map((e) => `${e.status} ${e.path || ''}`).join(', ')}

## Stack Traces
${context.signals.stackTraces.slice(0, 5).map((st) => st.frames.map((f) => `  at ${f.functionName} (${f.file}:${f.line})`).join('\n')).join('\n')}

## Relevant Code Snippets
${context.codeSnippets.map((s) => `### ${s.path}\n\`\`\`\n${s.code.slice(0, 2000)}\n\`\`\``).join('\n\n')}

## Recent Commits
${context.commits.map((c) => `- ${c.sha} ${c.message} (${c.author}, ${c.date})`).join('\n')}

Analyze this incident and return JSON only.`;
}

async function analyzeWithOpenAI(userPrompt: string): Promise<AnalysisResult> {
  const openai = new OpenAI({ apiKey: config.llm.openaiApiKey });

  const response = await openai.chat.completions.create({
    model: config.llm.openaiModel,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
  });

  const content = response.choices[0]?.message?.content || '{}';
  return parseAnalysisResult(content, config.llm.openaiModel);
}

async function analyzeWithGemini(userPrompt: string): Promise<AnalysisResult> {
  const genAI = new GoogleGenerativeAI(config.llm.geminiApiKey);
  const model = genAI.getGenerativeModel({ model: config.llm.geminiModel });

  const result = await model.generateContent(`${SYSTEM_PROMPT}\n\n${userPrompt}`);
  const content = result.response.text();
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  return parseAnalysisResult(jsonMatch?.[0] || content, config.llm.geminiModel);
}

function parseAnalysisResult(content: string, model: string): AnalysisResult {
  try {
    const parsed = JSON.parse(content);
    return {
      rootCause: parsed.rootCause || 'Unable to determine root cause',
      confidenceScore: Math.min(100, Math.max(0, Number(parsed.confidenceScore) || 50)),
      affectedFiles: parsed.affectedFiles || [],
      affectedFunctions: parsed.affectedFunctions || [],
      relevantCommits: parsed.relevantCommits || [],
      suggestedFix: parsed.suggestedFix || 'Review logs and code manually',
      codeSnippets: [],
      timeline: parsed.timeline || [],
    };
  } catch {
    return {
      rootCause: content.slice(0, 2000),
      confidenceScore: 30,
      affectedFiles: [],
      affectedFunctions: [],
      relevantCommits: [],
      suggestedFix: 'Manual investigation required - LLM response was not structured',
      codeSnippets: [],
      timeline: [],
    };
  }
}

export function getLlmModelName(): string {
  return config.llm.provider === 'gemini' ? config.llm.geminiModel : config.llm.openaiModel;
}

const CHAT_SYSTEM = `You are a senior SRE helping debug production incidents. Be concise, actionable, and reference log lines or code when relevant. Do not use JSON — respond in markdown-friendly plain text.`;

export async function analyzeWithOpenAIChat(userPrompt: string): Promise<string> {
  const openai = new OpenAI({ apiKey: config.llm.openaiApiKey });
  const response = await openai.chat.completions.create({
    model: config.llm.openaiModel,
    messages: [
      { role: 'system', content: CHAT_SYSTEM },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
  });
  return response.choices[0]?.message?.content?.trim() || 'No response from AI.';
}

export async function analyzeWithGeminiChat(userPrompt: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(config.llm.geminiApiKey);
  const model = genAI.getGenerativeModel({ model: config.llm.geminiModel });
  const result = await model.generateContent(`${CHAT_SYSTEM}\n\n${userPrompt}`);
  return result.response.text().trim() || 'No response from AI.';
}
