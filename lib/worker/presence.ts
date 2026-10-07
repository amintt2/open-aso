export const ACTIVE_MS = 45_000;

export type WorkerPresence = {
  workspaceId: string;
  userId: string;
  sessionId: string;
  shared: boolean;
  seenAt: number;
};

type GlobalWithPresence = typeof globalThis & { __openAsoWorkerPresence?: Map<string, WorkerPresence> };

function registry() {
  const g = globalThis as GlobalWithPresence;
  g.__openAsoWorkerPresence ??= new Map();
  return g.__openAsoWorkerPresence;
}

function presenceKey(workspaceId: string, userId: string, sessionId: string) {
  return `${workspaceId}:${userId}:${sessionId}`;
}

export function touchWorker(w: Omit<WorkerPresence, "seenAt">) {
  registry().set(presenceKey(w.workspaceId, w.userId, w.sessionId), { ...w, seenAt: Date.now() });
}

export function dropWorker(workspaceId: string, userId: string, sessionId: string) {
  registry().delete(presenceKey(workspaceId, userId, sessionId));
}

export function activeWorkers(): WorkerPresence[] {
  const now = Date.now();
  const out: WorkerPresence[] = [];
  for (const [key, w] of registry()) {
    if (now - w.seenAt > ACTIVE_MS) registry().delete(key);
    else out.push(w);
  }
  return out;
}

export function hasOwnWorker(workspaceId: string) {
  return activeWorkers().some((w) => w.workspaceId === workspaceId);
}

export function hasSharedWorkerFor(workspaceId: string) {
  return activeWorkers().some((w) => w.shared && w.workspaceId !== workspaceId);
}

export function workerCounts(workspaceId?: string) {
  const all = activeWorkers();
  return {
    total: all.length,
    shared: all.filter((w) => w.shared).length,
    workspaces: new Set(all.map((w) => w.workspaceId)).size,
    own: workspaceId ? all.filter((w) => w.workspaceId === workspaceId).length : 0,
  };
}
