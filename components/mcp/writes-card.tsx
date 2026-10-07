"use client";

import { ShieldCheck, TriangleAlert } from "lucide-react";
import Tag from "@/components/_ui/tag";
import SettingsCard from "@/components/settings/settings-card";
import ToggleRow from "./toggle-row";

const GUARDS = [
  "Keyword tracking changes (add, remove, notes) apply directly to your local workspace.",
  "App Store Connect and Apple Ads changes are dry runs by default and return a before/after diff.",
  "Applying a change needs dryRun: false and confirm: true in the same call.",
  "Metadata is checked against the 30 / 30 / 100 character limits before anything is sent.",
  "Apple Ads: exact match only, budget raises capped at +30% per call, bids at ±30%, explicit max budget and max bid required, pausing but no re-enabling.",
  "Prices can be read but not changed over MCP.",
];

export default function WritesCard({ allowWrites, saving, onToggle }: { allowWrites: boolean; saving: boolean; onToggle: (next: boolean) => void }) {
  return (
    <SettingsCard
      id="writes"
      title="Write tools"
      description="Read tools are always available. Tools that change data stay blocked until you allow them here, and even then they follow these guardrails."
      aside={
        <Tag tone={allowWrites ? "amber" : "green"} size="sm" className="gap-1.5 text-[12px]">
          {allowWrites ? <TriangleAlert aria-hidden className="size-3" /> : <ShieldCheck aria-hidden className="size-3" />}
          {allowWrites ? "Writes allowed" : "Read only"}
        </Tag>
      }
    >
      <ToggleRow
        id="mcp-writes"
        label="Allow write tools"
        description="Let assistants track keywords, edit App Store Connect metadata and change Apple Ads campaigns."
        checked={allowWrites}
        disabled={saving}
        onChange={onToggle}
      />
      <ul className="caption-style text-soft flex flex-col gap-1.5 pl-4">
        {GUARDS.map((g) => (
          <li key={g} className="list-disc">
            {g}
          </li>
        ))}
      </ul>
    </SettingsCard>
  );
}
