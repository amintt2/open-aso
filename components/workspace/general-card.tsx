"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import Button from "@/components/_ui/button";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import { api, revalidate } from "@/lib/client/api";
import type { WorkspaceDetails } from "@/lib/workspace/types";
import SectionCard from "./section-card";

export default function GeneralCard({
  workspace,
  onChange,
}: {
  workspace: WorkspaceDetails;
  onChange: (next: WorkspaceDetails) => void;
}) {
  const [name, setName] = useState(workspace.name);
  const [saving, setSaving] = useState(false);
  const canEdit = workspace.role !== "member";
  const dirty = name.trim() !== workspace.name && !!name.trim();

  async function save() {
    setSaving(true);
    try {
      onChange(
        await api<WorkspaceDetails>("/api/workspace", {
          method: "PATCH",
          body: { name: name.trim() },
        }),
      );
      await revalidate("/api/workspace/me");
      toast.success("Workspace renamed");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not rename the workspace",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard
      id="general"
      title="General"
      description="Apps, keywords, credentials and integrations in this workspace are shared with all of its members and nobody else."
    >
      <form
        className="flex max-w-[520px] items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (dirty) void save();
        }}
      >
        <Field
          label="Workspace name"
          htmlFor="ws-name"
          className="flex-1"
          hint={
            canEdit
              ? undefined
              : "Only owners and admins can rename the workspace."
          }
        >
          <Input
            id="ws-name"
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!canEdit}
            autoComplete="off"
          />
        </Field>
        {canEdit && (
          <Button
            type="submit"
            variant="primary"
            size="md"
            className="h-9"
            disabled={!dirty || saving}
          >
            <Save aria-hidden className="size-3.5" />
            Save
          </Button>
        )}
      </form>
    </SectionCard>
  );
}
