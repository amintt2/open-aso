import { cached, cacheGet, cacheSet, HOUR } from "@/lib/server/cache";
import { HttpError } from "@/lib/server/http";
import { resolveAscAppId } from "./apps";
import {
  AscError,
  ascDelete,
  ascFetch,
  ascGetAll,
  ascPost,
  ASC_TTL,
  ascCacheKey,
  clearAscCache,
  indexIncluded,
  query,
  relId,
  type AscDocument,
  type AscResource,
  type AscSingle,
} from "./client";
import { pppRatio, PPP_DEFAULT_CLAMP } from "./ppp";
import { ALPHA2_BY_ALPHA3, STOREFRONT_TERRITORIES } from "./territories";
import type {
  AscProduct,
  PlanRow,
  PricingPlan,
  PricingStrategy,
  ProductKind,
  ProductPrices,
  ScheduleResult,
  ScheduleRow,
  TerritoryPrice,
} from "./types";

const TERRITORY_FILTER = STOREFRONT_TERRITORIES.join(",");
const UNMATCHED_TOLERANCE = 0.15;

const appKey = (ascAppId: string) => `asc:app:${ascAppId}:`;
const priceKey = (kind: ProductKind, productId: string) => `asc:prices:${kind}:${productId}`;

export function today() {
  return new Date().toISOString().slice(0, 10);
}

function num(value: unknown) {
  const n = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(n) ? n : null;
}

type SubAttrs = { name?: string; productId?: string; state?: string; subscriptionPeriod?: string; groupLevel?: number };
type IapAttrs = { name?: string; productId?: string; state?: string; inAppPurchaseType?: string };

export async function listProducts(workspaceId: string, appId: number, opts: { refresh?: boolean } = {}): Promise<AscProduct[]> {
  const ascAppId = await resolveAscAppId(workspaceId, appId);
  if (opts.refresh) await clearAscCache(workspaceId, `${appKey(ascAppId)}products`);
  return cached(ascCacheKey(workspaceId, `${appKey(ascAppId)}products`), ASC_TTL, async () => {
    const [groups, iaps] = await Promise.all([
      ascGetAll<{ referenceName?: string }>(workspaceId, `/v1/apps/${ascAppId}/subscriptionGroups${query({ limit: 200, "fields[subscriptionGroups]": "referenceName" })}`),
      ascGetAll<IapAttrs>(workspaceId, `/v1/apps/${ascAppId}/inAppPurchasesV2${query({ limit: 200, "fields[inAppPurchases]": "name,productId,inAppPurchaseType,state" })}`),
    ]);
    const subs = await Promise.all(
      groups.data.map(async (g) => {
        const doc = await ascGetAll<SubAttrs>(
          workspaceId,
          `/v1/subscriptionGroups/${g.id}/subscriptions${query({ limit: 200, "fields[subscriptions]": "name,productId,state,subscriptionPeriod,groupLevel" })}`,
        );
        return doc.data
          .sort((a, b) => (a.attributes?.groupLevel ?? 0) - (b.attributes?.groupLevel ?? 0))
          .map<AscProduct>((s) => ({
            kind: "subscription",
            id: s.id,
            name: s.attributes?.name ?? s.id,
            productId: s.attributes?.productId ?? "",
            state: s.attributes?.state ?? null,
            type: "AUTO_RENEWABLE",
            period: s.attributes?.subscriptionPeriod ?? null,
            groupId: g.id,
            groupName: g.attributes?.referenceName ?? null,
          }));
      }),
    );
    const iapList = iaps.data.map<AscProduct>((i) => ({
      kind: "iap",
      id: i.id,
      name: i.attributes?.name ?? i.id,
      productId: i.attributes?.productId ?? "",
      state: i.attributes?.state ?? null,
      type: i.attributes?.inAppPurchaseType ?? null,
      period: null,
      groupId: null,
      groupName: null,
    }));
    return [...subs.flat(), ...iapList];
  });
}

type PointAttrs = { customerPrice?: string; proceeds?: string };
type PriceAttrs = { startDate?: string | null; endDate?: string | null; preserved?: boolean; manual?: boolean };

