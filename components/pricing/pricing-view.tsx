"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, PackageOpen, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import Button from "@/components/_ui/button";
import CountBadge from "@/components/_ui/count-badge";
import Tag from "@/components/_ui/tag";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/_ui/tabs";
import AscErrorPanel from "@/components/asc/asc-error";
import { AscGateFallback, AscMenu, useAscGate } from "@/components/asc/asc-gate";
import EmptyState from "@/components/shell/empty-state";
import PageHeader from "@/components/shell/page-header";
import { useCurrentApp } from "@/hooks/use-app";
import { api, useApi } from "@/lib/client/api";
import type { AscProduct, ProductPrices } from "@/lib/asc/types";
import { cn } from "@/lib/utils";
import CurrentPrices from "./current-prices";
import PriceCalculator from "./price-calculator";
import { productKindLabel, stateLabel } from "./pricing-utils";
import ProductList from "./product-list";

export default function PricingView() {
  const { appId, app, error: appError } = useCurrentApp();
  const gate = useAscGate(app);

  if (appError)
    return (
      <>
        <PageHeader title="Price Localization" />
        <EmptyState icon={AlertTriangle} title="App not found" description="This app may have been removed. Pick another app from the sidebar." />
      </>
    );

  if (gate.state !== "ready" || !app)
    return (
      <>
        <PageHeader title="Price Localization" actions={app && gate.state !== "loading" && gate.state !== "disconnected" ? <AscMenu app={app} onSetup={() => gate.setSetupOpen(true)} /> : null} />
        <AscGateFallback
          state={gate.state === "ready" ? "loading" : gate.state}
          app={app}
          feature="localize subscription and in-app purchase prices per storefront"
          error={gate.status?.error ?? null}
          onSetup={() => gate.setSetupOpen(true)}
        />
        {gate.sheet}
      </>
    );

  return (
    <>
      <Products appId={appId} menu={<AscMenu app={app} onSetup={() => gate.setSetupOpen(true)} />} />
      {gate.sheet}
    </>
  );
}

function Products({ appId, menu }: { appId: number; menu: React.ReactNode }) {
  const key = `/api/asc/apps/${appId}/products`;
  const { data: products, error, isLoading, mutate } = useApi<AscProduct[]>(key);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const selected = products?.find((p) => p.id === selectedId) ?? products?.[0] ?? null;

  async function refresh() {
    setRefreshing(true);
    try {
      await mutate(api<AscProduct[]>(`${key}?refresh=1`), { revalidate: false });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Price Localization"
        badge={products && <CountBadge aria-label={`${products.length} products`}>{products.length}</CountBadge>}
        actions={
          <>
            <Button variant="secondary" size="icon" aria-label="Reload products" title="Reload products from App Store Connect" disabled={refreshing} onClick={() => void refresh()}>
              <RefreshCw aria-hidden className={cn("size-3.5", refreshing && "animate-spin")} />
            </Button>
            {menu}
          </>
        }
      />
      {error ? (
        <AscErrorPanel error={error} title="Could not load products" onRetry={() => void mutate()} />
      ) : isLoading || !products ? (
        <div className="text-subtle flex flex-1 items-center justify-center gap-2 py-16">
          <Loader2 aria-hidden className="size-4 animate-spin" /> Loading subscriptions and in-app purchases…
        </div>
      ) : !products.length || !selected ? (
        <EmptyState icon={PackageOpen} title="No products yet" description="Create subscriptions or in-app purchases in App Store Connect, then reload." />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <ProductList products={products} selected={selected.id} onSelect={setSelectedId} />
          <ProductDetail key={selected.id} appId={appId} product={selected} />
        </div>
      )}
    </>
  );
}

function ProductDetail({ appId, product }: { appId: number; product: AscProduct }) {
  const key = `/api/asc/apps/${appId}/prices?kind=${product.kind}&productId=${product.id}`;
  const { data: prices, error, isLoading, mutate } = useApi<ProductPrices>(key);
  const [refreshing, setRefreshing] = useState(false);

  async function reload() {
    setRefreshing(true);
    try {
      await mutate(api<ProductPrices>(`${key}&refresh=1`), { revalidate: false });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  const state = stateLabel(product.state);
  return (
    <Tabs defaultValue="localize" className="min-h-0 min-w-0 flex-1">
      <div className="border-border flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-5 pt-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex items-center gap-2">
            <h2 className="truncate">{product.name}</h2>
            {state && (
              <Tag size="sm" tone={product.state === "APPROVED" ? "green" : "neutral"} className="text-[12px]">
                {state}
              </Tag>
            )}
          </span>
          <span className="caption-style text-subtle truncate">
            {productKindLabel(product)} · {product.productId}
            {product.groupName ? ` · ${product.groupName}` : ""}
          </span>
        </div>
        <Button variant="secondary" size="icon" aria-label="Reload prices" title="Reload prices from App Store Connect" disabled={refreshing} onClick={() => void reload()}>
          <RefreshCw aria-hidden className={cn("size-3.5", refreshing && "animate-spin")} />
        </Button>
        <TabsList className="w-full">
          <TabsTrigger value="localize">Localize prices</TabsTrigger>
          <TabsTrigger value="current">
            Current prices{prices?.upcoming.length ? ` · ${prices.upcoming.length} upcoming` : ""}
          </TabsTrigger>
        </TabsList>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {error ? (
          <AscErrorPanel error={error} title="Could not load prices" onRetry={() => void mutate()} />
        ) : isLoading || !prices ? (
          <div className="text-subtle flex items-center justify-center gap-2 py-16">
            <Loader2 aria-hidden className="size-4 animate-spin" /> Loading prices…
          </div>
        ) : (
          <>
            <TabsContent value="localize">
              <PriceCalculator appId={appId} product={product} prices={prices} onScheduled={() => void reload()} />
            </TabsContent>
            <TabsContent value="current">
              <CurrentPrices appId={appId} kind={product.kind} productId={product.id} prices={prices} onChanged={() => void reload()} />
            </TabsContent>
          </>
        )}
      </div>
    </Tabs>
  );
}
