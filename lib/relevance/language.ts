import { getCountry, isCountry } from "@/lib/appstore/countries";

export type Script = "latin" | "cyrillic" | "greek" | "hebrew" | "arabic" | "devanagari" | "thai" | "hangul" | "kana" | "han";

const SCRIPT_TESTS: [Script, RegExp][] = [
  ["latin", /\p{Script=Latin}/u],
  ["cyrillic", /\p{Script=Cyrillic}/u],
  ["greek", /\p{Script=Greek}/u],
  ["hebrew", /\p{Script=Hebrew}/u],
  ["arabic", /\p{Script=Arabic}/u],
  ["devanagari", /\p{Script=Devanagari}/u],
  ["thai", /\p{Script=Thai}/u],
  ["hangul", /\p{Script=Hangul}/u],
  ["kana", /[\p{Script=Hiragana}\p{Script=Katakana}]/u],
  ["han", /\p{Script=Han}/u],
];

const SCRIPT_NAME: Record<Script, string> = {
  latin: "Latin script",
  cyrillic: "Cyrillic",
  greek: "Greek",
  hebrew: "Hebrew",
  arabic: "Arabic",
  devanagari: "Devanagari (Hindi)",
  thai: "Thai",
  hangul: "Korean",
  kana: "Japanese",
  han: "Chinese characters",
};

const LOCALE_SCRIPTS: Record<string, Script[]> = {
  ru: ["cyrillic"],
  uk: ["cyrillic"],
  el: ["greek"],
  he: ["hebrew"],
  ar: ["arabic"],
  hi: ["devanagari"],
  th: ["thai"],
  ko: ["hangul", "han"],
  ja: ["kana", "han"],
  zh: ["han"],
};

const LONG_LIST = 4;

function base(locale: string) {
  return locale.split("-")[0].toLowerCase();
}

export function searchLocales(country: string): string[] {
  if (!isCountry(country)) return ["en-US"];
  const locales = getCountry(country).indexedLocales;
  return locales.length > LONG_LIST ? locales.slice(0, 2) : locales;
}

export function searchLanguages(country: string): string[] {
  const names = new Intl.DisplayNames(["en"], { type: "language" });
  return [...new Set(searchLocales(country).map((l) => names.of(base(l)) ?? l))];
}

function allowedScripts(country: string) {
  const out = new Set<Script>(["latin"]);
  for (const locale of searchLocales(country)) for (const s of LOCALE_SCRIPTS[base(locale)] ?? []) out.add(s);
  return out;
}

export function scriptsOf(term: string): Script[] {
  const found = new Set<Script>();
  for (const ch of term) {
    if (!/\p{L}/u.test(ch)) continue;
    const hit = SCRIPT_TESTS.find(([, re]) => re.test(ch));
    if (hit) found.add(hit[0]);
  }
  return [...found];
}

export function languageMatches(term: string, country: string): boolean {
  const allowed = allowedScripts(country);
  return scriptsOf(term).every((s) => allowed.has(s));
}

export function scriptMismatch(term: string, country: string): string | null {
  const allowed = allowedScripts(country);
  const foreign = scriptsOf(term).filter((s) => !allowed.has(s));
  if (!foreign.length) return null;
  return foreign.includes("hangul") ? SCRIPT_NAME.hangul : foreign.includes("kana") ? SCRIPT_NAME.kana : SCRIPT_NAME[foreign[0]];
}
