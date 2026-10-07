"use client";

import { useState } from "react";
import { KeyRound, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Button from "@/components/_ui/button";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_ui/select";
import { api } from "@/lib/client/api";
import SettingsCard from "./settings-card";

export type PublicSettings = Record<string, string | { set: true }>;

export const DEFAULT_MODEL = "claude-opus-5-5";

const MODELS = [
  {
    id: "claude-opus-5-5",
    label: "Claude Opus 5.5",
    note: "Default · most capable",
  },
  {
    id: "claude-sonnet-5-5",
    label: "Claude Sonnet 5.5",
    note: "Faster, cheaper",
  },
  {
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    note: "Fastest, cheapest",
  },
];

export default function AiSettings({
  settings,
  canManage,
  onChange,
}: {
  settings: PublicSettings;
  canManage: boolean;
  onChange: (next: PublicSettings) => void;
}) {
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);
  const hasKey = typeof settings["ai.anthropicKey"] === "object";
  const stored = settings["ai.model"];
  const model = typeof stored === "string" && stored ? stored : DEFAULT_MODEL;

  async function put(patch: Record<string, string | null>, message: string) {
    setSaving(true);
    try {
      onChange(
        await api<PublicSettings>("/api/settings", {
          method: "PUT",
          body: patch,
        }),
      );
      toast.success(message);
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
      return false;
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsCard
      id="ai"
      title="AI"
      description={`Used for keyword suggestions, review summaries and metadata drafts in this workspace. The key is stored encrypted and never sent back to the browser.${canManage ? "" : " Only workspace owners and admins can change it."}`}
    >
      <div className="grid gap-5 md:grid-cols-2">
        <Field
          label="Anthropic API key"
          htmlFor="anthropic-key"
          hint={
            hasKey
              ? "A key is saved for this workspace. Paste a new one to replace it."
              : "Create one at console.anthropic.com → API keys."
          }
        >
          <form
            className="flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const value = key.trim();
              if (!value) return;
              if (await put({ "ai.anthropicKey": value }, "API key saved"))
                setKey("");
            }}
          >
            <div className="relative flex-1">
              <KeyRound
                aria-hidden
                className="text-subtle pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2"
              />
              <Input
                id="anthropic-key"
                type="password"
                autoComplete="off"
                spellCheck={false}
                className="pl-8"
                disabled={!canManage}
                placeholder={hasKey ? "sk-ant-••••••••••••" : "sk-ant-…"}
                value={key}
                onChange={(e) => setKey(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={!canManage || saving || !key.trim()}
            >
              <Save aria-hidden className="size-3.5" />
              Save
            </Button>
            {hasKey && (
              <Button
                variant="ghost"
                size="md"
                disabled={!canManage || saving}
                aria-label="Remove API key"
                onClick={() =>
                  window.confirm("Remove the saved Anthropic API key?") &&
                  put({ "ai.anthropicKey": null }, "API key removed")
                }
              >
                <Trash2 aria-hidden className="size-3.5" />
              </Button>
            )}
          </form>
        </Field>
        <Field
          label="Model"
          htmlFor="ai-model"
          hint={MODELS.find((m) => m.id === model)?.note ?? "Custom model id"}
        >
          <Select
            value={model}
            disabled={!canManage}
            onValueChange={(value) =>
              put(
                { "ai.model": value === DEFAULT_MODEL ? null : value },
                "Model updated",
              )
            }
          >
            <SelectTrigger id="ai-model">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODELS.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.label}
                </SelectItem>
              ))}
              {!MODELS.some((m) => m.id === model) && (
                <SelectItem value={model}>{model}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </Field>
      </div>
    </SettingsCard>
  );
}
