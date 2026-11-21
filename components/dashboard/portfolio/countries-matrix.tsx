"use client";

import Link from "next/link";
import { Panel } from "@/components/analytics/chart-kit";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import { countryName, flagOf } from "@/components/trends/trends-format";
import { formatCompact } from "@/lib/client/format";
import type { PortfolioCountry, PortfolioResult } from "@/lib/dashboard/portfolio-types";
import { appColor } from "./portfolio-format";

function alpha(hex: string, strength: number) {
  const n = Math.round(Math.min(1, Math.max(0, strength)) * 150 + 12);
  return `${hex}${n.toString(16).padStart(2, "0")}`;
}

export default function CountriesMatrix({ data }: { data: PortfolioResult }) {
  const rows: PortfolioCountry[] = data.otherCountries ? [...data.countries, data.otherCountries] : data.countries;
  const max = Math.max(1, ...data.countries.flatMap((r) => r.byApp));
  const totals = data.apps.map((_, i) => rows.reduce((s, r) => s + r.byApp[i], 0));
  const grand = totals.reduce((s, n) => s + n, 0);
  return (
    <Panel
      title="Countries × apps"
      description={`First-time downloads by country and app, last ${data.days} days, reported by Apple. Darker means more downloads. Click a cell to open that app's Traffic on that country.`}
    >
      {rows.length ? (
        <div className="-mx-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Country</TableHead>
                {data.apps.map((app, i) => (
                  <TableHead key={app.key} className="text-right">
                    <span className="inline-flex max-w-[140px] items-center gap-1.5">
                      <span aria-hidden className="size-2 shrink-0 rounded-[2px]" style={{ background: appColor(i) }} />
                      <span className="truncate">{app.name}</span>
                    </span>
                  </TableHead>
                ))}
                <TableHead className="pr-4 text-right">All apps</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.country}>
                  <TableCell className="h-[34px] pl-4">
                    {r.country === "other" ? (
                      <span className="text-subtle">Other countries</span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <span aria-hidden>{flagOf(r.country)}</span>
                        <span className="truncate">{countryName(r.country)}</span>
                      </span>
                    )}
                  </TableCell>
                  {data.apps.map((app, i) => {
                    const n = r.byApp[i];
                    const style = n && r.country !== "other" ? { background: alpha(appColor(i), n / max) } : undefined;
                    const cls = "block h-[34px] px-3 text-right leading-[34px] tabular-nums";
                    return (
                      <TableCell key={app.key} className="h-[34px] p-0">
                        {n && app.id != null && r.country !== "other" ? (
                          <Link href={`/apps/${app.id}/traffic?view=countries&country=${r.country}`} title={`${app.name} in ${countryName(r.country)}: ${n.toLocaleString("en-US")} first-time downloads`} className={`${cls} hover:outline-line-strong hover:outline`} style={style}>
                            {formatCompact(n)}
                          </Link>
                        ) : (
                          <span className={`${cls} ${n ? "" : "text-faint"}`} style={style}>
                            {n ? formatCompact(n) : "·"}
                          </span>
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell className="h-[34px] pr-4 text-right font-medium tabular-nums">{formatCompact(r.total)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="border-b-0">
                <TableCell className="text-subtle caption-style h-[38px] pl-4">All countries</TableCell>
                {totals.map((n, i) => (
                  <TableCell key={data.apps[i].key} className="h-[38px] text-right font-medium tabular-nums">
                    {n ? formatCompact(n) : "—"}
                  </TableCell>
                ))}
                <TableCell className="h-[38px] pr-4 text-right font-medium tabular-nums">{formatCompact(grand)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-subtle py-6 text-center">No downloads by country yet. Connect App Store Connect in Integrations to fill this table.</p>
      )}
    </Panel>
  );
}
