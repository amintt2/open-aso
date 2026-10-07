import { AsyncLocalStorage } from "node:async_hooks";

type Scope = { workspaceId?: string; untrusted: boolean; parent?: Scope };
type GlobalWithContext = typeof globalThis & { __openAsoRequestContext?: AsyncLocalStorage<Scope> };

function storage(): AsyncLocalStorage<Scope> {
  const g = globalThis as GlobalWithContext;
  g.__openAsoRequestContext ??= new AsyncLocalStorage<Scope>();
  return g.__openAsoRequestContext;
}

function rootOf(scope: Scope) {
  let s = scope;
  while (s.parent) s = s.parent;
  return s;
}

export function runRequest<T>(fn: () => T): T {
  return storage().run({ untrusted: false }, fn);
}

export function bindWorkspace(workspaceId: string) {
  const current = storage().getStore();
  const root = current && rootOf(current);
  if (root && (!root.workspaceId || root.workspaceId === workspaceId)) {
    root.workspaceId = workspaceId;
    return;
  }
  storage().enterWith({ workspaceId, untrusted: false });
}

export function currentWorkspaceId(): string | undefined {
  for (let s = storage().getStore(); s; s = s.parent) if (s.workspaceId) return s.workspaceId;
  return undefined;
}

export function markUntrusted() {
  const s = storage().getStore();
  if (s) s.untrusted = true;
}

export function isUntrusted() {
  return storage().getStore()?.untrusted ?? false;
}

export async function trackTrust<T>(fn: () => Promise<T>): Promise<{ value: T; untrusted: boolean }> {
  const parent = storage().getStore();
  const scope: Scope = { untrusted: false, parent };
  const value = await storage().run(scope, fn);
  if (scope.untrusted && parent) parent.untrusted = true;
  return { value, untrusted: scope.untrusted };
}