function toTerritoryPrice(
  r: AscResource<PriceAttrs>,
  find: ReturnType<typeof indexIncluded>,
  pointType: string,
  pointRel: string,
  manual: boolean,
): TerritoryPrice {
  const territory = relId(r, "territory") ?? "";
  const pointId = relId(r, pointRel);
  const point = find(pointType, pointId) as AscResource<PointAttrs> | undefined;
  const terr = find("territories", territory) as AscResource<{ currency?: string }> | undefined;
  return {
    priceId: r.id,
    territory,
    currency: terr?.attributes?.currency ?? null,
    customerPrice: num(point?.attributes?.customerPrice),
    proceeds: num(point?.attributes?.proceeds),
    pricePointId: pointId,
    startDate: r.attributes?.startDate ?? null,
    endDate: r.attributes?.endDate ?? null,
    preserved: !!r.attributes?.preserved,
    manual: r.attributes?.manual ?? manual,
  };
}

function splitTimeline(entries: TerritoryPrice[]) {
  const now = today();
  const current = new Map<string, TerritoryPrice>();
  const upcoming: TerritoryPrice[] = [];
  for (const e of entries) {
    if (e.endDate && e.endDate <= now) continue;
    if (e.startDate && e.startDate > now) {
      upcoming.push(e);
      continue;
    }
    const prev = current.get(e.territory);
    const better = !prev || (e.manual !== prev.manual ? e.manual : (e.startDate ?? "") > (prev.startDate ?? ""));
    if (better) current.set(e.territory, e);
  }
  return {
    current: [...current.values()].sort((a, b) => a.territory.localeCompare(b.territory)),
    upcoming: upcoming.sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? "") || a.territory.localeCompare(b.territory)),
  };
}

async function loadSubscriptionPrices(workspaceId: string, subscriptionId: string): Promise<ProductPrices> {
  const doc = await ascGetAll<PriceAttrs>(
    workspaceId,
    `/v1/subscriptions/${subscriptionId}/prices${query({
      include: "subscriptionPricePoint,territory",
      limit: 200,
      "filter[territory]": TERRITORY_FILTER,
      "fields[subscriptionPrices]": "startDate,preserved,territory,subscriptionPricePoint",
      "fields[subscriptionPricePoints]": "customerPrice,proceeds",
      "fields[territories]": "currency",
    })}`,
  );
  const find = indexIncluded(doc.included);
  const entries = doc.data.map((r) => toTerritoryPrice(r, find, "subscriptionPricePoints", "subscriptionPricePoint", true));
  return { kind: "subscription", productId: subscriptionId, baseTerritory: null, ...splitTimeline(entries), fetchedAt: new Date().toISOString() };
}

async function iapSchedule(workspaceId: string, iapId: string) {
  try {
    const doc = await ascFetch<AscSingle>(workspaceId, `/v2/inAppPurchases/${iapId}/iapPriceSchedule${query({ include: "baseTerritory" })}`);
    return { id: doc.data.id, baseTerritory: relId(doc.data, "baseTerritory") };
  } catch (error) {
    if (error instanceof AscError && error.appleStatus === 404) return null;
    throw error;
  }
}

async function loadIapPrices(workspaceId: string, iapId: string): Promise<ProductPrices> {
  const schedule = await iapSchedule(workspaceId, iapId);
  if (!schedule) return { kind: "iap", productId: iapId, baseTerritory: null, current: [], upcoming: [], fetchedAt: new Date().toISOString() };
  const params = query({
    include: "inAppPurchasePricePoint,territory",
    limit: 200,
    "filter[territory]": TERRITORY_FILTER,
    "fields[inAppPurchasePrices]": "startDate,endDate,manual,inAppPurchasePricePoint,territory",
    "fields[inAppPurchasePricePoints]": "customerPrice,proceeds",
    "fields[territories]": "currency",
  });
  const [manual, automatic] = await Promise.all([
    ascGetAll<PriceAttrs>(workspaceId, `/v1/inAppPurchasePriceSchedules/${schedule.id}/manualPrices${params}`),
    ascGetAll<PriceAttrs>(workspaceId, `/v1/inAppPurchasePriceSchedules/${schedule.id}/automaticPrices${params}`),
  ]);
  const findM = indexIncluded(manual.included);
  const findA = indexIncluded(automatic.included);
  const entries = [
    ...manual.data.map((r) => toTerritoryPrice(r, findM, "inAppPurchasePricePoints", "inAppPurchasePricePoint", true)),
    ...automatic.data.map((r) => toTerritoryPrice(r, findA, "inAppPurchasePricePoints", "inAppPurchasePricePoint", false)),
  ];
  return { kind: "iap", productId: iapId, baseTerritory: schedule.baseTerritory, ...splitTimeline(entries), fetchedAt: new Date().toISOString() };
}

