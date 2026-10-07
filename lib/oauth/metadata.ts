import { mcpResourceUrl } from "./origin";
import { SUPPORTED_SCOPES } from "./scopes";

const AUTH_METHODS = ["none", "client_secret_post", "client_secret_basic"];

export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/api/oauth/token`,
    registration_endpoint: `${origin}/api/oauth/register`,
    revocation_endpoint: `${origin}/api/oauth/revoke`,
    introspection_endpoint: `${origin}/api/oauth/introspect`,
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: AUTH_METHODS,
    revocation_endpoint_auth_methods_supported: AUTH_METHODS,
    introspection_endpoint_auth_methods_supported: AUTH_METHODS,
    scopes_supported: [...SUPPORTED_SCOPES],
    authorization_response_iss_parameter_supported: true,
    service_documentation: "https://github.com/amintt2/open-aso#connect-your-ai-assistant",
  };
}

export function protectedResourceMetadata(origin: string, resource = mcpResourceUrl(origin)) {
  return {
    resource,
    authorization_servers: [origin],
    scopes_supported: [...SUPPORTED_SCOPES],
    bearer_methods_supported: ["header"],
    resource_name: "Open ASO MCP server",
    resource_documentation: "https://github.com/amintt2/open-aso#connect-your-ai-assistant",
  };
}
