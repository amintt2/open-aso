export function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatBytes(value: string | number | null | undefined) {
  const n = Number(value);
  if (!n) return "—";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i >= 2 ? 1 : 0)} ${units[i]}`;
}

export function formatRating(value: number | null | undefined) {
  return value == null || !value ? "—" : value.toFixed(1);
}

export function exploreHref(trackId: number, country: string) {
  return `/explore/${trackId}?country=${country}`;
}

export function artworkUrl(url: string | undefined, size = 128) {
  if (!url) return "";
  return url.replace(/\/\d+x\d+(bb)?\.(png|jpg|webp)$/, `/${size}x${size}bb.png`);
}
