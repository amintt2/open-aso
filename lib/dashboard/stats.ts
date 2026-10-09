function erf(x: number) {
  const sign = x < 0 ? -1 : 1;
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-x * x);
  return sign * y;
}

export function normalCdf(z: number) {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

export function twoProportionTest(
  controlHits: number,
  controlUsers: number,
  variantHits: number,
  variantUsers: number,
) {
  if (controlUsers <= 0 || variantUsers <= 0) return null;
  const p1 = controlHits / controlUsers;
  const p2 = variantHits / variantUsers;
  const pooled = (controlHits + variantHits) / (controlUsers + variantUsers);
  const se = Math.sqrt(
    pooled * (1 - pooled) * (1 / controlUsers + 1 / variantUsers),
  );
  if (!(se > 0)) return null;
  const z = (p2 - p1) / se;
  return {
    z,
    pValue: 2 * (1 - normalCdf(Math.abs(z))),
    uplift: p1 > 0 ? (p2 - p1) / p1 : null,
  };
}

export function pctChange(
  current: number | null | undefined,
  previous: number | null | undefined,
) {
  if (current == null || previous == null || previous === 0) return null;
  return (current - previous) / Math.abs(previous);
}
