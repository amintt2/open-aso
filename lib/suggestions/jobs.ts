import { randomUUID } from "node:crypto";

export type JobStatus = "running" | "done" | "error";

export type JobState<T> = {
  id: string;
  kind: string;
  key: string;
  status: JobStatus;
  stage: string;
  done: number;
  total: number;
  result?: T;
  partial?: unknown;
  error?: string;
  startedAt: string;
  finishedAt?: string;
};

export type JobHandle<T> = {
  setStage: (stage: string, total?: number) => void;
  addTotal: (n: number) => void;
  tick: (n?: number) => void;
  setPartial: (partial: unknown) => void;
  state: JobState<T>;
};

type JobRegistry = Map<string, JobState<unknown>>;
type GlobalWithJobs = typeof globalThis & { __openAsoJobs?: JobRegistry };

const KEEP_MS = 60 * 60 * 1000;

function registry(): JobRegistry {
  const g = globalThis as GlobalWithJobs;
  if (!g.__openAsoJobs) g.__openAsoJobs = new Map();
  return g.__openAsoJobs;
}

function prune() {
  const now = Date.now();
  for (const [id, job] of registry()) {
    if (job.finishedAt && now - new Date(job.finishedAt).getTime() > KEEP_MS) registry().delete(id);
  }
}

export function getJob<T>(id: string): JobState<T> | undefined {
  return registry().get(id) as JobState<T> | undefined;
}

export function findRunningJob<T>(kind: string, key: string | ((key: string) => boolean)): JobState<T> | undefined {
  const match = typeof key === "string" ? (k: string) => k === key : key;
  for (const job of registry().values()) {
    if (job.kind === kind && job.status === "running" && match(job.key)) return job as JobState<T>;
  }
  return undefined;
}

export function startJob<T>(kind: string, key: string, run: (job: JobHandle<T>) => Promise<T>): JobState<T> {
  prune();
  const existing = findRunningJob<T>(kind, key);
  if (existing) return existing;
  const state: JobState<T> = {
    id: randomUUID(),
    kind,
    key,
    status: "running",
    stage: "Starting",
    done: 0,
    total: 0,
    startedAt: new Date().toISOString(),
  };
  registry().set(state.id, state as JobState<unknown>);
  const handle: JobHandle<T> = {
    state,
    setStage: (stage, total) => {
      state.stage = stage;
      if (total !== undefined) state.total = total;
    },
    addTotal: (n) => {
      state.total += n;
    },
    tick: (n = 1) => {
      state.done = Math.min(state.total, state.done + n);
    },
    setPartial: (partial) => {
      state.partial = partial;
    },
  };
  run(handle)
    .then((result) => {
      state.result = result;
      state.status = "done";
      state.stage = "Done";
      state.done = state.total;
    })
    .catch((error: unknown) => {
      state.status = "error";
      state.error = error instanceof Error ? error.message : String(error);
    })
    .finally(() => {
      state.finishedAt = new Date().toISOString();
    });
  return state;
}

export type PublicJob<T> = Omit<JobState<T>, "key">;

export function publicJob<T>(job: JobState<T>): PublicJob<T> {
  return {
    id: job.id,
    kind: job.kind,
    status: job.status,
    stage: job.stage,
    done: job.done,
    total: job.total,
    result: job.result,
    partial: job.partial,
    error: job.error,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
  };
}

export async function mapLimit<I, O>(items: I[], limit: number, fn: (item: I, index: number) => Promise<O>): Promise<O[]> {
  const out = new Array<O>(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        out[index] = await fn(items[index], index);
      }
    }),
  );
  return out;
}
