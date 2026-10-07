CREATE OR REPLACE FUNCTION analytics_day(ts timestamptz) RETURNS date
  LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$ SELECT (ts AT TIME ZONE 'UTC')::date $$;

CREATE OR REPLACE FUNCTION analytics_add_days(d date, n integer) RETURNS date
  LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$ SELECT d + n $$;

CREATE OR REPLACE FUNCTION analytics_week(d date) RETURNS date
  LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$ SELECT d - ((extract(isodow FROM d)::integer) - 1) $$;

CREATE TABLE IF NOT EXISTS analytics_sessions (
  workspace_id text NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
  app_id bigint NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  date date NOT NULL,
  count integer NOT NULL DEFAULT 1,
  PRIMARY KEY (app_id, user_id, date)
);
CREATE INDEX IF NOT EXISTS analytics_sessions_ws_date ON analytics_sessions (workspace_id, app_id, date);

CREATE TABLE IF NOT EXISTS attribution_pending (
  install_id bigint PRIMARY KEY REFERENCES installs(id) ON DELETE CASCADE,
  workspace_id text NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
  token text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS attribution_pending_status ON attribution_pending (status, updated_at);
CREATE INDEX IF NOT EXISTS attribution_pending_ws ON attribution_pending (workspace_id, status);

CREATE TABLE IF NOT EXISTS integration_events (
  id bigserial PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
  provider text NOT NULL,
  status text NOT NULL,
  event_type text,
  message text,
  environment text,
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS integration_events_ws_provider ON integration_events (workspace_id, provider, id DESC);

CREATE INDEX IF NOT EXISTS installs_ws_app_day ON installs (workspace_id, app_id, analytics_day(installed_at));
CREATE INDEX IF NOT EXISTS installs_ws_day ON installs (workspace_id, analytics_day(installed_at));
CREATE INDEX IF NOT EXISTS installs_ws_user ON installs (workspace_id, user_id);
CREATE INDEX IF NOT EXISTS installs_ws_keyword ON installs (workspace_id, keyword_id) WHERE keyword_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS revenue_events_ws_day ON revenue_events (workspace_id, analytics_day(occurred_at));
CREATE INDEX IF NOT EXISTS revenue_events_ws_provider ON revenue_events (workspace_id, provider);
CREATE INDEX IF NOT EXISTS ads_keyword_daily_ws_keyword ON ads_keyword_daily (workspace_id, keyword_id, date);
