import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { ascFetch, type AscDocument, type AscResource, type AscSingle } from "@/lib/asc/client";
import { HttpError } from "@/lib/server/http";
import { fixtureTransport, type FixtureApp, type FixtureMode } from "./fixtures";

export type Transport = {
  demo: boolean;
  calls: number;
  downloads: number;
  get<A = Record<string, unknown>>(path: string): Promise<AscDocument<A>>;
  getAll<A = Record<string, unknown>>(path: string, maxPages?: number): Promise<AscResource<A>[]>;
  post(path: string, body: unknown): Promise<AscSingle>;
  segment(url: string, expected: { checksum?: string | null; sizeInBytes?: number | null }): Promise<string>;
};

type Raw = {
  get: (path: string) => Promise<AscDocument>;
  post: (path: string, body: unknown) => Promise<AscSingle>;
  download: (url: string) => Promise<Buffer>;
};

const MAX_SEGMENT_BYTES = 200 * 1024 * 1024;

async function fetchSegment(url: string) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(120000), cache: "no-store" });
      if (!res.ok) throw new HttpError(502, `Report segment download failed (${res.status})`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > MAX_SEGMENT_BYTES) throw new HttpError(502, "Report segment is too large");
      return buf;
    } catch (error) {
      if (attempt >= 2) throw error;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
}

export function decodeSegment(buf: Buffer) {
  const gz = buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b;
  return (gz ? gunzipSync(buf) : buf).toString("utf8");
}

export function verifySegment(buf: Buffer, expected: { checksum?: string | null; sizeInBytes?: number | null }) {
  if (expected.sizeInBytes != null && Number(expected.sizeInBytes) !== buf.length) throw new HttpError(502, `Report segment size mismatch (${buf.length} ≠ ${expected.sizeInBytes} bytes)`);
  if (expected.checksum) {
    const md5 = createHash("md5").update(buf).digest("hex");
    if (md5.toLowerCase() !== expected.checksum.toLowerCase()) throw new HttpError(502, "Report segment checksum mismatch");
  }
}

function wrap(raw: Raw, demo: boolean): Transport {
  const t: Transport = {
    demo,
    calls: 0,
    downloads: 0,
    async get<A>(path: string) {
      t.calls++;
      return (await raw.get(path)) as AscDocument<A>;
    },
    async getAll<A>(path: string, maxPages = 20) {
      const out: AscResource<A>[] = [];
      let next: string | undefined = path;
      for (let page = 0; next && page < maxPages; page++) {
        const doc: AscDocument<A> = await t.get<A>(next);
        out.push(...doc.data);
        next = doc.links?.next;
      }
      return out;
    },
    async post(path, body) {
      t.calls++;
      return raw.post(path, body);
    },
    async segment(url, expected) {
      t.downloads++;
      const buf = await raw.download(url);
      verifySegment(buf, expected);
      return decodeSegment(buf);
    },
  };
  return t;
}

export function liveTransport(workspaceId: string): Transport {
  return wrap(
    {
      get: (path) => ascFetch<AscDocument>(workspaceId, path),
      post: (path, body) => ascFetch<AscSingle>(workspaceId, path, { method: "POST", body, attempts: 2 }),
      download: fetchSegment,
    },
    false,
  );
}

export function demoTransport(app: FixtureApp, mode: FixtureMode, now?: number): Transport {
  const f = fixtureTransport(app, mode, now);
  return wrap({ get: f.get, post: f.post as Raw["post"], download: f.download }, true);
}

export function fixturesAllowed() {
  return process.env.NODE_ENV !== "production" || process.env.OPEN_ASO_ASC_ANALYTICS_FIXTURES === "1";
}
