CREATE TABLE IF NOT EXISTS asc_report_requests (
  workspace_id text NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
  app_id bigint NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  asc_app_id text NOT NULL,
  request_id text NOT NULL,
  access_type text NOT NULL,
  demo boolean NOT NULL DEFAULT false,
  reports jsonb NOT NULL DEFAULT '{}'::jsonb,
  stopped boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_synced_at timestamptz,
  completed_at timestamptz,
  last_error text,
  PRIMARY KEY (workspace_id, request_id)
);
CREATE INDEX IF NOT EXISTS asc_report_requests_app ON asc_report_requests (workspace_id, app_id);

CREATE TABLE IF NOT EXISTS asc_report_instances_seen (
  workspace_id text NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
  instance_id text NOT NULL,
  app_id bigint NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  request_id text NOT NULL,
  family text NOT NULL,
  access_type text NOT NULL,
  processing_date date NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  backfill boolean NOT NULL DEFAULT false,
  segments integer NOT NULL DEFAULT 0,
  rows integer NOT NULL DEFAULT 0,
  PRIMARY KEY (workspace_id, instance_id)
);
CREATE INDEX IF NOT EXISTS asc_report_instances_seen_app ON asc_report_instances_seen (workspace_id, app_id, family, access_type, processing_date DESC);

CREATE TABLE IF NOT EXISTS asc_analytics_daily (
  workspace_id text NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
  app_id bigint NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  date date NOT NULL,
  territory text NOT NULL,
  source_type text NOT NULL,
  impressions integer NOT NULL DEFAULT 0,
  impressions_unique integer NOT NULL DEFAULT 0,
  page_views integer NOT NULL DEFAULT 0,
  page_views_unique integer NOT NULL DEFAULT 0,
  first_downloads integer NOT NULL DEFAULT 0,
  redownloads integer NOT NULL DEFAULT 0,
  updates integer NOT NULL DEFAULT 0,
  purchases integer NOT NULL DEFAULT 0,
  proceeds_usd double precision NOT NULL DEFAULT 0,
  sales_usd double precision NOT NULL DEFAULT 0,
  PRIMARY KEY (workspace_id, app_id, date, territory, source_type)
);
CREATE INDEX IF NOT EXISTS asc_analytics_daily_ws_date ON asc_analytics_daily (workspace_id, date);

CREATE TABLE IF NOT EXISTS asc_analytics_coverage (
  workspace_id text NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
  app_id bigint NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  family text NOT NULL,
  date date NOT NULL,
  processing_date date NOT NULL,
  PRIMARY KEY (workspace_id, app_id, family, date)
);

CREATE TABLE IF NOT EXISTS asc_analytics_sync (
  workspace_id text NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
  app_id bigint NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  demo boolean NOT NULL DEFAULT false,
  last_processing_date date,
  data_through date,
  fresh_day date,
  last_check_at timestamptz,
  next_check_at timestamptz,
  check_day date,
  checks_today integer NOT NULL DEFAULT 0,
  empty_checks_today integer NOT NULL DEFAULT 0,
  api_calls_today integer NOT NULL DEFAULT 0,
  api_calls_total bigint NOT NULL DEFAULT 0,
  publish_minute integer,
  last_new_at timestamptz,
  manual_at timestamptz,
  last_error text,
  log jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, app_id)
);
CREATE INDEX IF NOT EXISTS asc_analytics_sync_due ON asc_analytics_sync (next_check_at);
