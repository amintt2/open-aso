"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Calculator, CheckCircle2, Loader2, MinusCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import Button from "@/components/_ui/button";
import { Checkbox } from "@/components/_ui/checkbox";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import { InlineError } from "@/components/asc/asc-error";
import { api } from "@/lib/client/api";
import { PPP_DEFAULT_CLAMP } from "@/lib/asc/ppp";
import { territoryInfo } from "@/lib/asc/territories";
import type { AscProduct, PlanRow, PricingPlan, PricingStrategy, ProductPrices, ScheduleResult, ScheduleRow } from "@/lib/asc/types";
import { cn } from "@/lib/utils";
import { isoDate, money, pct } from "./pricing-utils";
import ScheduleDialog, { type StartMode } from "./schedule-dialog";

const STRATEGIES: { value: PricingStrategy; label: string; description: string }[] = [
  {
    value: "ppp",
    label: "Purchasing power",
    description:
      "Starts from Apple's equalized price for each storefront, then scales it by an approximate price-level ratio vs the US (World Bank PLI ballparks) and snaps to the nearest Apple price point.",
  },
  {
    value: "equalized",
    label: "Equalized",
    description: "Uses Apple's own equalization of the US price — the same prices App Store Connect generates from a base price, adjusted for exchange rates and taxes.",
  },
];

const CHUNK = 5;

function isChange(r: PlanRow) {
  return !!r.proposedPricePointId && !r.alreadyScheduled && r.proposedPricePointId !== r.currentPricePointId && r.proposed !== r.current;
}

type Props = { appId: number; product: AscProduct; prices: ProductPrices; onScheduled: () => void };

