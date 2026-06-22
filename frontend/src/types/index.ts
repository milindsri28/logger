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

export interface DashboardContext {
  repositoryId: string | null;
  vpsConnectionId: string | null;
  selectedFilePath: string | null;
  selectedService: string | null;
}
