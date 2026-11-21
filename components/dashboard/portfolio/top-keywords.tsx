"use client";

import Link from "next/link";
import { Panel } from "@/components/analytics/chart-kit";
import { SourceChip } from "@/components/analytics/parts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import { approxInstalls, flagOf, formatPosition } from "@/components/trends/trends-format";
import type { PortfolioResult } from "@/lib/dashboard/portfolio-types";
import { appColor } from "./portfolio-format";

export default function TopKeywords({ data }: { data: PortfolioResult }) {
  const color = new Map(data.apps.map((a, i) => [a.name, appColor(i)]));
  return (
    <Panel title="Top keywords across apps" description="The keywords the rankings model credits with the most installs per day today, all apps together. Positions are measured, installs are estimates." actions={<SourceChip source="estimate" />}>
      {data.keywords.length ? (
        <div className="-mx-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Keyword</TableHead>
                <TableHead>App</TableHead>
                <TableHead className="text-right" title="Rank in App Store search today, measured by Open ASO">
                  Position
                </TableHead>
                <TableHead className="text-right" title="Search popularity, 0 to 100">
                  Pop.
                </TableHead>
                <TableHead className="pr-4 text-right" title="Installs per day the rankings model credits to this keyword. Estimate.">
                  Est. / day
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.keywords.map((k) => {
                const term = (
                  <span className="flex min-w-0 items-center gap-2">
                    <span aria-hidden>{flagOf(k.country)}</span>
                    <span className="max-w-[220px] truncate">{k.term}</span>
                  </span>
                );
                return (
                  <TableRow key={`${k.app}-${k.term}-${k.country}`}>
                    <TableCell className="h-[36px] pl-4">
                      {k.id == null ? (
                        term
                      ) : (
                        <Link href={`/apps/${k.id}/keywords?q=${encodeURIComponent(k.term)}`} className="hover:text-soft" title={`Open “${k.term}” in ${k.app}'s keywords`}>
                          {term}
                        </Link>
                      )}
                    </TableCell>
                    <TableCell className="h-[36px]">
                      <span className="text-soft flex items-center gap-1.5">
                        <span aria-hidden className="size-2 shrink-0 rounded-[2px]" style={{ background: color.get(k.app) ?? "var(--faint)" }} />
                        <span className="max-w-[140px] truncate">{k.app}</span>
                      </span>
                    </TableCell>
                    <TableCell className="h-[36px] text-right tabular-nums">{formatPosition(k.position)}</TableCell>
                    <TableCell className="h-[36px] text-right tabular-nums">{k.popularity == null ? "—" : Math.round(k.popularity)}</TableCell>
                    <TableCell className="h-[36px] pr-4 text-right tabular-nums">{approxInstalls(k.estInstalls)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-subtle py-6 text-center">No ranked keyword yet. Track keywords in an app to see which ones bring installs.</p>
      )}
    </Panel>
  );
}
