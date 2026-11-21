import { getQuickJS, type QuickJSContext, type QuickJSHandle } from "quickjs-emscripten";
import { z } from "zod";
import { recordToolCall } from "./config";
import type { McpTool, ToolContext } from "./define";

export const CODE_LIMITS = {
  timeoutMs: 120_000,
  memoryBytes: 64 * 1024 * 1024,
  stackBytes: 1024 * 1024,
  maxCalls: 250,
  concurrency: 4,
  maxResultChars: 30_000,
  maxLogChars: 4_000,
  maxCodeChars: 20_000,
  cacheTtlMs: 10 * 60_000,
  cacheEntries: 400,
  cacheEntryChars: 2_000_000,
};

type CacheEntry = { at: number; json: string };

type GlobalWithCodeCache = typeof globalThis & { __openAsoCodeCache?: Map<string, Map<string, CacheEntry>> };

function workspaceCache(workspaceId: string) {
  const g = globalThis as GlobalWithCodeCache;
  g.__openAsoCodeCache ??= new Map();
  let cache = g.__openAsoCodeCache.get(workspaceId);
  if (!cache) g.__openAsoCodeCache.set(workspaceId, (cache = new Map()));
  return cache;
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable((value as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

function cacheable(json: string) {
  return json.length <= CODE_LIMITS.cacheEntryChars && !/"status":"running"/.test(json);
}

export type CodeRunCall = { tool: string; ms: number; ok: boolean; cached?: boolean; error?: string };

export type CodeRunResult = {
  ok: boolean;
  result?: unknown;
  error?: string;
  logs: string[];
  calls: CodeRunCall[];
  elapsedMs: number;
  truncated?: boolean;
};

type JsonSchema = {
  type?: string | string[];
  enum?: unknown[];
  const?: unknown;
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  default?: unknown;
  description?: string;
};

function tsType(s: JsonSchema | undefined, depth = 0): string {
  if (!s) return "any";
  if (s.enum) return s.enum.map((v) => JSON.stringify(v)).join(" | ");
  if (s.const !== undefined) return JSON.stringify(s.const);
  const union = s.anyOf ?? s.oneOf;
  if (union) return [...new Set(union.map((x) => tsType(x, depth)))].join(" | ");
  const type = Array.isArray(s.type) ? s.type.filter((t) => t !== "null") : s.type;
  if (Array.isArray(type)) return type.map((t) => tsType({ ...s, type: t }, depth)).join(" | ");
  switch (type) {
    case "integer":
    case "number":
      return "number";
    case "string":
      return "string";
    case "boolean":
      return "boolean";
    case "null":
      return "null";
    case "array":
      return `${tsType(s.items, depth).includes(" ") ? `(${tsType(s.items, depth)})` : tsType(s.items, depth)}[]`;
    case "object":
      if (!s.properties || depth > 1) return "object";
      return objectType(s, depth + 1);
    default:
      return "any";
  }
}

function objectType(s: JsonSchema, depth = 0) {
  const required = new Set(s.required ?? []);
  const props = Object.entries(s.properties ?? {}).map(([k, v]) => {
    const optional = !required.has(k) || v.default !== undefined;
    const def = v.default !== undefined ? ` /* default ${JSON.stringify(v.default)} */` : "";
    return `${k}${optional ? "?" : ""}: ${tsType(v, depth)}${def}`;
  });
  return props.length ? `{ ${props.join("; ")} }` : "{}";
}

export function toolSignature(tool: McpTool) {
  let args = "{}";
  try {
    args = objectType(z.toJSONSchema(z.object(tool.input), { io: "input", unrepresentable: "any" }) as JsonSchema);
  } catch {
    args = "object";
  }
  return `${tool.name}(${args === "{}" ? "" : `args: ${args}`})${tool.write ? " [write]" : ""} — ${firstSentence(tool.description)}`;
}

function firstSentence(text: string) {
  const cut = text.search(/(?<=[.!?])\s/);
  const s = cut > 0 ? text.slice(0, cut) : text;
  return s.length > 220 ? `${s.slice(0, 217)}…` : s;
}

function errorText(error: unknown) {
  if (error instanceof z.ZodError) return `Invalid input: ${error.issues.map((i) => `${i.path.join(".") || "input"} ${i.message}`).join("; ")}`;
  return error instanceof Error ? error.message : String(error);
}

function semaphore(limit: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  return async <T>(fn: () => Promise<T>) => {
    if (active >= limit) await new Promise<void>((r) => queue.push(r));
    active++;
    try {
      return await fn();
    } finally {
      active--;
      queue.shift()?.();
    }
  };
}

const PRELUDE = `
const __fmt = (v) => typeof v === "string" ? v : (() => { try { return JSON.stringify(v); } catch { return String(v); } })();
globalThis.console = { log: (...a) => __log(a.map(__fmt).join(" ")), info: (...a) => __log(a.map(__fmt).join(" ")), warn: (...a) => __log("warn: " + a.map(__fmt).join(" ")), error: (...a) => __log("error: " + a.map(__fmt).join(" ")) };
globalThis.tools = new Proxy({}, { get: (_, name) => typeof name === "string" ? async (args, options) => JSON.parse(await __call(name, JSON.stringify(args ?? {}), options && options.fresh ? "1" : "")) : undefined });
globalThis.sum = (xs, f) => xs.reduce((s, x) => s + (Number(f ? f(x) : x) || 0), 0);
globalThis.avg = (xs, f) => xs.length ? sum(xs, f) / xs.length : null;
globalThis.groupBy = (xs, f) => xs.reduce((m, x) => { const k = typeof f === "function" ? f(x) : x[f]; (m[k] ??= []).push(x); return m; }, {});
globalThis.pick = (o, keys) => Array.isArray(o) ? o.map((x) => pick(x, keys)) : Object.fromEntries(keys.filter((k) => o && k in o).map((k) => [k, o[k]]));
`;

export async function runCode(code: string, ctx: ToolContext, opts: { tools: McpTool[]; readOnly: boolean }): Promise<CodeRunResult> {
  const started = Date.now();
  const deadline = started + CODE_LIMITS.timeoutMs;
  const byName = new Map(opts.tools.map((t) => [t.name, t]));
  const logs: string[] = [];
  let logChars = 0;
  const calls: CodeRunCall[] = [];
  const limit = semaphore(CODE_LIMITS.concurrency);
  let disposed = false;
  const inflight = new Set<Promise<unknown>>();

  const QuickJS = await getQuickJS();
  const runtime = QuickJS.newRuntime();
  runtime.setMemoryLimit(CODE_LIMITS.memoryBytes);
  runtime.setMaxStackSize(CODE_LIMITS.stackBytes);
  runtime.setInterruptHandler(() => Date.now() > deadline);
  const vm: QuickJSContext = runtime.newContext();

  const cache = workspaceCache(ctx.workspaceId);
  const callTool = async (name: string, argsJson: string, fresh: boolean) => {
    const tool = byName.get(name);
    if (!tool) {
      const close = [...byName.keys()].filter((n) => n.includes(name.replace(/^get_/, "")) || name.includes(n.replace(/^get_/, ""))).slice(0, 5);
      throw new Error(`Unknown tool "${name}".${close.length ? ` Did you mean ${close.join(", ")}?` : ""}`);
    }
    if (opts.readOnly && tool.write) throw new Error(`${name} is a write tool and this connection is read-only.`);
    if (calls.length >= CODE_LIMITS.maxCalls) throw new Error(`Call budget exceeded (${CODE_LIMITS.maxCalls} tool calls per run).`);
    const entry: CodeRunCall = { tool: name, ms: 0, ok: false };
    calls.push(entry);
    const t0 = Date.now();
    try {
      const args = z.object(tool.input).parse(JSON.parse(argsJson || "{}"));
      const key = `${name}:${stable(args)}`;
      const hit = !tool.write && !fresh ? cache.get(key) : undefined;
      if (hit && Date.now() - hit.at < CODE_LIMITS.cacheTtlMs) {
        entry.ok = true;
        entry.cached = true;
        return hit.json;
      }
      const data = await limit(async () => tool.run(args, ctx));
      entry.ok = true;
      recordToolCall(ctx.workspaceId, name, true);
      const json = JSON.stringify(data ?? { ok: true });
      if (tool.write) cache.clear();
      else if (cacheable(json)) {
        cache.delete(key);
        cache.set(key, { at: Date.now(), json });
        while (cache.size > CODE_LIMITS.cacheEntries) cache.delete(cache.keys().next().value as string);
      }
      return json;
    } catch (error) {
      entry.error = errorText(error);
      recordToolCall(ctx.workspaceId, name, false);
      throw new Error(`${name}: ${entry.error}`);
    } finally {
      entry.ms = Date.now() - t0;
    }
  };

  const callFn = vm.newFunction("__call", (nameHandle: QuickJSHandle, argsHandle: QuickJSHandle, freshHandle: QuickJSHandle) => {
    const name = vm.getString(nameHandle);
    const args = vm.getString(argsHandle);
    const fresh = vm.getString(freshHandle) === "1";
    const deferred = vm.newPromise();
    const task = callTool(name, args, fresh).then(
      (json) => {
        if (disposed) return;
        const value = vm.newString(json);
        deferred.resolve(value);
        value.dispose();
      },
      (error: unknown) => {
        if (disposed) return;
        const err = vm.newError(errorText(error));
        deferred.reject(err);
        err.dispose();
      },
    );
    inflight.add(task);
    void task.finally(() => inflight.delete(task));
    deferred.settled.then(() => {
      if (!disposed) runtime.executePendingJobs();
    });
    return deferred.handle;
  });
  vm.setProp(vm.global, "__call", callFn);
  callFn.dispose();

  const logFn = vm.newFunction("__log", (h: QuickJSHandle) => {
    const line = vm.getString(h);
    if (logChars < CODE_LIMITS.maxLogChars) {
      const room = CODE_LIMITS.maxLogChars - logChars;
      logs.push(line.length > room ? `${line.slice(0, room)}…` : line);
      logChars += Math.min(line.length, room);
    }
  });
  vm.setProp(vm.global, "__log", logFn);
  logFn.dispose();

  const finish = (partial: Omit<CodeRunResult, "logs" | "calls" | "elapsedMs">): CodeRunResult => ({ ...partial, logs, calls, elapsedMs: Date.now() - started });

  try {
    const prelude = vm.evalCode(PRELUDE, "prelude.js");
    if (prelude.error) {
      const e = vm.dump(prelude.error);
      prelude.error.dispose();
      return finish({ ok: false, error: `Sandbox setup failed: ${JSON.stringify(e)}` });
    }
    prelude.value.dispose();

    const evaluated = vm.evalCode(`(async () => {\n${code}\n})()`, "script.js");
    if (evaluated.error) {
      const e = vm.dump(evaluated.error);
      evaluated.error.dispose();
      return finish({ ok: false, error: describeError(e) });
    }
    const promiseHandle = evaluated.value;
    const settled = vm.resolvePromise(promiseHandle);
    promiseHandle.dispose();
    runtime.executePendingJobs();

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<"timeout">((resolve) => {
      timer = setTimeout(() => resolve("timeout"), Math.max(0, deadline - Date.now()));
    });
    const outcome = await Promise.race([settled, timeout]);
    clearTimeout(timer);
    if (outcome === "timeout") return finish({ ok: false, error: `Timed out after ${CODE_LIMITS.timeoutMs / 1000}s. Narrow the work (fewer countries/terms) or split it across runs.` });
    if (outcome.error) {
      const e = vm.dump(outcome.error);
      outcome.error.dispose();
      return finish({ ok: false, error: describeError(e) });
    }
    const value = vm.dump(outcome.value);
    outcome.value.dispose();
    return finish(shrink(value === undefined ? null : value));
  } catch (error) {
    const message = errorText(error);
    return finish({ ok: false, error: /interrupted/i.test(message) ? `Script stopped: exceeded the ${CODE_LIMITS.timeoutMs / 1000}s limit.` : /out of memory/i.test(message) ? "Script ran out of memory (64 MB)." : message });
  } finally {
    disposed = true;
    try {
      vm.dispose();
      runtime.dispose();
    } catch {
      void 0;
    }
  }
}

function describeError(e: unknown) {
  if (e && typeof e === "object") {
    const o = e as { name?: string; message?: string; stack?: string };
    const where = o.stack?.split("\n").find((l) => l.includes("script.js"))?.trim();
    if (o.message === "interrupted") return `Script stopped: exceeded the ${CODE_LIMITS.timeoutMs / 1000}s limit.`;
    return `${o.name ?? "Error"}: ${o.message ?? JSON.stringify(e)}${where ? ` (${where})` : ""}`;
  }
  return String(e);
}

function shrink(value: unknown): { ok: true; result: unknown; truncated?: boolean } {
  const json = JSON.stringify(value);
  if (json === undefined || json.length <= CODE_LIMITS.maxResultChars) return { ok: true, result: value };
  return {
    ok: true,
    truncated: true,
    result: `${json.slice(0, CODE_LIMITS.maxResultChars)}… [truncated: the result was ${json.length} characters; return less, e.g. aggregate, filter, or slice the rows]`,
  };
}
