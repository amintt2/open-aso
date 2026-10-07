"use client";

import { Package, Repeat } from "lucide-react";
import Button from "@/components/_ui/button";
import type { AscProduct } from "@/lib/asc/types";
import { productKindLabel } from "./pricing-utils";

type Props = { products: AscProduct[]; selected: string | null; onSelect: (id: string) => void };

export default function ProductList({ products, selected, onSelect }: Props) {
  const groups = new Map<string, AscProduct[]>();
  for (const p of products) {
    const key = p.kind === "subscription" ? `Subscriptions · ${p.groupName ?? "Group"}` : "In-app purchases";
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  return (
    <nav aria-label="Products" className="border-border flex max-h-[40vh] shrink-0 flex-col overflow-y-auto border-b md:max-h-none md:w-[260px] md:border-r md:border-b-0">
      {[...groups.entries()].map(([title, items]) => (
        <section key={title} className="flex flex-col gap-1 p-2">
          <h3 className="eyebrow-style text-subtle px-2.5 py-2">{title}</h3>
          <ul className="flex flex-col gap-0.5">
            {items.map((p) => {
              const Icon = p.kind === "subscription" ? Repeat : Package;
              const active = p.id === selected;
              return (
                <li key={p.id}>
                  <Button variant="nav" size="none" data-active={active} aria-current={active ? "true" : undefined} onClick={() => onSelect(p.id)} className="group h-auto gap-2 px-2.5 py-2">
                    <Icon aria-hidden className="text-subtle size-3.5 shrink-0" />
                    <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                      <span className="w-full truncate text-left text-[13px]">{p.name}</span>
                      <span className="caption-style text-subtle w-full truncate text-left">
                        {productKindLabel(p)} · {p.productId}
                      </span>
                    </span>
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );
}
