CREATE TABLE IF NOT EXISTS cache (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  expires_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS cache_expires ON cache (expires_at);

CREATE TABLE IF NOT EXISTS workspace_settings (
  workspace_id text NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
  key text NOT NULL,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, key)
);

CREATE TABLE IF NOT EXISTS workspace_plans (
  workspace_id text PRIMARY KEY REFERENCES "organization"(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api_tokens (
  id bigserial PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
  kind text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  hint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  UNIQUE (workspace_id, kind)
);

CREATE TABLE IF NOT EXISTS apps (
  id bigserial PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
  track_id bigint NOT NULL,
  name text NOT NULL,
  subtitle text,
  icon_url text,
  bundle_id text,
  developer text,
  primary_country text NOT NULL DEFAULT 'us',
  is_mine boolean NOT NULL DEFAULT true,
  asc_app_id text,
  data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, track_id)
);
CREATE INDEX IF NOT EXISTS apps_workspace ON apps (workspace_id);
CREATE INDEX IF NOT EXISTS apps_bundle ON apps (bundle_id);

CREATE TABLE IF NOT EXISTS keywords (
  id bigserial PRIMARY KEY,
  app_id bigint NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  term text NOT NULL,
  country text NOT NULL,
  notes text,
  liked boolean NOT NULL DEFAULT false,
  popularity real,
  difficulty real,
  position integer,
  downloads_est real,
  top5_downloads real,
  top5_mrr real,
  label text,
  results_count integer,
  top_apps jsonb,
  last_refreshed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_id, term, country)
);
CREATE INDEX IF NOT EXISTS keywords_app_country ON keywords (app_id, country);
CREATE INDEX IF NOT EXISTS keywords_refreshed ON keywords (last_refreshed_at NULLS FIRST);

CREATE TABLE IF NOT EXISTS keyword_snapshots (
  keyword_id bigint NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
  date date NOT NULL,
  popularity real,
  difficulty real,
  position integer,
  PRIMARY KEY (keyword_id, date)
);

CREATE TABLE IF NOT EXISTS app_versions (
  track_id bigint NOT NULL,
  version text NOT NULL,
  released_at timestamptz NOT NULL,
  PRIMARY KEY (track_id, version)
);

CREATE TABLE IF NOT EXISTS competitors (
  id bigserial PRIMARY KEY,
  app_id bigint NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  track_id bigint NOT NULL,
  name text NOT NULL,
  icon_url text,
  developer text,
  country text NOT NULL DEFAULT 'us',
  data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_id, track_id)
);

CREATE TABLE IF NOT EXISTS ads_keyword_daily (
  workspace_id text NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
  org_id text NOT NULL,
  campaign_id text NOT NULL,
  ad_group_id text NOT NULL,
  keyword_id text NOT NULL,
  keyword text NOT NULL,
  country text,
  date date NOT NULL,
  impressions integer NOT NULL DEFAULT 0,
  taps integer NOT NULL DEFAULT 0,
  installs integer NOT NULL DEFAULT 0,
  spend double precision NOT NULL DEFAULT 0,
  currency text,
  PRIMARY KEY (workspace_id, keyword_id, date)
);

CREATE TABLE IF NOT EXISTS installs (
  id bigserial PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
  app_id bigint REFERENCES apps(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  country text,
  city text,
  source text NOT NULL DEFAULT 'organic',
  campaign_id text,
  ad_group_id text,
  keyword_id text,
  keyword text,
  installed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_id, user_id)
);
CREATE INDEX IF NOT EXISTS installs_workspace ON installs (workspace_id, installed_at);

CREATE TABLE IF NOT EXISTS revenue_events (
  id text NOT NULL,
  workspace_id text NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
  provider text NOT NULL,
  app_id bigint REFERENCES apps(id) ON DELETE CASCADE,
  user_id text,
  type text NOT NULL,
  product_id text,
  amount_usd double precision NOT NULL DEFAULT 0,
  country text,
  occurred_at timestamptz NOT NULL,
  raw jsonb,
  PRIMARY KEY (workspace_id, id)
);
CREATE INDEX IF NOT EXISTS revenue_events_user ON revenue_events (workspace_id, user_id);
