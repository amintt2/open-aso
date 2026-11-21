import Tag from "@/components/_ui/tag";
import type { TrackedKeyword } from "@/lib/client/types";
import { PLACE_LABEL, placeOf, type KeywordPlace } from "@/lib/keywords/table";

const TONE: Record<Exclude<KeywordPlace, "none">, "green" | "teal" | "blue" | "neutral"> = {
  title: "green",
  subtitle: "teal",
  keywords: "blue",
  category: "neutral",
};

const SHORT: Record<Exclude<KeywordPlace, "none">, string> = {
  title: "Title",
  subtitle: "Subtitle",
  keywords: "Keyword field",
  category: "Category",
};

export default function WhereCell({ keyword }: { keyword: TrackedKeyword }) {
  const c = keyword.coverage;
  const place = placeOf(keyword);
  if (!c || !place) return <span className="text-subtle">—</span>;
  if (place === "none") {
    const partial = c.match === "partial" && c.missing.length > 0;
    return (
      <span
        className="caption-style text-faint"
        title={
          partial
            ? `Only part of this keyword is in your metadata. Missing: ${c.missing.join(", ")}`
            : "None of these words are in the title, subtitle or keyword field Apple indexes for this storefront"
        }
      >
        {partial ? `Missing “${c.missing.join(" ")}”` : "Not in metadata"}
      </span>
    );
  }
  const secondary = c.primaryLocale ? "" : `, secondary locale ${c.locale}`;
  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={`${c.match === "exact" ? "Exact phrase" : "All words"} found in your ${PLACE_LABEL[place].toLowerCase()} (${c.locale}${secondary}). Indexing strength ${c.score}/100: title counts most, then subtitle, then the keyword field.`}
    >
      <Tag tone={TONE[place]} size="sm" className="text-[12px]">
        {SHORT[place]}
      </Tag>
      {!c.primaryLocale && <span className="caption-style text-subtle">{c.locale}</span>}
      <span className="caption-style text-subtle tabular-nums">{c.score}</span>
    </span>
  );
}
