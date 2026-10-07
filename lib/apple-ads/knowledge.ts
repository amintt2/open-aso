import type { BidSuggestion, BudgetSuggestion, Diagnosis, Metrics } from "./types";

export const GUARDRAILS = {
  maxBidChange: 0.3,
  maxBudgetIncrease: 0.3,
  noImpressionRaise: 0.15,
  winnerRaise: 0.2,
  minTapsForDecision: 10,
  minTapsWithoutInstall: 25,
  minImpressionsForTtr: 500,
  lowTtr: 0.03,
  cpaTolerance: 0.15,
  winnerCpaRatio: 0.75,
  winnerRoas: 1.3,
  lowImpressionShare: 0.5,
  minBid: 0.1,
  minRelativeChange: 0.03,
  budgetCappedUtilization: 0.9,
  startingBidDiscount: 0.8,
};

export const FORMULAS: { name: string; formula: string; meaning: string }[] = [
  { name: "TTR", formula: "taps ÷ impressions", meaning: "How often people who see the ad tap it. Low TTR means the keyword or the product page does not match what the searcher wanted." },
  { name: "CR", formula: "installs ÷ taps", meaning: "Share of taps that turn into downloads. Mostly driven by product page quality and keyword intent." },
  { name: "CPT", formula: "spend ÷ taps", meaning: "What a tap actually costs. Always at or below your max CPT bid; the second-price auction usually charges less." },
  { name: "CPA (CPI)", formula: "spend ÷ installs", meaning: "Cost of one install. The number to compare against what an install is worth." },
  { name: "RPI", formula: "revenue ÷ attributed installs", meaning: "Average revenue each paid install brings in during the attribution window you measure." },
  { name: "ROAS", formula: "revenue ÷ spend", meaning: "Return on ad spend. Above 1.0 the ads pay for themselves within the measured window." },
  { name: "Break-even CPA", formula: "RPI", meaning: "The most you can pay per install without losing money." },
  { name: "Break-even CPT", formula: "RPI × CR", meaning: "The most you can pay per tap at today's conversion rate. A max CPT bid above this loses money once the auction charges near your bid." },
];

export const SAFE_DEFAULTS: { title: string; detail: string }[] = [
  { title: "Search Results placement first", detail: "Search Results carries the strongest intent. Add Today tab, Search tab or product page placements only after search is profitable." },
  { title: "One country per campaign", detail: "Budgets, bids and auctions differ by storefront. Separate campaigns keep spend and reporting readable and let you cap each market." },
  { title: "Exact match for known keywords", detail: "Exact match gives you precise control of bid and spend per query. Use broad match and Search Match only in a separate discovery campaign." },
  { title: "Search Match off in exact groups", detail: "Search Match adds queries Apple picks for you. In an exact group it mixes uncontrolled traffic into keywords you are trying to price." },
  { title: "Start bids below the suggestion", detail: "Apple's suggested bid is a ceiling-leaning hint. Start around 80% of it, collect data, then move in steps." },
  { title: "Negate exact winners in discovery", detail: "Every exact keyword should be an exact negative in broad and Search Match groups of the same app and country so the groups do not bid against each other." },
  { title: "Small, spaced steps", detail: "Change a bid at most once every few days and by no more than 30% at a time. The auction needs a few days to settle before the next read." },
];

export const BID_RULES: { rule: string; when: string; then: string }[] = [
  { rule: "no-impressions", when: "No impressions after 3+ days on an active keyword", then: "Raise the bid by about 15%, re-check in 3 days, repeat until it serves or reaches your break-even CPT." },
  { rule: "learning", when: "Fewer than 10 taps in the window", then: "Wait. The numbers are noise until there are enough taps to read." },
  { rule: "spend-no-installs", when: "25+ taps and zero installs", then: "Lower the bid by 25%, or pause when spend already exceeds three target CPAs." },
  { rule: "cpa-above-break-even", when: "CPA more than 15% above break-even CPA (RPI)", then: "Lower the bid in proportion to the gap, never more than 30% in one step." },
  { rule: "cpa-above-target", when: "No revenue data and CPA more than 15% above your target CPA", then: "Lower the bid toward the target, never more than 30% in one step." },
  { rule: "low-ttr", when: "500+ impressions and TTR under 3%", then: "Review relevance: the query may not match the app. Check the search terms and the first screenshots before raising anything." },
  { rule: "scale-winner", when: "ROAS ≥ 1.3 or CPA ≤ 75% of target, and impression share below 50%", then: "Raise the bid up to 20% to win more auctions." },
  { rule: "on-target", when: "Everything inside the target band", then: "Hold. Let it run." },
];

