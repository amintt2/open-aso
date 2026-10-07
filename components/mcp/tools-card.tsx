"use client";

import { PencilLine } from "lucide-react";
import Tag from "@/components/_ui/tag";
import SettingsCard from "@/components/settings/settings-card";
import type { McpSettings } from "./types";

export default function ToolsCard({ layers, tools, allowWrites }: Pick<McpSettings, "layers" | "tools" | "allowWrites">) {
  return (
    <SettingsCard id="tools" title="Tools" description={`${tools.length} tools in ${layers.length} groups. Assistants see the same names and descriptions.`}>
      <div className="flex flex-col gap-6">
        {layers.map((layer) => {
          const list = tools.filter((t) => t.layer === layer.id);
          if (!list.length) return null;
          return (
            <section key={layer.id} aria-labelledby={`layer-${layer.id}`} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <h3 id={`layer-${layer.id}`}>
                  {layer.label} <span className="text-subtle font-normal">· {list.length}</span>
                </h3>
                <p className="caption-style text-subtle">{layer.description}</p>
              </div>
              <ul className="border-border divide-border flex flex-col divide-y rounded-lg border">
                {list.map((tool) => (
                  <li key={tool.name} className="flex flex-col gap-1.5 px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="font-mono text-[13px]">{tool.name}</code>
                      {tool.write && (
                        <Tag tone={allowWrites ? "amber" : "neutral"} size="sm" className="gap-1 text-[11px]">
                          <PencilLine aria-hidden className="size-3" />
                          {allowWrites ? "write" : "write · blocked"}
                        </Tag>
                      )}
                    </div>
                    <p className="caption-style text-soft">{tool.description}</p>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </SettingsCard>
  );
}
