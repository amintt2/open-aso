import type { PlanId, Limits } from "@/lib/server/plans";
import type {
  PendingInvite,
  WorkspaceDetails,
  WorkspaceSummary,
} from "./service";

export type {
  PendingInvite,
  WorkspaceDetails,
  WorkspaceInvite,
  WorkspaceMember,
  WorkspaceSummary,
} from "./service";
export type { WorkspaceRole } from "@/lib/server/context";

export type Me = {
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
    isAdmin: boolean;
  };
  activeWorkspaceId: string | null;
  workspaces: WorkspaceSummary[];
  invitations: PendingInvite[];
};

export type AdminWorkspace = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  plan: PlanId;
  explicitPlan: boolean;
  owners: string[];
  members: number;
  usage: WorkspaceDetails["usage"];
  limits: Limits;
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  createdAt: string;
  workspaces: number;
  lastSeenAt: string | null;
  providers: string[];
  isAdmin: boolean;
};

export type AdminOverview = {
  workspaces: AdminWorkspace[];
  users: AdminUser[];
  plans: { id: PlanId; label: string; limits: Limits }[];
};

export const ROLE_LABEL = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
} as const;
