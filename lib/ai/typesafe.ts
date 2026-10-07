const DEFAULT_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const DEFAULT_MODEL = "jev-latest";

export const TIMEOUT_PER_TRY_MS = 10_000;
export const MAX_TRIES = 4;
export const TOTAL_BUDGET_MS = 20_000;
const BACKOFF_BASE_MS = 400;

export type TypesafeErrorCode = "unconfigured" | "unauthorized" | "invalid" | "unavailable";

export class TypesafeError extends Error {
  code: TypesafeErrorCode;
  status?: number;

  constructor(code: TypesafeErrorCode, message: string, status?: number) {
    super(message);
    this.name = "TypesafeError";
    this.code = code;
    if (status != null) this.status = status;
  }
}

export type TypesafeUsage = { input_tokens: number; output_tokens: number };

export type ChoiceAnswer<O extends string> = { choice: O; probabilities: Record<O, number>; confidence: number };

export type TypesafeOptions = {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  budgetMs?: number;
  maxTries?: number;
};

type Json = Record<string, unknown>;

function apiKey() {
  return String(process.env.TYPESAFE_API_KEY ?? "").trim();
}

export function isTypesafeConfigured() {
  return Boolean(apiKey());
}

export function typesafeModel() {
  return String(process.env.TYPESAFE_MODEL ?? "").trim() || DEFAULT_MODEL;
}

function endpoint() {
  return String(process.env.TYPESAFE_ENDPOINT ?? "").trim() || DEFAULT_ENDPOINT;
}

function retryable(status: number) {
  return status === 429 || status === 529 || (status >= 500 && status < 600);
}

function defaultSleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function retryAfterMs(res: Response) {
  const raw = res.headers?.get?.("retry-after");
  if (!raw) return null;
  const secs = Number(raw);
  return Number.isFinite(secs) && secs >= 0 ? secs * 1000 : null;
}

function clamp01(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : null;
}

function usageOf(json: Json): TypesafeUsage | null {
  const usage = json.usage as Json | undefined;
  return usage && typeof usage === "object"
    ? { input_tokens: Number(usage.input_tokens) || 0, output_tokens: Number(usage.output_tokens) || 0 }
    : null;
}

async function postSystemOne(body: string, opts: TypesafeOptions = {}): Promise<Json> {
  const key = apiKey();
  if (!key) throw new TypesafeError("unconfigured", "TYPESAFE_API_KEY is not set.");
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const sleep = opts.sleep ?? defaultSleep;
  const perTry = opts.timeoutMs ?? TIMEOUT_PER_TRY_MS;
  const budget = opts.budgetMs ?? TOTAL_BUDGET_MS;
  const maxTries = opts.maxTries ?? MAX_TRIES;
  const startedAt = Date.now();
  let last = new TypesafeError("unavailable", "TypeSafe is unavailable.");

  for (let attempt = 0; attempt < maxTries; attempt += 1) {
    const remaining = budget - (Date.now() - startedAt);
    if (remaining <= 0) break;
    let retryDelay: number | null = null;
    try {
      const res = await fetchImpl(endpoint(), {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(Math.min(perTry, remaining)),
      });
      if (res.status === 401 || res.status === 403) throw new TypesafeError("unauthorized", "TypeSafe rejected the API key.", res.status);
      if (res.status === 400 || res.status === 422) throw new TypesafeError("invalid", `TypeSafe rejected the request (${res.status}).`, res.status);
      if (retryable(res.status)) {
        last = new TypesafeError("unavailable", `TypeSafe answered ${res.status}.`, res.status);
        retryDelay = retryAfterMs(res);
      } else if (!res.ok) {
        throw new TypesafeError("invalid", `TypeSafe answered ${res.status}.`, res.status);
      } else {
        let json: unknown;
        try {
          json = await res.json();
        } catch {
          throw new TypesafeError("unavailable", "TypeSafe returned a body that is not JSON.");
        }
        if (!json || typeof json !== "object") throw new TypesafeError("unavailable", "TypeSafe returned an unexpected body.");
        return json as Json;
      }
    } catch (error) {
      if (error instanceof TypesafeError) throw error;
      const name = error instanceof Error ? error.name : "";
      last = new TypesafeError("unavailable", name === "TimeoutError" || name === "AbortError" ? "TypeSafe timed out." : "TypeSafe could not be reached.");
    }
    if (attempt === maxTries - 1) break;
    const backoff = BACKOFF_BASE_MS * 2 ** attempt * (0.75 + Math.random() * 0.5);
    const wait = Math.max(backoff, retryDelay ?? 0);
    if (Date.now() - startedAt + wait >= budget) break;
    await sleep(wait);
  }
  throw last;
}