export async function getProductPrices(workspaceId: string, appId: number, kind: ProductKind, productId: string, opts: { refresh?: boolean } = {}): Promise<ProductPrices> {
  await resolveAscAppId(workspaceId, appId);
  if (opts.refresh) await clearAscCache(workspaceId, priceKey(kind, productId));
  return cached(ascCacheKey(workspaceId, priceKey(kind, productId)), ASC_TTL, () =>
    kind === "subscription" ? loadSubscriptionPrices(workspaceId, productId) : loadIapPrices(workspaceId, productId),
  );
}

export type PricePoint = { id: string; territory: string; currency: string | null; customerPrice: number; proceeds: number | null };

function mapPoints(doc: AscDocument<PointAttrs>): PricePoint[] {
  const find = indexIncluded(doc.included);
  return doc.data
    .map((p) => {
      const territory = relId(p, "territory") ?? "";
      const terr = find("territories", territory) as AscResource<{ currency?: string }> | undefined;
      return {
        id: p.id,
        territory,
        currency: terr?.attributes?.currency ?? null,
        customerPrice: num(p.attributes?.customerPrice) ?? 0,
        proceeds: num(p.attributes?.proceeds),
      };
    })
    .filter((p) => p.territory);
}

const pointsKey = (workspaceId: string, kind: ProductKind, productId: string, territory: string) => ascCacheKey(workspaceId, `asc:pp:${kind}:${productId}:${territory}`);

async function pricePoints(workspaceId: string, kind: ProductKind, productId: string, territories: string[]): Promise<Map<string, PricePoint[]>> {
  const out = new Map<string, PricePoint[]>();
  const missing: string[] = [];
  const hits = await Promise.all(territories.map((t) => cacheGet<PricePoint[]>(pointsKey(workspaceId, kind, productId, t))));
  for (const [i, t] of territories.entries()) {
    const hit = hits[i];
    if (hit) out.set(t, hit);
    else missing.push(t);
  }
  const chunks: string[][] = [];
  for (let i = 0; i < missing.length; i += 8) chunks.push(missing.slice(i, i + 8));
  for (const chunk of chunks) {
    const base = kind === "subscription" ? `/v1/subscriptions/${productId}/pricePoints` : `/v2/inAppPurchases/${productId}/pricePoints`;
    const fieldKey = kind === "subscription" ? "fields[subscriptionPricePoints]" : "fields[inAppPurchasePricePoints]";
    const doc = await ascGetAll<PointAttrs>(
      workspaceId,
      `${base}${query({ "filter[territory]": chunk.join(","), include: "territory", limit: 8000, [fieldKey]: "customerPrice,proceeds,territory", "fields[territories]": "currency" })}`,
    );
    const grouped = new Map<string, PricePoint[]>(chunk.map((t) => [t, []]));
    for (const p of mapPoints(doc)) grouped.get(p.territory)?.push(p);
    for (const [t, list] of grouped) {
      const sorted = list.filter((p) => p.customerPrice > 0).sort((a, b) => a.customerPrice - b.customerPrice);
      await cacheSet(pointsKey(workspaceId, kind, productId, t), sorted, 12 * HOUR);
      out.set(t, sorted);
    }
  }
  return out;
}

