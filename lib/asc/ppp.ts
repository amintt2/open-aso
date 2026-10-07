export const PPP_PRICE_LEVEL: Record<string, number> = {
  us: 1, gb: 0.84, ca: 0.83, au: 0.9, nz: 0.86, ie: 0.95, fr: 0.81, de: 0.82, it: 0.71,
  es: 0.66, pt: 0.6, nl: 0.86, be: 0.83, lu: 0.98, ch: 1.22, at: 0.84, se: 0.8, no: 0.94,
  dk: 0.93, fi: 0.86, pl: 0.48, cz: 0.56, sk: 0.57, hu: 0.5, ro: 0.42, bg: 0.41, gr: 0.6,
  hr: 0.53, si: 0.63, ee: 0.66, lv: 0.59, lt: 0.56, ua: 0.3, ru: 0.38, tr: 0.34, il: 0.96,
  sa: 0.53, ae: 0.66, qa: 0.63, kw: 0.56, eg: 0.2, za: 0.42, ng: 0.24, kz: 0.32, in: 0.24,
  pk: 0.2, jp: 0.62, kr: 0.64, cn: 0.55, hk: 0.75, tw: 0.47, sg: 0.74, my: 0.38, th: 0.38,
  id: 0.32, ph: 0.38, vn: 0.33, br: 0.5, mx: 0.56, ar: 0.4, cl: 0.53, co: 0.38, pe: 0.46,
  ec: 0.5, cr: 0.66, do: 0.45,
};

export const PPP_DEFAULT_CLAMP = { min: 0.35, max: 1.3 };

export function pppRatio(country: string, clampMin = PPP_DEFAULT_CLAMP.min, clampMax = PPP_DEFAULT_CLAMP.max) {
  const raw = PPP_PRICE_LEVEL[country] ?? 1;
  return Math.min(clampMax, Math.max(clampMin, raw));
}
