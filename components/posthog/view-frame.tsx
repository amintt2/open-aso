"use client";

import type { ReactNode } from "react";
import { ErrorBlock, LoadingBlock } from "@/components/analytics/parts";
import type { PosthogMeta } from "@/lib/posthog/types";
import { Freshness, ProductDemoBanner } from "./product-parts";

export default function ViewFrame<T extends PosthogMeta>({
  data,
  error,
  refresh,
  refreshing,
  onConnect,
  caption,
  children,
}: {
  data: T | undefined;
  error: Error | undefined;
  refresh: () => void;
  refreshing: boolean;
  onConnect: () => void;
  caption: (data: T) => ReactNode;
  children: (data: T) => ReactNode;
}) {
  if (error && !data) return <ErrorBlock message={error.message} />;
  if (!data) return <LoadingBlock />;
  return (
    <div className="flex flex-col gap-4">
      <ProductDemoBanner notice={data.notice} onConnect={onConnect} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="caption-style text-subtle">{caption(data)}</p>
        <Freshness meta={data} onRefresh={refresh} refreshing={refreshing} />
      </div>
      {children(data)}
    </div>
  );
}