export const REVIEW_CHECKLIST: { cadence: string; items: string[] }[] = [
  {
    cadence: "Daily",
    items: [
      "Check that every campaign is running and none is paused by the system or out of budget.",
      "Scan spend against daily budgets for unexpected spikes.",
      "Look for keywords that spent money with zero installs.",
    ],
  },
  {
    cadence: "Every 3 days",
    items: [
      "Apply bid changes for keywords with enough data (10+ taps): lower over-target CPAs, raise silent keywords.",
      "Move exact-match winners from discovery groups into exact groups and add them as negatives in discovery.",
      "Resolve cannibalization warnings.",
    ],
  },
  {
    cadence: "Weekly",
    items: [
      "Mine search terms from broad and Search Match groups for new exact keywords and new negatives.",
      "Compare CPA and ROAS per country and shift budget toward the profitable markets (max +30% per step).",
      "Review impression share on top keywords; raise only where the economics allow.",
    ],
  },
  {
    cadence: "Monthly",
    items: [
      "Recompute RPI and break-even CPT from fresh revenue data and update target CPAs.",
      "Retire keywords that have not converted in 30 days.",
      "Test a new country or placement with a small, separate campaign.",
      "Re-check product page conversion: a better page lowers CPA on every keyword.",
    ],
  },
];

export function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

export function deriveMetrics(raw: Pick<Metrics, "impressions" | "taps" | "installs" | "spend"> & Partial<Pick<Metrics, "newDownloads" | "redownloads">>): Metrics {
  return {
    impressions: raw.impressions,
    taps: raw.taps,
    installs: raw.installs,
    newDownloads: raw.newDownloads ?? 0,
    redownloads: raw.redownloads ?? 0,
    spend: raw.spend,
    ttr: ratio(raw.taps, raw.impressions),
    cr: ratio(raw.installs, raw.taps),
    cpt: ratio(raw.spend, raw.taps),
    cpa: ratio(raw.spend, raw.installs),
  };
}

export function sumMetrics(list: Metrics[]): Metrics {
  const total = list.reduce(
    (acc, m) => ({
      impressions: acc.impressions + m.impressions,
      taps: acc.taps + m.taps,
      installs: acc.installs + m.installs,
      newDownloads: acc.newDownloads + m.newDownloads,
      redownloads: acc.redownloads + m.redownloads,
      spend: acc.spend + m.spend,
    }),
    { impressions: 0, taps: 0, installs: 0, newDownloads: 0, redownloads: 0, spend: 0 },
  );
  return deriveMetrics(total);
}

export function breakEven(revenue: number | null | undefined, attributedInstalls: number | null | undefined, cr: number | null | undefined) {
  const rpi = revenue != null && attributedInstalls ? revenue / attributedInstalls : null;
  return { rpi, cpa: rpi, cpt: rpi != null && cr != null ? rpi * cr : null };
}

export type KeywordSignal = {
  status?: string | null;
  impressions: number;
  taps: number;
  installs: number;
  spend: number;
  bid: number;
  suggestedBid?: number | null;
  impressionShare?: number | null;
  revenue?: number | null;
  attributedInstalls?: number | null;
  targetCpa?: number | null;
  days: number;
};

function money(n: number) {
  return n.toFixed(2);
}

