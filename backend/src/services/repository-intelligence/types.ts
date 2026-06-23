export interface RepoFile {
  relativePath: string;
  content: string;
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

export interface CommitInfo {
  message: string;
  author: string;
  timestamp: string;
  hash: string;
}

export interface HotFile {
  path: string;
  commitCount: number;
}

export interface ScanResult {
  branch: string;
  projectInfo: ProjectInfo;
  apis: ApiEndpoint[];
  services: string[];
  databases: string[];
  envVars: string[];
  integrations: string[];
  stats: RepositoryStats;
  commits: CommitInfo[];
  hotFiles: HotFile[];
}

export interface RepositoryScanRow {
  id: string;
  repository_id: string;
  branch: string;
  status: string;
  project_info: ProjectInfo | null;
  databases: string[];
  env_vars: string[];
  stats: RepositoryStats | null;
  recent_commits: CommitInfo[];
  error_message: string | null;
  scanned_at: Date | null;
  created_at: Date;
  updated_at: Date;
}
