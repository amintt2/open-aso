import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { TableHead } from "@/components/_ui/table";
import { cn } from "@/lib/utils";

export type SortState<K extends string> = { key: K; dir: "asc" | "desc" };

export function nextSort<K extends string>(current: SortState<K>, key: K, initial: "asc" | "desc" = "desc"): SortState<K> {
  if (current.key !== key) return { key, dir: initial };
  return { key, dir: current.dir === "desc" ? "asc" : "desc" };
}

export function compareValues(a: number | string | null | undefined, b: number | string | null | undefined, dir: "asc" | "desc") {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  const r = typeof a === "string" && typeof b === "string" ? a.localeCompare(b) : Number(a) - Number(b);
  return dir === "asc" ? r : -r;
}

export default function SortHead<K extends string>({
  label,
  sortKey,
  sort,
  onSort,
  initial,
  className,
}: {
  label: string;
  sortKey: K;
  sort: SortState<K>;
  onSort: (next: SortState<K>) => void;
  initial?: "asc" | "desc";
  className?: string;
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead className={className} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={() => onSort(nextSort(sort, sortKey, initial))}
        className={cn("hover:text-foreground inline-flex cursor-pointer items-center gap-1 transition-colors duration-150", active && "text-foreground")}
      >
        {label}
        <Icon aria-hidden className={cn("size-3", !active && "opacity-50")} />
      </button>
    </TableHead>
  );
}