function equalizations(workspaceId: string, kind: ProductKind, pricePointId: string): Promise<PricePoint[]> {
  return cached(ascCacheKey(workspaceId, `asc:eq:${kind}:${pricePointId}`), 12 * HOUR, async () => {
    const base = kind === "subscription" ? `/v1/subscriptionPricePoints/${pricePointId}/equalizations` : `/v1/inAppPurchasePricePoints/${pricePointId}/equalizations`;
    const fieldKey = kind === "subscription" ? "fields[subscriptionPricePoints]" : "fields[inAppPurchasePricePoints]";
    const doc = await ascGetAll<PointAttrs>(
      workspaceId,
      `${base}${query({ "filter[territory]": TERRITORY_FILTER, include: "territory", limit: 8000, [fieldKey]: "customerPrice,proceeds,territory", "fields[territories]": "currency" })}`,
    );
    return mapPoints(doc);
  });
}

function nearest(points: PricePoint[], target: number) {
  let best: PricePoint | null = null;
  for (const p of points) if (!best || Math.abs(p.customerPrice - target) < Math.abs(best.customerPrice - target)) best = p;
  return best;
}

export async function getPricePoints(workspaceId: string, appId: number, kind: ProductKind, productId: string, territory: string) {
  await resolveAscAppId(workspaceId, appId);
  return (await pricePoints(workspaceId, kind, productId, [territory])).get(territory) ?? [];
}

export async function buildPricingPlan(
  workspaceId: string,
  appId: number,
  input: { kind: ProductKind; productId: string; baseUsd: number; strategy: PricingStrategy; clampMin?: number; clampMax?: number },
): Promise<PricingPlan> {
  await resolveAscAppId(workspaceId, appId);
  const { kind, productId, baseUsd, strategy } = input;
  const clampMin = input.clampMin ?? PPP_DEFAULT_CLAMP.min;
  const clampMax = input.clampMax ?? PPP_DEFAULT_CLAMP.max;
  const usPoints = (await pricePoints(workspaceId, kind, productId, ["USA"])).get("USA") ?? [];
  const basePoint = nearest(usPoints, baseUsd);
  if (!basePoint) throw new HttpError(422, "Apple returned no United States price points for this product");
  const [eq, prices] = await Promise.all([equalizations(workspaceId, kind, basePoint.id), getProductPrices(workspaceId, appId, kind, productId)]);
  const eqBy = new Map(eq.map((p) => [p.territory, p]));
  eqBy.set("USA", basePoint);
  const points = strategy === "ppp" ? await pricePoints(workspaceId, kind, productId, STOREFRONT_TERRITORIES) : new Map<string, PricePoint[]>();
  const currentBy = new Map(prices.current.map((p) => [p.territory, p]));

  const rows = STOREFRONT_TERRITORIES.map<PlanRow>((territory) => {
    const code = ALPHA2_BY_ALPHA3[territory];
    const cur = currentBy.get(territory);
    const eqPoint = eqBy.get(territory);
    const ratio = strategy === "ppp" ? pppRatio(code, clampMin, clampMax) : 1;
    const base = {
      territory,
      currency: eqPoint?.currency ?? cur?.currency ?? null,
      current: cur?.customerPrice ?? null,
      currentPricePointId: cur?.pricePointId ?? null,
      ratio,
    };
    if (!eqPoint)
      return { ...base, target: null, proposed: null, proposedPricePointId: null, deltaPct: null, unmatched: "Apple returned no equalized price for this territory", alreadyScheduled: false };
    const target = eqPoint.customerPrice * ratio;
    let chosen: PricePoint | null = eqPoint;
    let unmatched: string | null = null;
    if (strategy === "ppp" && territory !== "USA") {
      chosen = nearest(points.get(territory) ?? [], target);
      if (!chosen) unmatched = "No Apple price point available in this territory";
      else if (Math.abs(chosen.customerPrice - target) / target > UNMATCHED_TOLERANCE)
        unmatched = `Nearest Apple price point is ${Math.round((Math.abs(chosen.customerPrice - target) / target) * 100)}% away from the target`;
    }
    const proposed = chosen?.customerPrice ?? null;
    const deltaPct = proposed != null && base.current ? proposed / base.current - 1 : null;
    const alreadyScheduled = !!chosen && prices.upcoming.some((u) => u.territory === territory && (u.pricePointId === chosen.id || u.customerPrice === chosen.customerPrice));
    return { ...base, target, proposed, proposedPricePointId: chosen?.id ?? null, deltaPct, unmatched, alreadyScheduled };
  });

  return { basePricePointId: basePoint.id, baseUsd: basePoint.customerPrice, strategy, rows };
}

