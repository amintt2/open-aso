import Link from "next/link";
import type { ReactNode } from "react";
import { Star } from "lucide-react";
import AppIcon from "@/components/shell/app-icon";
import { formatCompact } from "@/lib/client/format";
import type { StoreApp } from "@/lib/client/types";
import { exploreHref } from "@/lib/explore/format";
import { cn } from "@/lib/utils";

type CardProps = {
  href: string;
  iconUrl: string | null | undefined;
  name: string;
  subtitle: ReactNode;
  meta?: ReactNode;
  rank?: number;
  layout?: "grid" | "list";
  className?: string;
};

export function AppCard({ href, iconUrl, name, subtitle, meta, rank, layout = "grid", className }: CardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex min-w-0 items-center gap-3 outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring/60",
        layout === "grid" ? "bg-card border-border hover:bg-secondary rounded-lg border p-3" : "hover:bg-white/4 rounded-md px-2 py-2",
        className,
      )}
    >
      {rank !== undefined && <span className="caption-style text-subtle w-6 shrink-0 text-right tabular-nums">{rank}</span>}
      <AppIcon src={iconUrl} name={name} className={layout === "grid" ? "size-12" : "size-10"} />
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="truncate text-[14px] leading-tight group-hover:underline group-hover:decoration-from-font group-hover:underline-offset-2">{name}</span>
        <span className="caption-style text-subtle truncate">{subtitle}</span>
        {meta && <span className="caption-style text-soft flex items-center gap-1.5 truncate">{meta}</span>}
      </span>
    </Link>
  );
}

export function RatingMeta({ rating, count }: { rating: number; count: number }) {
  return (
    <>
      <Star aria-hidden className="text-warning size-3 shrink-0 fill-current" />
      <span className="tabular-nums">{rating ? rating.toFixed(1) : "—"}</span>
      <span className="text-subtle tabular-nums">({formatCompact(count)})</span>
    </>
  );
}

export function StoreAppCard({ app, country, layout, rank }: { app: StoreApp; country: string; layout?: "grid" | "list"; rank?: number }) {
  return (
    <AppCard
      href={exploreHref(app.trackId, country)}
      iconUrl={app.artworkUrl100}
      name={app.trackName}
      subtitle={`${app.sellerName} · ${app.primaryGenreName}`}
      meta={
        <>
          <RatingMeta rating={app.averageUserRating} count={app.userRatingCount} />
          <span className="text-subtle">·</span>
          <span>{app.price > 0 ? (app.formattedPrice ?? `$${app.price}`) : "Free"}</span>
        </>
      }
      layout={layout}
      rank={rank}
    />
  );
}

export function StoreAppGrid({ apps, country, layout = "grid" }: { apps: StoreApp[]; country: string; layout?: "grid" | "list" }) {
  return (
    <ul className={cn(layout === "grid" ? "grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3" : "divide-border flex flex-col divide-y")}>
      {apps.map((app) => (
        <li key={app.trackId} className="min-w-0">
          <StoreAppCard app={app} country={country} layout={layout} />
        </li>
      ))}
    </ul>
  );
}
