import {
  EVENT_ROLES,
  type EventRole,
  type RoleMap,
  type RoleResolution,
} from "./types";

const ROLE_PATTERNS: Record<EventRole, RegExp> = {
  install:
    /^((app_)?(first_open(ed)?|first_launch(ed)?|installed|install)|application_installed)$/,
  open: /^((app_)?(opened|open|launched|launch|foregrounded)|application_opened|session_start(ed)?)$/,
  onboarding_start: /^onboarding_(started|start|begin|began|begun)$/,
  onboarding_complete: /^onboarding_(completed|complete|finished|finish|done)$/,
  paywall_view:
    /^paywall_(viewed|view|shown|show|opened|open|presented|displayed)$/,
  purchase_start:
    /^(purchase|checkout|transaction)_(started|start|initiated|begin|began)$/,
  purchase_success:
    /^(purchase_(completed|complete|succeeded|success|successful)|subscription_(started|purchased)|trial_started|transaction_completed?|subscribed)$/,
  purchase_cancel:
    /^(purchase|checkout|transaction)_(cancelled|canceled|cancel|abandoned|abandon)$/,
};

export const EXPOSURE_EVENTS = [
  "$feature_flag_called",
  "$experiment_exposure",
] as const;

export function eventPrefix(event: string) {
  if (event.startsWith("$")) return null;
  const dot = event.indexOf(".");
  return dot > 0 ? event.slice(0, dot) : null;
}

export function normalizeSeparators(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[.\-_\s]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function canonicalEvent(event: string, prefix: string | null) {
  if (event.startsWith("$")) return event;
  const lower = event.toLowerCase();
  const stripped =
    prefix && lower.startsWith(`${prefix.toLowerCase()}.`)
      ? event.slice(prefix.length + 1)
      : event;
  return normalizeSeparators(stripped) || event;
}

export function defaultRole(
  event: string,
  prefix: string | null,
): EventRole | null {
  if (event.startsWith("$")) return null;
  const canonical = canonicalEvent(event, prefix);
  return (
    EVENT_ROLES.find((role) => ROLE_PATTERNS[role].test(canonical)) ?? null
  );
}

export function inferPrefix(events: { event: string; count: number }[]) {
  const counts = new Map<string, number>();
  let total = 0;
  for (const e of events) {
    const prefix = eventPrefix(e.event);
    if (!prefix) continue;
    counts.set(prefix, (counts.get(prefix) ?? 0) + e.count);
    total += e.count;
  }
  const [best] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return best && best[1] / total >= 0.5 ? best[0] : null;
}

export function resolveRoles(
  events: string[],
  prefix: string | null,
  overrides: Partial<Record<EventRole, string[]>>,
): RoleResolution {
  const auto = Object.fromEntries(
    EVENT_ROLES.map((role) => [role, [] as string[]]),
  ) as RoleMap;
  for (const event of events) {
    const role = defaultRole(event, prefix);
    if (role) auto[role].push(event);
  }
  return Object.fromEntries(
    EVENT_ROLES.map((role) => {
      const override = overrides[role];
      return [
        role,
        override
          ? { events: [...override], source: "override" as const }
          : { events: auto[role], source: "auto" as const },
      ];
    }),
  ) as RoleResolution;
}

export function roleEvents(resolution: RoleResolution): RoleMap {
  return Object.fromEntries(
    EVENT_ROLES.map((role) => [role, resolution[role].events]),
  ) as RoleMap;
}

export function roleOf(event: string, roles: RoleMap): EventRole | null {
  return EVENT_ROLES.find((role) => roles[role].includes(event)) ?? null;
}