export function diagnoseKeyword(s: KeywordSignal): Diagnosis {
  const cpa = ratio(s.spend, s.installs);
  const ttr = ratio(s.taps, s.impressions);
  const cr = ratio(s.installs, s.taps);
  const even = breakEven(s.revenue, s.attributedInstalls, cr);
  const roas = s.revenue != null && s.spend > 0 ? s.revenue / s.spend : null;
  const g = GUARDRAILS;

  if (s.status === "PAUSED") return { action: "hold", rule: "paused", why: "Keyword is paused. Nothing to change until it is enabled again." };

  if (s.impressions === 0) {
    if (s.days < 3) return { action: "wait", rule: "learning", why: "Too early to judge: give a new or changed bid at least 3 days." };
    const hint = s.suggestedBid && s.suggestedBid > s.bid ? ` Apple suggests about ${money(s.suggestedBid)}.` : "";
    return { action: "raise", rule: "no-impressions", why: `No impressions in ${s.days} days, so the bid is probably too low to enter the auction. Raise it about 15% and re-check in 3 days.${hint}` };
  }

  if (s.taps < g.minTapsForDecision) {
    if (s.impressions >= g.minImpressionsForTtr && ttr != null && ttr < g.lowTtr)
      return { action: "review", rule: "low-ttr", why: `TTR is ${(ttr * 100).toFixed(1)}% on ${s.impressions} impressions. The query may not match the app; review relevance before spending more.` };
    return { action: "wait", rule: "learning", why: `Only ${s.taps} taps so far. Wait for at least ${g.minTapsForDecision} before changing the bid.` };
  }

  if (s.installs === 0 && s.taps >= g.minTapsWithoutInstall) {
    if (s.targetCpa && s.spend >= s.targetCpa * 3)
      return { action: "pause", rule: "spend-no-installs", why: `${s.taps} taps and ${money(s.spend)} spent with no install, already more than three target CPAs. Pause it or rethink the match.` };
    return { action: "lower", rule: "spend-no-installs", why: `${s.taps} taps with no install. Lower the bid 25% and check the product page for this query.` };
  }

  if (cpa != null && even.cpa != null && cpa > even.cpa * (1 + g.cpaTolerance))
    return { action: "lower", rule: "cpa-above-break-even", why: `CPA ${money(cpa)} is above break-even ${money(even.cpa)} (revenue per install). Each install currently loses money.` };

  if (cpa != null && even.cpa == null && s.targetCpa && cpa > s.targetCpa * (1 + g.cpaTolerance))
    return { action: "lower", rule: "cpa-above-target", why: `CPA ${money(cpa)} is above the ${money(s.targetCpa)} target. Bring the bid down toward the target.` };

  if (s.impressions >= g.minImpressionsForTtr && ttr != null && ttr < g.lowTtr)
    return { action: "review", rule: "low-ttr", why: `TTR is ${(ttr * 100).toFixed(1)}%. Searchers rarely tap, which hints at low relevance. Review intent before raising.` };

  const target = even.cpa ?? s.targetCpa ?? null;
  const winning = (roas != null && roas >= g.winnerRoas) || (cpa != null && target != null && cpa <= target * g.winnerCpaRatio);
  if (winning) {
    if (s.impressionShare != null && s.impressionShare >= g.lowImpressionShare)
      return { action: "hold", rule: "saturated", why: `Profitable and already winning about ${Math.round(s.impressionShare * 100)}% of impressions. Higher bids would mostly raise CPT.` };
    const share = s.impressionShare != null ? ` with only ~${Math.round(s.impressionShare * 100)}% impression share` : "";
    const proof = roas != null && roas >= g.winnerRoas ? `ROAS ${roas.toFixed(2)}` : `CPA ${money(cpa ?? 0)} vs ${money(target ?? 0)} ${even.cpa != null ? "break-even" : "target"}`;
    return { action: "raise", rule: "scale-winner", why: `${proof}${share}. Room to win more auctions; raise up to 20%.` };
  }

  if (cpa == null) return { action: "hold", rule: "no-target", why: "No installs yet but not enough taps to call it. Keep watching." };
  if (target == null) return { action: "hold", rule: "no-target", why: "Set a target CPA or connect revenue so bids can be judged against what an install is worth." };
  return { action: "hold", rule: "on-target", why: `CPA ${money(cpa)} is inside the target band. Hold the bid.` };
}

function clampChange(current: number, proposed: number, maxUp: number, maxDown: number) {
  const upper = current * (1 + maxUp);
  const lower = current * (1 - maxDown);
  const bounded = Math.min(upper, Math.max(lower, proposed));
  return { value: Math.max(GUARDRAILS.minBid, Math.round(bounded * 100) / 100), capped: bounded !== proposed };
}