function parseChoice<O extends string>(json: Json, id: string, options: readonly O[]): ChoiceAnswer<O> | null {
  const answer = (json.answers as Json | undefined)?.[id] as Json | undefined;
  const choice = answer?.choice;
  if (!answer || typeof choice !== "string" || !options.includes(choice as O)) return null;
  const raw = answer.probabilities && typeof answer.probabilities === "object" ? (answer.probabilities as Json) : {};
  const probabilities = {} as Record<O, number>;
  for (const option of options) probabilities[option] = clamp01(raw[option]) ?? 0;
  return { choice: choice as O, probabilities, confidence: clamp01(answer.confidence) ?? probabilities[choice as O] ?? 0 };
}

export async function typesafeChoices<O extends string>(
  input: { state: unknown; questions: Record<string, unknown>; criteria: Record<O, string> },
  opts: TypesafeOptions = {},
): Promise<{ answers: Record<string, ChoiceAnswer<O>>; model: string; usage: TypesafeUsage | null }> {
  if (!isTypesafeConfigured()) throw new TypesafeError("unconfigured", "TYPESAFE_API_KEY is not set.");
  const ids = Object.keys(input.questions ?? {});
  const options = Object.keys(input.criteria ?? {}) as O[];
  if (!ids.length) return { answers: {}, model: typesafeModel(), usage: null };
  if (options.length < 2) throw new TypesafeError("invalid", "A Choice question needs at least two options.");
  const body = JSON.stringify({
    state: input.state,
    model: typesafeModel(),
    questions: Object.fromEntries(ids.map((id) => [id, { type: "choice", instructions: input.questions[id], criteria: input.criteria }])),
  });
  const json = await postSystemOne(body, opts);
  const answers: Record<string, ChoiceAnswer<O>> = {};
  for (const id of ids) {
    const parsed = parseChoice(json, id, options);
    if (parsed) answers[id] = parsed;
  }
  return { answers, model: typeof json.model === "string" ? json.model : typesafeModel(), usage: usageOf(json) };
}

export async function typesafeChoice<O extends string>(
  input: { state: unknown; instructions: unknown; criteria: Record<O, string>; id?: string },
  opts: TypesafeOptions = {},
): Promise<ChoiceAnswer<O> & { model: string; usage: TypesafeUsage | null }> {
  const id = input.id ?? "answer";
  const { answers, model, usage } = await typesafeChoices({ state: input.state, questions: { [id]: input.instructions }, criteria: input.criteria }, opts);
  if (!answers[id]) throw new TypesafeError("unavailable", "TypeSafe returned an answer that does not match the question.");
  return { ...answers[id], model, usage };
}

export async function typesafeNoul(
  input: { state: unknown; questions: Record<string, unknown> },
  opts: TypesafeOptions = {},
): Promise<{ probabilities: Record<string, number>; model: string; usage: TypesafeUsage | null }> {
  if (!isTypesafeConfigured()) throw new TypesafeError("unconfigured", "TYPESAFE_API_KEY is not set.");
  const ids = Object.keys(input.questions ?? {});
  if (!ids.length) throw new TypesafeError("invalid", "A Noul request needs at least one question.");
  const body = JSON.stringify({
    state: input.state,
    model: typesafeModel(),
    questions: Object.fromEntries(ids.map((id) => [id, { type: "noul", instructions: input.questions[id] }])),
  });
  const json = await postSystemOne(body, opts);
  const answers = json.answers as Json | undefined;
  const probabilities: Record<string, number> = {};
  for (const id of ids) {
    const p = clamp01((answers?.[id] as Json | undefined)?.noul);
    if (p != null) probabilities[id] = p;
  }
  if (!Object.keys(probabilities).length) throw new TypesafeError("unavailable", "TypeSafe returned answers that do not match the questions.");
  return { probabilities, model: typeof json.model === "string" ? json.model : typesafeModel(), usage: usageOf(json) };
}
