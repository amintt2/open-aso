CREATE TABLE IF NOT EXISTS fetch_tasks (
  id bigserial PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
  url text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'leased', 'done', 'failed')),
  leased_by text,
  leased_workspace_id text,
  leased_until timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  http_status integer,
  body text,
  error text,
  shared boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS fetch_tasks_open_url ON fetch_tasks (workspace_id, url) WHERE status IN ('pending', 'leased');
CREATE INDEX IF NOT EXISTS fetch_tasks_pending ON fetch_tasks (workspace_id, created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS fetch_tasks_shared_pending ON fetch_tasks (created_at) WHERE status = 'pending' AND shared;
CREATE INDEX IF NOT EXISTS fetch_tasks_lease_expiry ON fetch_tasks (leased_until) WHERE status = 'leased';
CREATE INDEX IF NOT EXISTS fetch_tasks_finished ON fetch_tasks (finished_at) WHERE status IN ('done', 'failed');
CREATE INDEX IF NOT EXISTS fetch_tasks_leased_by ON fetch_tasks (leased_by, finished_at) WHERE shared;

CREATE TABLE IF NOT EXISTS fetch_worker_daily (
  workspace_id text NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
  day date NOT NULL DEFAULT current_date,
  completed integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  served_shared integer NOT NULL DEFAULT 0,
  last_error text,
  last_error_at timestamptz,
  PRIMARY KEY (workspace_id, day)
);
