ALTER TABLE keywords ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE keywords ADD COLUMN IF NOT EXISTS archive_reason text;
CREATE INDEX IF NOT EXISTS keywords_active_app_country_idx ON keywords (app_id, country) WHERE archived_at IS NULL;
