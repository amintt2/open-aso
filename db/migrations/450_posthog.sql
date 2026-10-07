CREATE TABLE IF NOT EXISTS posthog_app_map (
  app_id bigint PRIMARY KEY REFERENCES apps(id) ON DELETE CASCADE,
  workspace_id text NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
  bundle_id text,
  prefix text,
  auto boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS posthog_app_map_ws ON posthog_app_map (workspace_id);

CREATE TABLE IF NOT EXISTS posthog_event_roles (
  app_id bigint NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  workspace_id text NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
  role text NOT NULL,
  events jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (app_id, role)
);
CREATE INDEX IF NOT EXISTS posthog_event_roles_ws ON posthog_event_roles (workspace_id);
