-- Premium MVP schema additions

ALTER TABLE users ADD COLUMN IF NOT EXISTS github_token_enc TEXT;

ALTER TABLE repositories ADD COLUMN IF NOT EXISTS failure_reason TEXT;

ALTER TABLE incidents ADD COLUMN IF NOT EXISTS service_name VARCHAR(255);
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS progress_step VARCHAR(50);
