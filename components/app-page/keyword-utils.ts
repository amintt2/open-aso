export function charCount(value: string | null | undefined) {
  return value ? [...value].length : 0;
}

export function words(text: string | null | undefined) {
  if (!text) return [];
  return text
    .toLowerCase()
    .normalize("NFKC")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

export function splitKeywords(value: string | null | undefined) {
  if (!value) return [];
  return value.split(",").map((t) => t.trim());
}

export type TermIssue = "duplicate" | "inTitle" | "empty";
export type KeywordTerm = { text: string; issues: TermIssue[] };

export type KeywordAnalysis = {
  terms: KeywordTerm[];
  spacesAfterCommas: number;
  duplicates: string[];
  redundant: string[];
  empty: number;
};

export function analyzeKeywordField(keywords: string | null | undefined, name: string | null | undefined, subtitle: string | null | undefined): KeywordAnalysis {
  const raw = keywords ?? "";
  const titleWords = new Set([...words(name), ...words(subtitle)]);
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  const redundant = new Set<string>();
  let empty = 0;
  const terms = splitKeywords(raw).map<KeywordTerm>((text) => {
    const issues: TermIssue[] = [];
    const norm = text.toLowerCase().normalize("NFKC");
    if (!norm) {
      empty++;
      issues.push("empty");
      return { text, issues };
    }
    if (seen.has(norm)) {
      duplicates.add(norm);
      issues.push("duplicate");
    }
    seen.add(norm);
    const termWords = words(norm);
    if (termWords.length && termWords.every((w) => titleWords.has(w))) {
      redundant.add(norm);
      issues.push("inTitle");
    }
    return { text, issues };
  });
  const spacesAfterCommas = (raw.match(/,\s+/g) ?? []).reduce((n, m) => n + m.length - 1, 0) + (raw.match(/\s+,/g) ?? []).reduce((n, m) => n + m.length - 1, 0);
  return { terms: raw ? terms : [], spacesAfterCommas, duplicates: [...duplicates], redundant: [...redundant], empty };
}

export function cleanKeywords(keywords: string, name: string | null | undefined, subtitle: string | null | undefined) {
  const titleWords = new Set([...words(name), ...words(subtitle)]);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const term of splitKeywords(keywords)) {
    const norm = term.toLowerCase().normalize("NFKC").replace(/\s+/g, " ");
    if (!norm || seen.has(norm)) continue;
    const termWords = words(norm);
    if (termWords.length && termWords.every((w) => titleWords.has(w))) continue;
    seen.add(norm);
    out.push(term.replace(/\s+/g, " "));
  }
  return out.join(",");
}

export type CoverageField = "name" | "subtitle" | "keywords";
export type Coverage = { status: "full" | "partial" | "none"; fields: CoverageField[]; missing: string[] };

export function coverage(term: string, fields: Record<CoverageField, string | null | undefined>): Coverage {
  const termWords = words(term);
  const sets = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, new Set(words(v))])) as Record<CoverageField, Set<string>>;
  const found = new Set<CoverageField>();
  const missing: string[] = [];
  for (const w of termWords) {
    const where = (Object.keys(sets) as CoverageField[]).filter((f) => sets[f].has(w));
    if (!where.length) missing.push(w);
    where.forEach((f) => found.add(f));
  }
  const status = !termWords.length || missing.length === termWords.length ? "none" : missing.length ? "partial" : "full";
  return { status, fields: [...found], missing };
}

export function appendKeywordWords(keywords: string, add: string[], limit: number) {
  const existing = new Set(words(keywords));
  let next = keywords.replace(/,\s*$/, "");
  for (const w of add) {
    if (existing.has(w)) continue;
    const candidate = next ? `${next},${w}` : w;
    if (charCount(candidate) > limit) return { value: next, fitted: false };
    next = candidate;
    existing.add(w);
  }
  return { value: next, fitted: true };
}
