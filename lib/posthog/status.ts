import { listMappings } from "./apps";
import { credentialStatus } from "./client";
import type { PosthogStatus } from "./types";

export async function posthogStatus(
  workspaceId: string,
): Promise<PosthogStatus> {
  const [credentials, mappings] = await Promise.all([
    credentialStatus(workspaceId),
    listMappings(workspaceId),
  ]);
  return { ...credentials, mappedApps: mappings.length };
}
