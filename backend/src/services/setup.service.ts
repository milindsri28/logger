import { queryOne } from '../config/database';
import { getRepositories } from './github.service';
import { getVpsConnections } from './vps.service';
import { listAgentsForUser } from './agents/agent.service';
import { getActiveGitHubIntegration } from './oauth/oauth.service';
import { Repository } from '../types';
import { getUserGithubTokenEnc } from './user.service';

export type SetupNextStep = 'github' | 'vps' | 'wait_clone' | 'repo_failed' | 'workspace';

export interface SetupRepoStatus {
  id: string;
  cloneStatus: string;
  indexStatus: string;
  failureReason?: string | null;
}

export interface SetupStatus {
  hasGithubToken: boolean;
  hasRepo: boolean;
  repoReady: boolean;
  hasVps: boolean;
  canUseWorkspace: boolean;
  nextStep: SetupNextStep;
  pendingRepo?: SetupRepoStatus;
  failedRepo?: SetupRepoStatus;
}

export async function getSetupStatus(userId: string): Promise<SetupStatus> {
  const [oauthIntegration, legacyTokenEnc, repos, vpsList, agents] = await Promise.all([
    getActiveGitHubIntegration(userId),
    getUserGithubTokenEnc(userId),
    getRepositories(userId),
    getVpsConnections(userId),
    listAgentsForUser(userId),
  ]);

  const hasGithubToken = !!oauthIntegration || !!legacyTokenEnc;
  const hasRepo = repos.length > 0;
  const readyRepo = repos.find((r) => r.clone_status === 'ready' && r.index_status === 'ready');
  const pendingRepo = repos.find(
    (r) => r.clone_status === 'pending' || r.clone_status === 'cloning' || r.index_status === 'indexing'
  );
  const failedRepo = repos.find(
    (r) => r.clone_status === 'failed' || r.index_status === 'failed'
  );
  const repoReady = !!readyRepo;
  const hasConnectedAgent = agents.some((a) => a.status === 'connected');
  const hasVps = vpsList.length > 0 || hasConnectedAgent;

  function toRepoStatus(repo: Repository): SetupRepoStatus {
    return {
      id: repo.id,
      cloneStatus: repo.clone_status,
      indexStatus: repo.index_status,
      failureReason: (repo as Repository & { failure_reason?: string }).failure_reason ?? null,
    };
  }

  let nextStep: SetupNextStep = 'workspace';
  if (!hasGithubToken) {
    nextStep = 'github';
  } else if (!hasRepo) {
    nextStep = 'github';
  } else if (pendingRepo && !repoReady) {
    nextStep = 'wait_clone';
  } else if (failedRepo && !repoReady) {
    nextStep = 'repo_failed';
  } else if (!hasVps) {
    nextStep = 'vps';
  } else if (!repoReady) {
    nextStep = 'github';
  }

  const canUseWorkspace = repoReady && hasVps;

  return {
    hasGithubToken,
    hasRepo,
    repoReady,
    hasVps,
    canUseWorkspace,
    nextStep,
    pendingRepo: pendingRepo ? toRepoStatus(pendingRepo) : undefined,
    failedRepo: failedRepo ? toRepoStatus(failedRepo) : undefined,
  };
}
