export interface User {
  id: string;
  email: string;
  password_hash: string;
  name: string | null;
  github_token_enc?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Repository {
  id: string;
  user_id: string;
  github_token_enc: string;
  repo_url: string;
  owner: string;
  name: string;
  default_branch: string;
  local_path: string | null;
  clone_status: string;
  index_status: string;
  failure_reason?: string | null;
  file_count: number;
  last_synced_at: Date | null;
  created_at: Date;
}

export interface CodeIndexEntry {
  id: string;
  repository_id: string;
  file_path: string;
  language: string | null;
  symbols: CodeSymbols;
  content_hash: string | null;
  indexed_at: Date;
}

export interface CodeSymbols {
  functions: string[];
  classes: string[];
  exports: string[];
}

export interface VpsConnection {
  id: string;
  user_id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  auth_type: 'key' | 'password';
  credentials_enc: string;
  created_at: Date;
}

export interface Incident {
  id: string;
  user_id: string;
  repository_id: string;
  vps_connection_id: string;
  title: string;
  status: 'pending' | 'analyzing' | 'completed' | 'failed';
  log_sources: string[];
  service_name?: string | null;
  progress_step?: string | null;
  raw_logs: string | null;
  extracted_signals: ExtractedSignals | null;
  created_at: Date;
  completed_at: Date | null;
}

export interface StackFrame {
  functionName: string;
  file: string;
  line: number;
  column: number;
}

export interface ExtractedSignals {
  errors: string[];
  stackTraces: { frames: StackFrame[] }[];
  fileReferences: string[];
  serviceNames: string[];
  httpErrors: { status: number; path?: string }[];
}

export interface AnalysisReport {
  id: string;
  incident_id: string;
  root_cause: string | null;
  confidence_score: number | null;
  affected_files: AffectedFile[];
  affected_functions: AffectedFunction[];
  relevant_commits: RelevantCommit[];
  suggested_fix: string | null;
  code_snippets: CodeSnippet[];
  timeline: TimelineEvent[];
  llm_model: string | null;
  llm_raw_response: unknown;
  created_at: Date;
}

export interface AffectedFile {
  path: string;
  reason: string;
  snippet?: string;
}

export interface AffectedFunction {
  name: string;
  file: string;
  line?: number;
}

export interface RelevantCommit {
  sha: string;
  fullSha?: string;
  message: string;
  author: string;
  date: string;
  url?: string;
}

export interface CodeSnippet {
  path: string;
  startLine: number;
  endLine: number;
  code: string;
}

export interface TimelineEvent {
  timestamp: string;
  event: string;
}

export interface AnalysisResult {
  rootCause: string;
  confidenceScore: number;
  affectedFiles: AffectedFile[];
  affectedFunctions: AffectedFunction[];
  relevantCommits: RelevantCommit[];
  suggestedFix: string;
  codeSnippets: CodeSnippet[];
  timeline: TimelineEvent[];
}

export interface JwtPayload {
  userId: string;
  email: string;
}
