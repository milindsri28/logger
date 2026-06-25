import { getActiveGitHubIntegration } from './oauth/oauth.service';
import { listAgentsForUser } from './agents/agent.service';

export interface IntegrationsStatus {
  github: {
    connected: boolean;
    accountLogin?: string;
    connectedAt?: string;
  };
  infrastructure: {
    agents: {
      id: string;
      hostname: string;
      os: string | null;
      status: string;
      lastSeenAt: string | null;
    }[];
    connectedCount: number;
  };
}

export async function getIntegrationsStatus(userId: string): Promise<IntegrationsStatus> {
  const integration = await getActiveGitHubIntegration(userId);
  const agents = await listAgentsForUser(userId);

  const connectedAgents = agents.filter((a) => a.status === 'connected');

  return {
    github: {
      connected: !!integration,
      accountLogin: integration?.provider_account_login,
      connectedAt: integration?.created_at?.toISOString(),
    },
    infrastructure: {
      agents: agents.map((a) => ({
        id: a.id,
        hostname: a.hostname,
        os: a.os,
        status: a.status,
        lastSeenAt: a.last_seen_at?.toISOString() ?? null,
      })),
      connectedCount: connectedAgents.length,
    },
  };
}
