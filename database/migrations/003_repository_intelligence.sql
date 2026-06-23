-- Repository Intelligence (Phase 1) — deterministic static analysis, branch-scoped

CREATE TABLE repository_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    branch VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    project_info JSONB,
    databases JSONB NOT NULL DEFAULT '[]',
    env_vars JSONB NOT NULL DEFAULT '[]',
    stats JSONB,
    recent_commits JSONB NOT NULL DEFAULT '[]',
    error_message TEXT,
    scanned_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (repository_id, branch)
);

CREATE TABLE repository_apis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID NOT NULL REFERENCES repository_scans(id) ON DELETE CASCADE,
    method VARCHAR(10) NOT NULL,
    path VARCHAR(1024) NOT NULL,
    file_path VARCHAR(1024) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE repository_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID NOT NULL REFERENCES repository_scans(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE repository_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID NOT NULL REFERENCES repository_scans(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE repository_hot_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID NOT NULL REFERENCES repository_scans(id) ON DELETE CASCADE,
    file_path VARCHAR(1024) NOT NULL,
    commit_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_repository_scans_repo ON repository_scans(repository_id);
CREATE INDEX idx_repository_scans_repo_branch ON repository_scans(repository_id, branch);
CREATE INDEX idx_repository_apis_scan ON repository_apis(scan_id);
CREATE INDEX idx_repository_services_scan ON repository_services(scan_id);
CREATE INDEX idx_repository_integrations_scan ON repository_integrations(scan_id);
CREATE INDEX idx_repository_hot_files_scan ON repository_hot_files(scan_id);
