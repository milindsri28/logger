import { query, queryOne } from '../config/database';
import { getRepository } from './github.service';
import { getCommitsForFiles } from './github.service';
import { getVpsConnection, getServiceLogs } from './vps.service';
import { parseLogs } from './log-parser.service';
import { searchCodeIndex, getCodeSnippets } from './code-index.service';
import { analyzeWithLlm, getLlmModelName } from './llm.service';
import { getRepoFile } from './repo.service';
import { Incident, AnalysisReport } from '../types';
import { ApiError } from '../utils/api-error';

async function setProgress(incidentId: string, step: string): Promise<void> {
  await query('UPDATE incidents SET progress_step = $1 WHERE id = $2', [step, incidentId]);
}

function inferLogSources(serviceName: string): string[] {
  const svc = serviceName.toLowerCase();
  if (svc === 'nginx') return ['nginx'];
  if (svc === 'postgres' || svc === 'postgresql' || svc === 'redis') return ['docker'];
  return ['pm2'];
}

export async function createAndAnalyzeIncident(
  userId: string,
  data: {
    repositoryId: string;
    vpsConnectionId: string;
    serviceName: string;
    selectedFile?: string;
    title?: string;
    lines?: number;
  }
): Promise<Incident> {
  const repo = await getRepository(userId, data.repositoryId);
  if (!repo) throw new ApiError('REPO_NOT_FOUND', 'Repository not found', 404);
  if (repo.clone_status !== 'ready') {
    throw new ApiError('REPO_NOT_READY', 'Repository is not ready. Wait for clone to complete.');
  }
  if (repo.index_status !== 'ready') {
    throw new ApiError('REPO_NOT_READY', 'Repository index is not ready.');
  }

  const vps = await getVpsConnection(userId, data.vpsConnectionId);
  if (!vps) throw new ApiError('VPS_NOT_FOUND', 'VPS connection not found', 404);

  const title =
    data.title?.trim() ||
    `${data.serviceName} — ${new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;

  const logSources = inferLogSources(data.serviceName);

  const incident = await queryOne<Incident>(
    `INSERT INTO incidents (user_id, repository_id, vps_connection_id, title, status, log_sources, service_name, progress_step)
     VALUES ($1, $2, $3, $4, 'analyzing', $5, $6, 'logs') RETURNING *`,
    [userId, data.repositoryId, data.vpsConnectionId, title, JSON.stringify(logSources), data.serviceName]
  );
  if (!incident) throw new Error('Failed to create incident');

  runAnalysis(incident, repo, userId, data).catch(async (err) => {
    console.error(`Analysis failed for incident ${incident.id}:`, err);
    await query(
      `UPDATE incidents SET status = 'failed', progress_step = 'failed', completed_at = NOW() WHERE id = $1`,
      [incident.id]
    );
  });

  return incident;
}

async function runAnalysis(
  incident: Incident,
  repo: NonNullable<Awaited<ReturnType<typeof getRepository>>>,
  userId: string,
  data: {
    serviceName: string;
    selectedFile?: string;
    lines?: number;
  }
): Promise<void> {
  await setProgress(incident.id, 'logs');

  const rawLogs = await getServiceLogs(
    userId,
    incident.vps_connection_id,
    data.serviceName,
    data.lines || 500
  );

  await setProgress(incident.id, 'parse');
  const signals = parseLogs(rawLogs);

  if (data.selectedFile) {
    if (!signals.fileReferences.includes(data.selectedFile)) {
      signals.fileReferences.unshift(data.selectedFile);
    }
  }

  await setProgress(incident.id, 'correlate');
  const functionNames = signals.stackTraces.flatMap((st) => st.frames.map((f) => f.functionName));
  const matchedFiles = await searchCodeIndex(repo.id, signals.fileReferences, functionNames);
  const filePaths = matchedFiles.map((f) => f.file_path);

  const commits = await getCommitsForFiles(repo, filePaths);
  let codeSnippets = await getCodeSnippets(repo, filePaths);

  if (data.selectedFile) {
    try {
      const file = await getRepoFile(userId, repo.id, data.selectedFile);
      const exists = codeSnippets.some((s) => s.path === data.selectedFile);
      if (!exists) {
        codeSnippets = [
          {
            path: file.path,
            startLine: 1,
            endLine: Math.min(file.content.split('\n').length, 80),
            code: file.content.split('\n').slice(0, 80).join('\n'),
          },
          ...codeSnippets,
        ];
      }
    } catch {
      // ignore missing file
    }
  }

  await setProgress(incident.id, 'llm');
  const analysis = await analyzeWithLlm({
    logs: rawLogs,
    signals,
    codeSnippets,
    commits,
    repoName: `${repo.owner}/${repo.name}`,
  });

  analysis.codeSnippets = codeSnippets;
  if (analysis.relevantCommits.length === 0) {
    analysis.relevantCommits = commits;
  }

  await query(
    `UPDATE incidents SET status = 'completed', raw_logs = $1, extracted_signals = $2, progress_step = 'done', completed_at = NOW() WHERE id = $3`,
    [rawLogs, JSON.stringify(signals), incident.id]
  );

  await queryOne(
    `INSERT INTO analysis_reports (
      incident_id, root_cause, confidence_score, affected_files, affected_functions,
      relevant_commits, suggested_fix, code_snippets, timeline, llm_model, llm_raw_response
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
    [
      incident.id,
      analysis.rootCause,
      analysis.confidenceScore,
      JSON.stringify(analysis.affectedFiles),
      JSON.stringify(analysis.affectedFunctions),
      JSON.stringify(analysis.relevantCommits),
      analysis.suggestedFix,
      JSON.stringify(analysis.codeSnippets),
      JSON.stringify(analysis.timeline),
      getLlmModelName(),
      JSON.stringify(analysis),
    ]
  );
}

export async function getIncidents(userId: string): Promise<Incident[]> {
  return query<Incident>(
    'SELECT * FROM incidents WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
}

export async function getIncident(userId: string, id: string): Promise<Incident | null> {
  return queryOne<Incident>(
    'SELECT * FROM incidents WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
}

export async function getAnalysisReport(incidentId: string): Promise<AnalysisReport | null> {
  return queryOne<AnalysisReport>(
    'SELECT * FROM analysis_reports WHERE incident_id = $1',
    [incidentId]
  );
}
