"use client";

import { useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import PageHeader from "@/components/shell/page-header";
import UserAvatar from "@/components/shell/user-avatar";
import { Input } from "@/components/_ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/_ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/_ui/tabs";
import PlatformKeyCard from "@/components/apple-ads/platform-key-card";
import FetchNetworkCard from "@/components/worker/fetch-network-card";
import Tag from "@/components/_ui/tag";
import { api, useApi } from "@/lib/client/api";
import type { AdminOverview, AdminWorkspace } from "@/lib/workspace/types";

function date(iso: string | null) {
  return iso
    ? new Date(iso).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";
}

function usage(used: number, limit: number) {
  return limit >= 1e8
    ? `${used.toLocaleString("en-US")}`
    : `${used.toLocaleString("en-US")} / ${limit.toLocaleString("en-US")}`;
}

function PlanSelect({
  workspace,
  plans,
  onChanged,
}: {
  workspace: AdminWorkspace;
  plans: AdminOverview["plans"];
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Select
      value={workspace.plan}
      disabled={busy}
      onValueChange={async (plan) => {
        setBusy(true);
        try {
          await api(`/api/admin/workspaces/${workspace.id}`, {
            method: "PATCH",
            body: { plan },
          });
          toast.success(
            `${workspace.name} is now on ${plans.find((p) => p.id === plan)?.label ?? plan}`,
          );
          onChanged();
        } catch (e) {
          toast.error(
            e instanceof Error ? e.message : "Could not change the plan",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <SelectTrigger
        className="h-8 w-[124px]"
        aria-label={`Plan for ${workspace.name}`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {plans.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function AdminView() {
  const { data, error, mutate } = useApi<AdminOverview>("/api/admin");
  const [tab, setTab] = useState<"workspaces" | "users" | "platform">("workspaces");
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const workspaces = useMemo(
    () =>
      (data?.workspaces ?? []).filter(
        (w) =>
          !q ||
          w.name.toLowerCase().includes(q) ||
          w.owners.some((o) => o.toLowerCase().includes(q)),
      ),
    [data, q],
  );
  const users = useMemo(
    () =>
      (data?.users ?? []).filter(
        (u) =>
          !q ||
          u.email.toLowerCase().includes(q) ||
          u.name.toLowerCase().includes(q),
      ),
    [data, q],
  );

  return (
    <>
      <PageHeader
        title="Admin"
        badge={
          data && (
            <Tag size="sm">
              {data.workspaces.length} workspaces · {data.users.length} users
            </Tag>
          )
        }
        actions={
          <div className="relative">
            <Search
              aria-hidden
              className="text-subtle pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2"
            />
            <Input
              className="h-8 w-[220px] pl-8"
              placeholder="Search name or e-mail"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search"
            />
          </div>
        }
      >
        <div className="px-4 pb-2">
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList>
              <TabsTrigger value="workspaces">Workspaces</TabsTrigger>
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="platform">Platform</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </PageHeader>
      <div className="min-h-0 flex-1 overflow-auto">
        {error && <p className="text-danger p-4">{error.message}</p>}
        {!data && !error && (
          <div className="text-subtle flex items-center gap-2 p-4">
            <Loader2 aria-hidden className="size-4 animate-spin" />
            Loading…
          </div>
        )}
        {tab === "platform" && (
          <div className="mx-auto flex w-full max-w-[960px] flex-col gap-4 p-4">
            <PlatformKeyCard />
            <FetchNetworkCard />
          </div>
        )}
        {data && tab === "workspaces" && (
          <div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Workspace</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">Members</TableHead>
                  <TableHead className="text-right">Apps</TableHead>
                  <TableHead className="text-right">Keywords</TableHead>
                  <TableHead className="text-right">Competitors</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workspaces.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="max-w-[240px] truncate">
                      {w.name}
                    </TableCell>
                    <TableCell className="text-soft max-w-[240px] truncate">
                      {w.owners.join(", ") || "—"}
                    </TableCell>
                    <TableCell>
                      <PlanSelect
                        workspace={w}
                        plans={data.plans}
                        onChanged={() => void mutate()}
                      />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {w.members}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {usage(w.usage.apps, w.limits.apps)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {usage(w.usage.keywords, w.limits.keywords)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {usage(w.usage.competitors, w.limits.competitors)}
                    </TableCell>
                    <TableCell className="text-subtle">
                      {date(w.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {data && tab === "users" && (
          <div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Sign-in</TableHead>
                  <TableHead className="text-right">Workspaces</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Last active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <UserAvatar
                          name={u.name || u.email}
                          image={u.image}
                          className="size-6"
                        />
                        <span className="flex min-w-0 flex-col gap-1">
                          <span className="truncate">
                            {u.name || u.email}{" "}
                            {u.isAdmin && (
                              <Tag
                                tone="purple"
                                size="sm"
                                className="ml-1 h-[18px] text-[12px]"
                              >
                                Admin
                              </Tag>
                            )}
                          </span>
                          <span className="caption-style text-subtle truncate">
                            {u.email}
                          </span>
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="text-soft">
                      {u.providers
                        .map((p) =>
                          p === "credential"
                            ? "Dev login"
                            : p[0].toUpperCase() + p.slice(1),
                        )
                        .join(", ") || "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {u.workspaces}
                    </TableCell>
                    <TableCell className="text-subtle">
                      {date(u.createdAt)}
                    </TableCell>
                    <TableCell className="text-subtle">
                      {date(u.lastSeenAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </>
  );
}
