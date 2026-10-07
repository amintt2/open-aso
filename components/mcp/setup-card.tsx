"use client";

import { useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/_ui/tabs";
import SettingsCard from "@/components/settings/settings-card";
import { CodeBlock } from "@/components/integrations/copy-field";
import { buildSnippets } from "./snippets";

export default function SetupCard({ url, tokenRequired, token }: { url: string; tokenRequired: boolean; token: string | null }) {
  const snippets = useMemo(() => buildSnippets(url, { required: tokenRequired, token }), [url, tokenRequired, token]);
  return (
    <SettingsCard id="setup" title="Configure with the static token" description="Paste one of these into a client's configuration. Prefer the OAuth options above when the client supports them.">
      <Tabs defaultValue={snippets[0].id} className="gap-3">
        <TabsList className="border-line-strong flex-wrap border-b">
          {snippets.map((s) => (
            <TabsTrigger key={s.id} value={s.id} className="py-2.5">
              {s.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {snippets.map((s) => (
          <TabsContent key={s.id} value={s.id} className="flex flex-col gap-2">
            <CodeBlock title={s.title} language={s.language} code={s.code} />
            <p className="caption-style text-subtle">{s.note}</p>
          </TabsContent>
        ))}
      </Tabs>
      {tokenRequired && !token && <p className="caption-style text-subtle">Replace &lt;YOUR_TOKEN&gt; with your token, or rotate it to have the snippets filled in.</p>}
    </SettingsCard>
  );
}
