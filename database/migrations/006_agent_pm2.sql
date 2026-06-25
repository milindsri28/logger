-- PM2 process list in agent heartbeat metrics

ALTER TABLE agent_metrics
  ADD COLUMN IF NOT EXISTS pm2_processes JSONB NOT NULL DEFAULT '[]';