export default function PriceCalculator({ appId, product, prices, onScheduled }: Props) {
  const usCurrent = prices.current.find((p) => p.territory === "USA")?.customerPrice;
  const [base, setBase] = useState(usCurrent ? String(usCurrent) : "");
  const [strategy, setStrategy] = useState<PricingStrategy>("ppp");
  const [clampMin, setClampMin] = useState(String(PPP_DEFAULT_CLAMP.min));
  const [clampMax, setClampMax] = useState(String(PPP_DEFAULT_CLAMP.max));
  const [plan, setPlan] = useState<PricingPlan | null>(null);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [include, setInclude] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<Record<string, ScheduleResult>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [running, setRunning] = useState<{ done: number; total: number } | null>(null);

  const baseUsd = Number.parseFloat(base);
  const validBase = Number.isFinite(baseUsd) && baseUsd > 0;

  async function calculate() {
    setPlanning(true);
    setError(null);
    setResults({});
    try {
      const next = await api<PricingPlan>(`/api/asc/apps/${appId}/pricing/plan`, {
        method: "POST",
        body: {
          kind: product.kind,
          productId: product.id,
          baseUsd,
          strategy,
          clampMin: Number.parseFloat(clampMin) || undefined,
          clampMax: Number.parseFloat(clampMax) || undefined,
        },
      });
      setPlan(next);
      setInclude(new Set(next.rows.filter(isChange).map((r) => r.territory)));
    } catch (e) {
      setError(e);
    } finally {
      setPlanning(false);
    }
  }

  const rows = useMemo(() => plan?.rows ?? [], [plan]);
  const selectedRows = rows.filter((r) => include.has(r.territory) && r.proposedPricePointId);
  const changeable = rows.filter((r) => r.proposedPricePointId);

  function toggle(territory: string, on: boolean) {
    setInclude((s) => {
      const next = new Set(s);
      if (on) next.add(territory);
      else next.delete(territory);
      return next;
    });
  }

  async function schedule(opts: { startMode: StartMode; customDate: string; preserve: boolean }) {
    const startDate = opts.startMode === "today" ? null : opts.startMode === "tomorrow" ? isoDate(1) : opts.customDate;
    const payload: ScheduleRow[] = selectedRows.map((r) => ({
      territory: r.territory,
      pricePointId: r.proposedPricePointId as string,
      increase: r.current != null && r.proposed != null && r.proposed > r.current,
    }));
    const chunks = product.kind === "iap" ? [payload] : Array.from({ length: Math.ceil(payload.length / CHUNK) }, (_, i) => payload.slice(i * CHUNK, i * CHUNK + CHUNK));
    setRunning({ done: 0, total: payload.length });
    setResults({});
    const all: ScheduleResult[] = [];
    for (const chunk of chunks) {
      let res: ScheduleResult[];
      try {
        res = await api<ScheduleResult[]>(`/api/asc/apps/${appId}/pricing/schedule`, {
          method: "POST",
          body: { kind: product.kind, productId: product.id, rows: chunk, startDate, preserveCurrentPrice: opts.preserve },
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Request failed";
        res = chunk.map((c) => ({ territory: c.territory, ok: false, error: message }));
      }
      all.push(...res);
      setResults((prev) => ({ ...prev, ...Object.fromEntries(res.map((r) => [r.territory, r])) }));
      setRunning((p) => (p ? { ...p, done: p.done + chunk.length } : p));
      if (chunks.length > 1) await new Promise((r) => setTimeout(r, 400));
    }
    setRunning(null);
    setConfirmOpen(false);
    const ok = all.filter((r) => r.ok && !r.skipped).length;
    const skipped = all.filter((r) => r.skipped).length;
    const failed = all.filter((r) => !r.ok).length;
    if (ok) toast.success(`Scheduled ${ok} price change${ok === 1 ? "" : "s"}`);
    if (skipped) toast(`${skipped} already scheduled or unchanged — skipped`);
    if (failed) toast.error(`${failed} territor${failed === 1 ? "y" : "ies"} failed — see the table`);
    setInclude(new Set(all.filter((r) => !r.ok).map((r) => r.territory)));
    onScheduled();
  }

  const active = STRATEGIES.find((s) => s.value === strategy) ?? STRATEGIES[0];

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="border-border bg-card flex flex-col gap-4 rounded-xl border p-4">
        <div className="flex flex-wrap items-end gap-4">
          <Field label="Base price (USD)" htmlFor="base-usd" className="w-[160px]">
            <Input id="base-usd" inputMode="decimal" value={base} onChange={(e) => setBase(e.target.value)} placeholder="9.99" />
          </Field>
          <div className="flex flex-col gap-2">
            <span className="caption-style text-soft">Strategy</span>
            <div role="radiogroup" aria-label="Strategy" className="bg-secondary flex h-9 items-center gap-1 rounded-full p-1 shadow-[0px_0px_0px_1px_rgba(0,0,0,0.4)]">
              {STRATEGIES.map((s) => (
                <Button
                  key={s.value}
                  role="radio"
                  aria-checked={strategy === s.value}
                  variant={strategy === s.value ? "muted" : "ghost"}
                  size="sm"
                  className="h-7"
                  onClick={() => setStrategy(s.value)}
                >
                  {s.label}
                </Button>
              ))}
            </div>
          </div>
          {strategy === "ppp" && (
            <>
              <Field label="Min ratio" htmlFor="clamp-min" className="w-[96px]">
                <Input id="clamp-min" inputMode="decimal" value={clampMin} onChange={(e) => setClampMin(e.target.value)} />
              </Field>
              <Field label="Max ratio" htmlFor="clamp-max" className="w-[96px]">
                <Input id="clamp-max" inputMode="decimal" value={clampMax} onChange={(e) => setClampMax(e.target.value)} />
              </Field>
            </>
          )}
          <Button variant="primary" size="md" className="h-9 px-4" disabled={!validBase || planning} onClick={() => void calculate()}>
            {planning ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <Calculator aria-hidden className="size-3.5" />}
            Calculate
          </Button>
        </div>
        <p className="caption-style text-subtle leading-[1.45]">{active.description} The base price snaps to the nearest US price point.</p>
      </div>

      {error != null && <InlineError error={error} />}
      {planning && !plan && (
        <p className="text-subtle flex items-center gap-2">
          <Loader2 aria-hidden className="size-3.5 animate-spin" /> Fetching Apple price points for 66 storefronts — the first run can take a minute…
        </p>
      )}

      {plan && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-soft">
              {selectedRows.length} of {changeable.length} selected · base {money(plan.baseUsd, "USD")}
            </span>
            <span className="flex-1" />
            <Button variant="ghost" size="sm" onClick={() => setInclude(new Set(rows.filter(isChange).map((r) => r.territory)))}>
              Changed only
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setInclude(new Set(changeable.map((r) => r.territory)))}>
              All
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setInclude(new Set())}>
              None
            </Button>
            <Button variant="primary" size="sm" className="h-[30px] px-3" disabled={!selectedRows.length || running !== null} onClick={() => setConfirmOpen(true)}>
              Schedule {selectedRows.length} change{selectedRows.length === 1 ? "" : "s"}
            </Button>
          </div>
          <PlanTable plan={plan} include={include} onToggle={toggle} results={results} />
        </>
      )}

      <ScheduleDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        kind={product.kind}
        rows={selectedRows}
        baseTerritory={prices.baseTerritory}
        running={running}
        onConfirm={schedule}
      />
    </div>
  );
}

