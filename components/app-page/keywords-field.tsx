"use client";

import { AlertTriangle, Sparkles } from "lucide-react";
import Button from "@/components/_ui/button";
import Tag from "@/components/_ui/tag";
import { METADATA_LIMITS } from "@/lib/asc/types";
import CharField from "./char-field";
import { analyzeKeywordField, charCount, cleanKeywords } from "./keyword-utils";

type Props = {
  id: string;
  value: string;
  name: string;
  subtitle: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  lockedReason?: string;
  dirty?: boolean;
};

export default function KeywordsField({ id, value, name, subtitle, onChange, disabled, lockedReason, dirty }: Props) {
  const analysis = analyzeKeywordField(value, name, subtitle);
  const cleaned = cleanKeywords(value, name, subtitle);
  const warnings: string[] = [];
  if (analysis.spacesAfterCommas) warnings.push(`${analysis.spacesAfterCommas} space${analysis.spacesAfterCommas > 1 ? "s" : ""} around commas — Apple splits on commas, so spaces just burn characters.`);
  if (analysis.duplicates.length) warnings.push(`Duplicate terms: ${analysis.duplicates.join(", ")}.`);
  if (analysis.redundant.length) warnings.push(`Already indexed from the name or subtitle: ${analysis.redundant.join(", ")}.`);
  if (analysis.empty) warnings.push("Empty terms (double or trailing commas).");

  return (
    <CharField
      id={id}
      label="Keywords"
      value={value}
      onChange={onChange}
      limit={METADATA_LIMITS.keywords}
      disabled={disabled}
      lockedReason={lockedReason}
      dirty={dirty}
      placeholder="comma,separated,terms,no,spaces"
      hint="Hidden from users. Separate terms with commas, no spaces. Words from the name and subtitle are already indexed."
    >
      {analysis.terms.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Keyword terms">
          {analysis.terms
            .filter((t) => !t.issues.includes("empty"))
            .map((t, i) => (
              <li key={`${t.text}-${i}`}>
                <Tag
                  size="sm"
                  tone={t.issues.includes("duplicate") ? "red" : t.issues.includes("inTitle") ? "amber" : "neutral"}
                  className="text-[12px]"
                  title={t.issues.includes("duplicate") ? "Duplicate term" : t.issues.includes("inTitle") ? "Already in the name or subtitle" : undefined}
                >
                  {t.text}
                </Tag>
              </li>
            ))}
        </ul>
      )}
      {warnings.length > 0 && (
        <div className="border-(--tag-amber-border) bg-(--tag-amber-bg) text-(--tag-amber-text) flex flex-col gap-2 rounded-lg border px-3 py-2.5">
          <ul className="flex flex-col gap-1.5">
            {warnings.map((w) => (
              <li key={w} className="caption-style flex items-start gap-1.5 leading-[1.4]">
                <AlertTriangle aria-hidden className="mt-px size-3 shrink-0" />
                {w}
              </li>
            ))}
          </ul>
          {!disabled && cleaned !== value && (
            <Button variant="subtle" size="sm" className="w-fit" onClick={() => onChange(cleaned)}>
              <Sparkles aria-hidden className="size-3.5" />
              Clean up · frees {charCount(value) - charCount(cleaned)} chars
            </Button>
          )}
        </div>
      )}
    </CharField>
  );
}
