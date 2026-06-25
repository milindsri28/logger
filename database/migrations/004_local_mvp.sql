-- Local MVP: OAuth repository integrations + agent infrastructure
-- Rename repo-intel table to avoid naming collision

ALTER TABLE repository_integrations RENAME TO repository_detected_integrations;
ALTER INDEX idx_repository_integrations_scan RENAME TO idx_repository_detected_integrations_scan;

-- OAuth GitHub integrations
CREATE TABLE repository_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL DEFAULT 'github',
    provider_account_id VARCHAR(255) NOT NULL,
    provider_account_login VARCHAR(255) NOT NULL,
    access_token_enc TEXT NOT NULL,
    refresh_token_enc TEXT,
    scopes TEXT[] NOT NULL DEFAULT '{}',
    expires_at TIMESTAMPTZ,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, provider, provider_account_id)
);

CREATE INDEX idx_repository_integrations_user ON repository_integrations(user_id);
CREATE INDEX idx_repository_integrations_provider ON repository_integrations(provider, status);

-- SSO link on users
ALTER TABLE users ADD COLUMN IF NOT EXISTS github_id VARCHAR(255) UNIQUE;

-- Agent install tokens (one-time, hashed)
CREATE TABLE agent_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(128) NOT NULL,
    label VARCHAR(255) NOT NULL DEFAULT 'server',
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agent_tokens_hash ON agent_tokens(token_hash) WHERE revoked_at IS NULL;

-- Registered agents
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agent_token_id UUID REFERENCES agent_tokens(id),
    hostname VARCHAR(255) NOT NULL,
    os VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agents_user ON agents(user_id);
CREATE INDEX idx_agents_status ON agents(status);

-- Agent heartbeat metrics
CREATE TABLE agent_metrics (
    id BIGSERIAL PRIMARY KEY,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cpu_percent REAL,
    memory_used_mb INTEGER,
    memory_total_mb INTEGER,
    disk_used_pct REAL,
    load_1 REAL,
    docker_containers JSONB NOT NULL DEFAULT '[]'
);

CREATE INDEX idx_agent_metrics_agent_time ON agent_metrics(agent_id, recorded_at DESC);
