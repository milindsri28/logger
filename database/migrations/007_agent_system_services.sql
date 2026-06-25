-- System service probes (nginx, postgres, redis) in agent heartbeat metrics

ALTER TABLE agent_metrics
  ADD COLUMN IF NOT EXISTS system_services JSONB NOT NULL DEFAULT '[]';
