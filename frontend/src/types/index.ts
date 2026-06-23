export interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
}

export interface RepoFile {
  path: string;
  content: string;
  language: string;
}

export interface VpsService {
  name: string;
  status: 'running' | 'down' | 'warning';
  type: 'pm2' | 'docker' | 'system';
}

export interface Repository {
  id: string;
  owner: string;
  name: string;
  cloneStatus: string;
  indexStatus: string;
}

export interface VpsConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export type ChatMode = 'question' | 'analyze_logs' | 'analyze_repository' | 'correlate';

export interface GitCommit {
  sha: string;
  fullSha?: string;
  message: string;
  author: string;
  date: string;
  url?: string;
}

export interface RelevantFile {
  path: string;
  changeCount: number;
}

export interface InvestigationReport {
  rootCause: string;
  confidenceScore: number;
  affectedFiles: Array<{ path: string; reason?: string }>;
  suggestedFix: string;
  timeline?: Array<{ timestamp: string; event: string }>;
  relevantCommits?: GitCommit[];
}

export interface DashboardContext {
  repositoryId: string | null;
  vpsConnectionId: string | null;
  selectedFilePath: string | null;
  selectedService: string | null;
}

export interface ProjectInfo {
  framework: string;
  language: string;
  packageManager: string;
}

export interface ApiEndpoint {
  method: string;
  path: string;
  file: string;
}

export interface RepositoryStats {
  totalFiles: number;
  totalFolders: number;
  totalApis: number;
  totalServices: number;
  totalCommits: number;
}

export interface ScanCommit {
  message: string;
  author: string;
  timestamp: string;
  hash: string;
}

export interface HotFile {
  path: string;
  commitCount: number;
}

export interface ScanStatus {
  branch: string;
  status: string;
  scannedAt: string | null;
  errorMessage: string | null;
}