function PlanTable({ plan, include, onToggle, results }: { plan: PricingPlan; include: Set<string>; onToggle: (t: string, on: boolean) => void; results: Record<string, ScheduleResult> }) {
  const ppp = plan.strategy === "ppp";
  return (
    <div className="border-border overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10" />
            <TableHead>Territory</TableHead>
            <TableHead>Currency</TableHead>
            <TableHead className="text-right">Current</TableHead>
            {ppp && <TableHead className="text-right">Ratio</TableHead>}
            {ppp && <TableHead className="text-right">Target</TableHead>}
            <TableHead className="text-right">Proposed</TableHead>
            <TableHead className="text-right">Δ</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {plan.rows.map((r) => {
            const info = territoryInfo(r.territory);
            const result = results[r.territory];
            const delta = r.deltaPct;
            return (
              <TableRow key={r.territory} className={cn("last:border-b-0", !include.has(r.territory) && "opacity-60")}>
                <TableCell>
                  <Checkbox aria-label={`Include ${info.name}`} disabled={!r.proposedPricePointId} checked={include.has(r.territory)} onCheckedChange={(v) => onToggle(r.territory, v === true)} />
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-2">
                    <span aria-hidden>{info.flag}</span>
                    <span className="text-[13px]">{info.name}</span>
                  </span>
                </TableCell>
                <TableCell className="text-soft">{r.currency ?? "—"}</TableCell>
                <TableCell className="text-soft text-right tabular-nums">{money(r.current, r.currency)}</TableCell>
                {ppp && <TableCell className="text-subtle text-right tabular-nums">{r.ratio?.toFixed(2) ?? "—"}</TableCell>}
                {ppp && <TableCell className="text-subtle text-right tabular-nums">{money(r.target, r.currency)}</TableCell>}
                <TableCell className="text-right font-medium tabular-nums">{money(r.proposed, r.currency)}</TableCell>
                <TableCell className={cn("text-right tabular-nums", delta == null ? "text-subtle" : delta > 0.005 ? "text-trend" : delta < -0.005 ? "text-danger" : "text-subtle")}>{pct(delta)}</TableCell>
                <TableCell className="caption-style">
                  <RowStatus row={r} result={result} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function RowStatus({ row, result }: { row: PlanRow; result?: ScheduleResult }) {
  if (result)
    return result.ok ? (
      <span className="text-success inline-flex items-center gap-1">
        <CheckCircle2 aria-hidden className="size-3.5" />
        {result.skipped ? "Skipped (already set)" : "Scheduled"}
      </span>
    ) : (
      <span className="text-danger inline-flex max-w-[320px] items-start gap-1 whitespace-normal" title={result.error}>
        <XCircle aria-hidden className="mt-px size-3.5 shrink-0" />
        {result.error}
      </span>
    );
  if (row.unmatched)
    return (
      <span className="text-warning inline-flex max-w-[280px] items-start gap-1 whitespace-normal">
        <AlertTriangle aria-hidden className="mt-px size-3.5 shrink-0" />
        {row.unmatched}
      </span>
    );
  if (row.alreadyScheduled) return <span className="text-subtle">Already scheduled</span>;
  if (row.proposedPricePointId === row.currentPricePointId || row.proposed === row.current)
    return (
      <span className="text-subtle inline-flex items-center gap-1">
        <MinusCircle aria-hidden className="size-3.5" />
        Unchanged
      </span>
    );
  return null;
}
