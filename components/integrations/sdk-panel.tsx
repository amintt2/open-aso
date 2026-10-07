"use client";

import { useState } from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/_ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_ui/select";
import type { IntegrationsStatus } from "@/lib/integrations/status";
import type { SdkPlatform, SdkSnippet } from "@/lib/integrations/sdk";
import type { TrackedApp } from "@/lib/client/types";
import { useApi } from "@/lib/client/api";
import { formatCompact, timeAgo } from "@/lib/client/format";
import { CodeBlock } from "./copy-field";
import {
  EventLog,
  LocalhostNotice,
  Section,
  Step,
  TokenManager,
  useOrigin,
} from "./shared";

const PLATFORMS: { value: SdkPlatform; label: string }[] = [
  { value: "swift", label: "Swift" },
  { value: "react-native", label: "React Native / Expo" },
  { value: "flutter", label: "Flutter" },
];

const TOKEN_PLACEHOLDER = "__OPEN_ASO_TOKEN__";

export default function SdkPanel({
  status,
  canManage,
  token,
  onToken,
}: {
  status: IntegrationsStatus["sdk"];
  canManage: boolean;
  token: string | null;
  onToken: (t: string | null) => void;
}) {
  const origin = useOrigin();
  const { data: apps } = useApi<TrackedApp[]>("/api/apps");
  const mine = (apps ?? []).filter((a) => a.isMine && a.bundleId);
  const [picked, setPicked] = useState<string | null>(null);
  const bundleId = picked ?? mine[0]?.bundleId ?? null;
  const { data } = useApi<{ origin: string; snippets: SdkSnippet[] }>(
    `/api/integrations/sdk${bundleId ? `?bundleId=${encodeURIComponent(bundleId)}` : ""}`,
  );
  const fill = (code: string) =>
    code.replaceAll(TOKEN_PLACEHOLDER, token ?? "YOUR_SDK_TOKEN");
  const curl = fill(
    `curl -X POST ${origin}${status.installPath} \\\n  -H "Authorization: Bearer ${TOKEN_PLACEHOLDER}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"bundleId":"${bundleId ?? "com.example.app"}","userId":"test-user-1","country":"US"}'`,
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Installs", value: formatCompact(status.installs) },
          {
            label: "From Apple Ads",
            value: formatCompact(status.appleAdsInstalls),
          },
          {
            label: "Resolving",
            value: formatCompact(status.pendingAttribution),
          },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-secondary flex flex-col gap-2 rounded-lg p-3"
          >
            <span className="caption-style text-subtle">{s.label}</span>
            <span className="tabular-nums">{s.value}</span>
          </div>
        ))}
      </div>
      <LocalhostNotice origin={origin} who="Apps on real devices" />
      <Section title="Setup">
        <ol className="flex flex-col gap-6">
          <Step n={1} title="Generate an SDK token">
            <TokenManager
              kind="sdk"
              label="SDK token"
              hint={status.tokenHint}
              token={token}
              onToken={onToken}
              canManage={canManage}
            />
            <p className="caption-style text-subtle">
              The token ships inside your app binary and identifies this
              workspace, so it only allows writing installs and session pings
              for apps tracked here. Rotate it if it leaks.
            </p>
          </Step>
          <Step n={2} title="Add the snippet to your app">
            <p className="text-soft">
              On first launch the app reads the AdServices attribution token and
              posts it with an anonymous user id. Open ASO resolves it with
              Apple (retrying 404s every 5 seconds, up to 3 times, then in the
              background for 24 hours) and stores the campaign, ad group and
              keyword.
            </p>
            {mine.length > 1 && (
              <Select value={bundleId ?? undefined} onValueChange={setPicked}>
                <SelectTrigger
                  aria-label="App"
                  className="h-[30px] w-auto min-w-[200px] self-start rounded-full text-[13px]"
                >
                  <SelectValue placeholder="Choose app" />
                </SelectTrigger>
                <SelectContent>
                  {mine.map((a) => (
                    <SelectItem key={a.id} value={a.bundleId as string}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Tabs defaultValue="swift" className="gap-3">
              <TabsList className="border-line-strong border-b">
                {PLATFORMS.map((p) => (
                  <TabsTrigger key={p.value} value={p.value} className="py-2.5">
                    {p.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {PLATFORMS.map((p) => (
                <TabsContent
                  key={p.value}
                  value={p.value}
                  className="flex flex-col gap-4"
                >
                  {(data?.snippets ?? [])
                    .filter((s) => s.platform === p.value)
                    .map((s) => (
                      <div key={s.filename} className="flex flex-col gap-2">
                        <p className="caption-style text-soft leading-[1.4]">
                          {s.description}
                        </p>
                        <CodeBlock
                          title={s.title}
                          language={s.language}
                          code={fill(s.code)}
                        />
                      </div>
                    ))}
                </TabsContent>
              ))}
            </Tabs>
            {!token && (
              <p className="caption-style text-subtle">
                Replace YOUR_SDK_TOKEN with the token from step 1, or rotate it
                to have the snippets filled in.
              </p>
            )}
          </Step>
          <Step n={3} title="Link revenue">
            <p className="text-soft">
              Set the RevenueCat subscriber attribute (or Superwall user
              attribute) openAsoId to the same user id. The snippets above
              already do this for RevenueCat.
            </p>
          </Step>
          <Step n={4} title="Test from your terminal">
            <CodeBlock
              title="Simulate an install"
              language="shell"
              code={curl}
            />
          </Step>
        </ol>
      </Section>
      <Section
        title={`Activity${status.lastInstallAt ? ` · last install ${timeAgo(status.lastInstallAt)}` : ""}`}
      >
        <EventLog provider="sdk" />
      </Section>
    </div>
  );
}
