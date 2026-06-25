-- Tie incidents to agents (agent-only or legacy VPS)

ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agents(id) ON DELETE SET NULL;

ALTER TABLE incidents
  ALTER COLUMN vps_connection_id DROP NOT NULL;

ALTER TABLE incidents
  DROP CONSTRAINT IF EXISTS incidents_infra_check;

ALTER TABLE incidents
  ADD CONSTRAINT incidents_infra_check CHECK (
    (agent_id IS NOT NULL AND vps_connection_id IS NULL)
    OR (agent_id IS NULL AND vps_connection_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_incidents_agent ON incidents(agent_id);
