import { listMappings } from "./apps";
import { credentialStatus } from "./client";
import type { PosthogStatus } from "./types";

export function posthogStatus(): PosthogStatus {
  return { ...credentialStatus(), mappedApps: listMappings().length };
}
