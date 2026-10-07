import { ArrowLeftRight, Check, PencilLine, Sparkles, TriangleAlert } from "lucide-react";
import Button from "@/components/_ui/button";

export type ConsentWorkspace = { id: string; name: string; role: string };

export type ConsentProps = {
  client: { clientId: string; name: string; logoUri: string | null; redirectHost: string };
  request: { redirectUri: string; state: string; scope: string; codeChallenge: string; resource: string };
  permissions: { kind: "read" | "write"; text: string }[];
  canChooseReadOnly: boolean;
  workspaces: ConsentWorkspace[];
  defaultWorkspaceId: string;
  viewer: { email: string };
};

const FIELD = "border-line-strong bg-secondary h-9 w-full rounded-lg border px-3 text-[14px]";

function ClientMark({ name, logoUri }: { name: string; logoUri: string | null }) {
  if (logoUri)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logoUri} alt="" referrerPolicy="no-referrer" className="bg-secondary size-11 rounded-xl border border-white/8 object-cover" />
    );
  return <span className="bg-secondary text-foreground flex size-11 items-center justify-center rounded-xl border border-white/8 text-[18px] font-medium">{name.slice(0, 1).toUpperCase() || "?"}</span>;
}

export function ConsentError({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="border-line-strong bg-card shadow-overlay flex w-full max-w-[420px] flex-col items-center gap-4 rounded-2xl border px-6 py-8 text-center">
      <span className="flex size-11 items-center justify-center rounded-xl border border-(--tag-red-border) bg-(--tag-red-bg)">
        <TriangleAlert aria-hidden className="size-5 text-(--tag-red-text)" />
      </span>
      <h1 className="text-[20px]">{title}</h1>
      <p className="text-subtle">{detail}</p>
    </div>
  );
}

export default function ConsentCard({ client, request, permissions, canChooseReadOnly, workspaces, defaultWorkspaceId, viewer }: ConsentProps) {
  return (
    <div className="border-line-strong bg-card shadow-overlay flex w-full max-w-[460px] flex-col gap-6 rounded-2xl border px-6 py-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex items-center gap-3">
          <ClientMark name={client.name} logoUri={client.logoUri} />
          <ArrowLeftRight aria-hidden className="text-subtle size-4" />
          <span className="bg-primary flex size-11 items-center justify-center rounded-xl shadow-[inset_0px_1px_0px_rgba(255,255,255,0.2)]">
            <Sparkles aria-hidden className="size-5 text-white" />
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-[20px] text-balance">{client.name} wants to connect to Open ASO</h1>
          <p className="text-subtle text-pretty">
            It will act as you in the workspace you choose. After approving, you&apos;ll return to <span className="text-foreground font-medium break-all">{client.redirectHost}</span>.
          </p>
        </div>
      </div>

      <form method="POST" action="/api/oauth/authorize" className="flex flex-col gap-5">
        <input type="hidden" name="client_id" value={client.clientId} />
        <input type="hidden" name="redirect_uri" value={request.redirectUri} />
        <input type="hidden" name="state" value={request.state} />
        <input type="hidden" name="scope" value={request.scope} />
        <input type="hidden" name="code_challenge" value={request.codeChallenge} />
        <input type="hidden" name="code_challenge_method" value="S256" />
        <input type="hidden" name="resource" value={request.resource} />

        <div className="flex flex-col gap-2">
          <label htmlFor="consent-workspace" className="caption-style text-soft">
            Workspace
          </label>
          <select id="consent-workspace" name="workspace_id" defaultValue={defaultWorkspaceId} className={FIELD}>
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} · {w.role}
              </option>
            ))}
          </select>
          <p className="caption-style text-subtle">The connection only sees this workspace. To use another one later, connect again and pick it.</p>
        </div>

        <div className="border-border flex flex-col gap-3 rounded-xl border p-4">
          <span className="caption-style text-soft">This connection will be able to</span>
          <ul className="flex flex-col gap-2.5">
            {permissions.map((p) => (
              <li key={p.text} className="flex items-start gap-2.5 text-[14px]">
                {p.kind === "read" ? <Check aria-hidden className="text-trend mt-0.5 size-4 shrink-0" /> : <PencilLine aria-hidden className="mt-0.5 size-4 shrink-0 text-(--tag-amber-text)" />}
                <span className="text-soft">{p.text}</span>
              </li>
            ))}
          </ul>
        </div>

        {canChooseReadOnly && (
          <fieldset className="flex flex-col gap-2">
            <legend className="caption-style text-soft mb-2">Access level</legend>
            <label className="border-border has-[:checked]:border-line-strong has-[:checked]:bg-secondary flex cursor-pointer items-start gap-2.5 rounded-lg border p-3">
              <input type="radio" name="access" value="full" defaultChecked className="mt-1 accent-(--primary)" />
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">Full</span>
                <span className="caption-style text-subtle">Read tools, plus write tools when an admin allowed them. Changes stay dry runs until you confirm.</span>
              </span>
            </label>
            <label className="border-border has-[:checked]:border-line-strong has-[:checked]:bg-secondary flex cursor-pointer items-start gap-2.5 rounded-lg border p-3">
              <input type="radio" name="access" value="read" className="mt-1 accent-(--primary)" />
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">Read only</span>
                <span className="caption-style text-subtle">Write tools are hidden from this connection.</span>
              </span>
            </label>
          </fieldset>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button type="submit" name="decision" value="deny" variant="secondary" size="md" className="h-10">
            Deny
          </Button>
          <Button type="submit" name="decision" value="approve" variant="primary" size="md" className="h-10">
            Approve
          </Button>
        </div>
      </form>

      <p className="caption-style text-subtle text-center">
        Signed in as <span className="text-soft">{viewer.email}</span>. Disconnect any time in Open ASO → MCP Server.
      </p>
    </div>
  );
}