export function proposedBid(s: KeywordSignal, d: Diagnosis): number | null {
  const cpa = ratio(s.spend, s.installs);
  const even = breakEven(s.revenue, s.attributedInstalls, ratio(s.installs, s.taps));
  switch (d.rule) {
    case "no-impressions":
      return s.bid * (1 + GUARDRAILS.noImpressionRaise);
    case "scale-winner":
      return s.bid * (1 + (s.impressionShare == null ? GUARDRAILS.winnerRaise / 2 : GUARDRAILS.winnerRaise));
    case "spend-no-installs":
      return d.action === "lower" ? s.bid * 0.75 : null;
    case "cpa-above-break-even":
      return cpa && even.cpa ? s.bid * (even.cpa / cpa) : null;
    case "cpa-above-target":
      return cpa && s.targetCpa ? s.bid * (s.targetCpa / cpa) : null;
    default:
      return null;
  }
}

export type BidRow = KeywordSignal & { keywordId: string; campaignId: string; adGroupId: string; text: string };

export function suggestBid(row: BidRow, diagnosis = diagnoseKeyword(row)): BidSuggestion | null {
  if (diagnosis.action !== "raise" && diagnosis.action !== "lower") return null;
  const raw = proposedBid(row, diagnosis);
  if (raw == null || !Number.isFinite(raw) || row.bid <= 0) return null;
  const { value, capped } = clampChange(row.bid, raw, GUARDRAILS.maxBidChange, GUARDRAILS.maxBidChange);
  const changePct = (value - row.bid) / row.bid;
  if (Math.abs(changePct) < GUARDRAILS.minRelativeChange) return null;
  return {
    keywordId: row.keywordId,
    campaignId: row.campaignId,
    adGroupId: row.adGroupId,
    text: row.text,
    current: row.bid,
    suggested: value,
    changePct,
    rule: diagnosis.rule,
    why: diagnosis.why,
    capped,
  };
}

export function suggestBidChanges(rows: BidRow[]): BidSuggestion[] {
  return rows
    .map((row) => suggestBid(row))
    .filter((s): s is BidSuggestion => s !== null)
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
}

export type BudgetRow = {
  campaignId: string;
  name: string;
  status: string;
  dailyBudget: number | null;
  spend: number;
  installs: number;
  days: number;
  targetCpa?: number | null;
  revenue?: number | null;
  attributedInstalls?: number | null;
};

export function suggestBudgetChanges(rows: BudgetRow[]): BudgetSuggestion[] {
  const out: BudgetSuggestion[] = [];
  for (const r of rows) {
    if (r.status !== "ENABLED" || !r.dailyBudget || r.days <= 0) continue;
    const avgDaily = r.spend / r.days;
    const utilization = avgDaily / r.dailyBudget;
    const cpa = ratio(r.spend, r.installs);
    const even = breakEven(r.revenue, r.attributedInstalls, null).cpa;
    const target = even ?? r.targetCpa ?? null;
    const roas = r.revenue != null && r.spend > 0 ? r.revenue / r.spend : null;
    const profitable = (roas != null && roas >= GUARDRAILS.winnerRoas) || (cpa != null && target != null && cpa <= target);
    const losing = (roas != null && roas < 0.7) || (cpa != null && target != null && cpa > target * 1.5);
    let proposed: number | null = null;
    let rule = "";
    let why = "";
    if (utilization >= GUARDRAILS.budgetCappedUtilization && profitable) {
      proposed = r.dailyBudget * 1.2;
      rule = "budget-capped-winner";
      why = `Spending ${Math.round(utilization * 100)}% of the daily budget at a profitable CPA. More budget should buy more installs at a similar cost.`;
    } else if (utilization >= GUARDRAILS.budgetCappedUtilization && losing) {
      proposed = r.dailyBudget * 0.8;
      rule = "budget-burning";
      why = `Uses the full budget while CPA is far above target. Trim the budget while bids are corrected.`;
    }
    if (proposed == null) continue;
    const { value, capped } = clampChange(r.dailyBudget, proposed, GUARDRAILS.maxBudgetIncrease, 0.5);
    out.push({ campaignId: r.campaignId, name: r.name, current: r.dailyBudget, suggested: Math.round(value), changePct: (Math.round(value) - r.dailyBudget) / r.dailyBudget, rule, why, capped });
  }
  return out;
}

export function startingBid(suggested: number | null | undefined, fallback: number) {
  if (!suggested) return fallback;
  return Math.max(GUARDRAILS.minBid, Math.round(suggested * GUARDRAILS.startingBidDiscount * 100) / 100);
}

export function exceedsCap(before: number, after: number, cap: number) {
  if (before <= 0) return false;
  return Math.abs(after - before) / before > cap + 1e-9;
}
