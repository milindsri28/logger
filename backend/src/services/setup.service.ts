import { queryOne } from '../config/database';
import { getRepositories } from './github.service';
import { getVpsConnections } from './vps.service';
import { Repository } from '../types';
import { getUserGithubTokenEnc } from './user.service';

export type SetupNextStep = 'github' | 'vps' | 'wait_clone' | 'workspace';

export interface SetupStatus {
  hasGithubToken: boolean;
  hasRepo: boolean;
  repoReady: boolean;
  hasVps: boolean;
  canUseWorkspace: boolean;
  nextStep: SetupNextStep;
  pendingRepo?: { id: string; cloneStatus: string; indexStatus: string; failureReason?: string | null };
}

export async function getSetupStatus(userId: string): Promise<SetupStatus> {
  const tokenEnc = await getUserGithubTokenEnc(userId);
  const repos = await getRepositories(userId);
  const vpsList = await getVpsConnections(userId);

  const hasGithubToken = !!tokenEnc;
  const hasRepo = repos.length > 0;
  const readyRepo = repos.find((r) => r.clone_status === 'ready' && r.index_status === 'ready');
  const pendingRepo = repos.find(
    (r) => r.clone_status === 'pending' || r.clone_status === 'cloning' || r.index_status === 'indexing'
  );
  const repoReady = !!readyRepo;
  const hasVps = vpsList.length > 0;

  let nextStep: SetupNextStep = 'workspace';
  if (!hasGithubToken || !hasRepo) {
    nextStep = 'github';
  } else if (pendingRepo && !repoReady) {
    nextStep = 'wait_clone';
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
    pendingRepo: pendingRepo
      ? {
          id: pendingRepo.id,
          cloneStatus: pendingRepo.clone_status,
          indexStatus: pendingRepo.index_status,
          failureReason: (pendingRepo as Repository & { failure_reason?: string }).failure_reason ?? null,
        }
      : undefined,
  };
}
