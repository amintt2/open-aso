CREATE TABLE IF NOT EXISTS ads_prefs (
  workspace_id text NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
  key text NOT NULL,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, key)
);

CREATE TABLE IF NOT EXISTS ads_change_log (
  id bigserial PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
  user_id text,
  org_id text,
  action text NOT NULL,
  payload jsonb NOT NULL,
  result jsonb,
  ok boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ads_change_log_workspace ON ads_change_log (workspace_id, id DESC);

CREATE TABLE IF NOT EXISTS ads_impression_share (
  workspace_id text NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
  org_id text NOT NULL,
  adam_id text NOT NULL,
  country text NOT NULL,
  search_term text NOT NULL,
  date date NOT NULL,
  low real,
  high real,
  rank text,
  popularity integer,
  PRIMARY KEY (workspace_id, org_id, adam_id, country, search_term, date)
);

CREATE TABLE IF NOT EXISTS ads_custom_reports (
  workspace_id text NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
  id text NOT NULL,
  org_id text NOT NULL,
  state text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  imported_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, id)
);
CREATE INDEX IF NOT EXISTS ads_custom_reports_org ON ads_custom_reports (workspace_id, org_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ads_campaigns (
  workspace_id text NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
  campaign_id text NOT NULL,
  org_id text NOT NULL,
  adam_id bigint NOT NULL,
  name text NOT NULL,
  status text,
  countries text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, campaign_id)
);
CREATE INDEX IF NOT EXISTS ads_campaigns_adam ON ads_campaigns (workspace_id, adam_id);

CREATE INDEX IF NOT EXISTS ads_keyword_daily_ws_org_date ON ads_keyword_daily (workspace_id, org_id, date);
CREATE INDEX IF NOT EXISTS ads_keyword_daily_ws_campaign_date ON ads_keyword_daily (workspace_id, campaign_id, date);
