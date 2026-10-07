CREATE TABLE IF NOT EXISTS oauth_clients (
  id bigserial PRIMARY KEY,
  client_id text NOT NULL UNIQUE,
  client_secret_hash text,
  client_name text NOT NULL,
  redirect_uris text[] NOT NULL,
  grant_types text[] NOT NULL DEFAULT ARRAY['authorization_code', 'refresh_token'],
  scopes text[] NOT NULL DEFAULT ARRAY['mcp', 'mcp:read'],
  token_endpoint_auth_method text NOT NULL DEFAULT 'none',
  logo_uri text,
  client_uri text,
  registration_access_token_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS oauth_authorizations (
  id bigserial PRIMARY KEY,
  family_id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  code_hash text NOT NULL UNIQUE,
  client_id bigint NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  workspace_id text NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
  redirect_uri text NOT NULL,
  scopes text[] NOT NULL,
  code_challenge text NOT NULL,
  resource text,
  consumed_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS oauth_authorizations_workspace ON oauth_authorizations (workspace_id);
CREATE INDEX IF NOT EXISTS oauth_authorizations_expires ON oauth_authorizations (expires_at);

CREATE TABLE IF NOT EXISTS oauth_tokens (
  id bigserial PRIMARY KEY,
  token_hash text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('access', 'refresh')),
  family_id uuid NOT NULL,
  client_id bigint NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  workspace_id text NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
  scopes text[] NOT NULL,
  parent_token_id bigint REFERENCES oauth_tokens(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS oauth_tokens_family ON oauth_tokens (family_id);
CREATE INDEX IF NOT EXISTS oauth_tokens_workspace ON oauth_tokens (workspace_id, kind) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS oauth_tokens_user ON oauth_tokens (user_id);
CREATE INDEX IF NOT EXISTS oauth_tokens_expires ON oauth_tokens (expires_at);
