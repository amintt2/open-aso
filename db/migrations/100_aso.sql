CREATE TABLE IF NOT EXISTS ai_usage (
  workspace_id text NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
  day date NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (workspace_id, day)
);

CREATE INDEX IF NOT EXISTS competitors_app ON competitors (app_id, created_at);
CREATE INDEX IF NOT EXISTS keywords_term_country ON keywords (term, country);
CREATE INDEX IF NOT EXISTS keyword_snapshots_date ON keyword_snapshots (date);
