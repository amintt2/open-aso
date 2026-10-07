import { normalizeTerm } from "@/lib/aso/scoring";

const STOPWORDS = new Set(
  `a an and are as at be by for from has have in into is it its of on or that the this to was were will with your you our we my me i
  all any can do does how if more most no not now one only so than then there these they too up use very what when where which who why
  de la le les des du un une et en au aux pour par sur avec dans est ou ton ta tes vos votre nos notre mon ma mes
  el los las del al y o con sin por para su sus tu tus es un una unos unas mi mis que como
  der die das den dem des ein eine einen und oder mit für auf im in ist zu von bei aus dein deine ihr ihre mein meine
  il lo gli di da e per con su tra fra nel nella che uno
  o os as do da dos das em no na um uma com e para seu sua
  het een en van op te voor met je jouw is`.split(/\s+/),
);

const WEAK = new Set(
  `app apps application free pro plus lite premium hd new best top official edition version get now easy simple smart ultimate
  online offline ios iphone ipad mac android mobile 2023 2024 2025 2026 2027 inc ltd llc co gmbh`.split(/\s+/),
);

export function isStopword(word: string) {
  return STOPWORDS.has(word);
}

export function isWeak(word: string) {
  return WEAK.has(word) || STOPWORDS.has(word);
}

export function tokenize(text: string): string[] {
  return normalizeTerm(text)
    .replace(/[’`]/g, "'")
    .split(/[^\p{L}\p{N}']+/u)
    .map((w) => w.replace(/^'+|'+$/g, ""))
    .filter(Boolean);
}

export function segments(title: string): string[] {
  return title
    .split(/\s*[:|–—•·,]\s*|\s+-\s+/u)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function descriptiveSegments(title: string): string[] {
  const parts = segments(title);
  return parts.length > 1 ? parts.slice(1) : parts;
}

export function ngrams(words: string[], min = 1, max = 3): string[] {
  const out: string[] = [];
  for (let n = min; n <= max; n++) {
    for (let i = 0; i + n <= words.length; i++) out.push(words.slice(i, i + n).join(" "));
  }
  return out;
}

export function isCleanPhrase(phrase: string): boolean {
  const words = phrase.split(" ");
  if (!words.length || words.length > 4) return false;
  if (phrase.length < 3 || phrase.length > 40) return false;
  if (words.some((w) => /^\d+$/.test(w))) return false;
  if (isWeak(words[0]) || isWeak(words[words.length - 1])) return false;
  if (words.length === 1 && words[0].length < 3) return false;
  if (new Set(words).size !== words.length) return false;
  return true;
}

export function phrasesFrom(text: string, max = 3): string[] {
  return ngrams(tokenize(text), 1, max).filter(isCleanPhrase);
}