export async function scheduleSubscriptionPrices(
  workspaceId: string,
  appId: number,
  subscriptionId: string,
  rows: ScheduleRow[],
  opts: { startDate: string | null; preserveCurrentPrice: boolean },
): Promise<ScheduleResult[]> {
  await resolveAscAppId(workspaceId, appId);
  const prices = await getProductPrices(workspaceId, appId, "subscription", subscriptionId, { refresh: true });
  const startDate = opts.startDate && opts.startDate > today() ? opts.startDate : null;
  const results: ScheduleResult[] = [];
  for (const row of rows) {
    const scheduled = prices.upcoming.some((u) => u.territory === row.territory && u.pricePointId === row.pricePointId && (u.startDate ?? null) === startDate);
    const current = prices.current.find((c) => c.territory === row.territory);
    if (scheduled || (!startDate && current?.pricePointId === row.pricePointId)) {
      results.push({ territory: row.territory, ok: true, skipped: true });
      continue;
    }
    try {
      await ascPost(workspaceId, "/v1/subscriptionPrices", {
        data: {
          type: "subscriptionPrices",
          attributes: { ...(startDate ? { startDate } : {}), preserveCurrentPrice: opts.preserveCurrentPrice && row.increase },
          relationships: {
            subscription: { data: { type: "subscriptions", id: subscriptionId } },
            subscriptionPricePoint: { data: { type: "subscriptionPricePoints", id: row.pricePointId } },
            territory: { data: { type: "territories", id: row.territory } },
          },
        },
      });
      results.push({ territory: row.territory, ok: true });
    } catch (error) {
      results.push({ territory: row.territory, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
  await clearAscCache(workspaceId, priceKey("subscription", subscriptionId));
  return results;
}

type IapEntry = { territory: string; pricePointId: string; startDate: string | null; endDate: string | null };

async function postIapSchedule(workspaceId: string, iapId: string, baseTerritory: string, entries: IapEntry[]) {
  if (!entries.some((e) => e.territory === baseTerritory && !e.startDate))
    throw new HttpError(422, `The base territory ${baseTerritory} needs a current manual price`);
  const included = entries.map((e, i) => ({
    type: "inAppPurchasePrices",
    id: `\${price${i}}`,
    attributes: { startDate: e.startDate, endDate: e.endDate },
    relationships: {
      inAppPurchaseV2: { data: { type: "inAppPurchases", id: iapId } },
      inAppPurchasePricePoint: { data: { type: "inAppPurchasePricePoints", id: e.pricePointId } },
    },
  }));
  await ascPost(workspaceId, "/v1/inAppPurchasePriceSchedules", {
    data: {
      type: "inAppPurchasePriceSchedules",
      relationships: {
        inAppPurchase: { data: { type: "inAppPurchases", id: iapId } },
        baseTerritory: { data: { type: "territories", id: baseTerritory } },
        manualPrices: { data: included.map((p) => ({ type: "inAppPurchasePrices", id: p.id })) },
      },
    },
    included,
  });
}

function existingManualEntries(prices: ProductPrices): IapEntry[] {
  const now = today();
  return [...prices.current.filter((p) => p.manual), ...prices.upcoming.filter((p) => p.manual)]
    .filter((p) => p.pricePointId)
    .map((p) => ({
      territory: p.territory,
      pricePointId: p.pricePointId as string,
      startDate: p.startDate && p.startDate > now ? p.startDate : null,
      endDate: p.endDate,
    }));
}

export async function scheduleIapPrices(
  workspaceId: string,
  appId: number,
  iapId: string,
  rows: ScheduleRow[],
  opts: { startDate: string | null },
): Promise<ScheduleResult[]> {
  await resolveAscAppId(workspaceId, appId);
  const prices = await getProductPrices(workspaceId, appId, "iap", iapId, { refresh: true });
  const baseTerritory = prices.baseTerritory ?? "USA";
  const startDate = opts.startDate && opts.startDate > today() ? opts.startDate : null;
  let entries = existingManualEntries(prices);
  const results: ScheduleResult[] = [];
  const changes: ScheduleRow[] = [];
  for (const row of rows) {
    const current = prices.current.find((c) => c.territory === row.territory);
    const already = prices.upcoming.some((u) => u.territory === row.territory && u.pricePointId === row.pricePointId && u.startDate === startDate);
    if (already || (!startDate && current?.manual && current.pricePointId === row.pricePointId)) results.push({ territory: row.territory, ok: true, skipped: true });
    else changes.push(row);
  }
  if (!changes.length) return results;
  for (const row of changes) {
    const others = entries.filter((e) => e.territory !== row.territory);
    const mine = entries.filter((e) => e.territory === row.territory);
    if (!startDate) {
      entries = [...others, { territory: row.territory, pricePointId: row.pricePointId, startDate: null, endDate: null }];
      continue;
    }
    const kept = mine.filter((e) => !e.startDate || e.startDate < startDate).map((e) => ({ ...e, endDate: !e.endDate || e.endDate > startDate ? startDate : e.endDate }));
    if (!kept.length) {
      const auto = prices.current.find((c) => c.territory === row.territory);
      if (auto?.pricePointId) kept.push({ territory: row.territory, pricePointId: auto.pricePointId, startDate: null, endDate: startDate });
    }
    entries = [...others, ...kept, { territory: row.territory, pricePointId: row.pricePointId, startDate, endDate: null }];
  }
  try {
    await postIapSchedule(workspaceId, iapId, baseTerritory, entries);
    results.push(...changes.map((c) => ({ territory: c.territory, ok: true })));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.push(...changes.map((c) => ({ territory: c.territory, ok: false, error: message })));
  } finally {
    await clearAscCache(workspaceId, priceKey("iap", iapId));
  }
  return results;
}

export async function cancelUpcoming(workspaceId: string, appId: number, kind: ProductKind, productId: string, priceIds: string[]) {
  await resolveAscAppId(workspaceId, appId);
  const prices = await getProductPrices(workspaceId, appId, kind, productId, { refresh: true });
  const targets = prices.upcoming.filter((u) => u.priceId && priceIds.includes(u.priceId));
  if (!targets.length) throw new HttpError(404, "No matching upcoming price changes");
  const results: ScheduleResult[] = [];
  if (kind === "subscription") {
    for (const t of targets) {
      try {
        await ascDelete(workspaceId, `/v1/subscriptionPrices/${t.priceId}`);
        results.push({ territory: t.territory, ok: true });
      } catch (error) {
        results.push({ territory: t.territory, ok: false, error: error instanceof Error ? error.message : String(error) });
      }
    }
  } else {
    const drop = new Set(targets.map((t) => t.priceId));
    const territories = new Set(targets.map((t) => t.territory));
    const remainingUpcoming = prices.upcoming.filter((u) => u.manual && !drop.has(u.priceId));
    const entries = existingManualEntries({ ...prices, upcoming: remainingUpcoming }).map((e) => {
      if (!territories.has(e.territory) || e.startDate) return e;
      const nextStart = remainingUpcoming.filter((u) => u.territory === e.territory).map((u) => u.startDate ?? "").sort()[0];
      return { ...e, endDate: nextStart || null };
    });
    try {
      await postIapSchedule(workspaceId, productId, prices.baseTerritory ?? "USA", entries);
      results.push(...targets.map((t) => ({ territory: t.territory, ok: true })));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push(...targets.map((t) => ({ territory: t.territory, ok: false, error: message })));
    }
  }
  await clearAscCache(workspaceId, priceKey(kind, productId));
  return results;
}
