const STOPWORDS_RAW = `
a about above after again against all also am an and any app apps are as at be because been before being below between both but by can could did do does doing down during each even ever every few for from further get gets got had has have having he her here hers him his how i if in into is it its itself just let like make makes more most much must my new no nor not now of off on once one only or other our ours out over own per same she should so some such than that the their them then there these they this those through to too under until up us use used using very via was we were what when where which while who whom why will with would you your yours yourself easy simple great way ways day days time need want lot lots well really thing things into onto ios iphone ipad apple version update updates please see look keep go goes going come take give know show try yes ok okay im ive dont cant wont didnt doesnt isnt
le la les un une des du de et en au aux pour par sur avec dans est sont pas plus ou que qui ce cette ces son sa ses vos votre nos notre mon ma mes ton ta tes il elle ils elles nous vous je tu on se ne
der die das den dem des ein eine einen einem einer und oder mit für auf aus bei von zu zum zur im in ist sind nicht auch als wie mehr ihr ihre dein deine sie wir ich du es
el la los las un una unos unas y o de del en con por para que es son su sus tu tus mi mis al lo se más como
il lo la i gli le un uno una e o di da del della dei delle in con per su che è sono non più come tuo tua
o a os as um uma e ou de do da dos das em no na nos nas com por para que é são seu sua mais como
het een en of van voor met op in is zijn niet ook als je jouw
`;

export const STOPWORDS = new Set(STOPWORDS_RAW.split(/\s+/).filter(Boolean));

const SPLIT = new RegExp("[^\\p{L}\\p{N}'’]+", "u");
const CJK = new RegExp("[\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Hangul}\\p{Script=Thai}]", "u");

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKC")
    .split(SPLIT)
    .map((w) => w.replace(/^['’]+|['’]+$/g, "").replace(/['’]s$/, ""))
    .filter(Boolean);
}

export function isMeaningful(word: string) {
  if (STOPWORDS.has(word) || /['’]/.test(word)) return false;
  if (/^\d+$/.test(word)) return false;
  if (CJK.test(word)) return word.length >= 2;
  return word.length >= 3;
}

export function ngrams(text: string, maxN = 3): string[] {
  const segments = text.split(/[.!?;:\n•|–—()[\]{}"“”]+/);
  const out: string[] = [];
  for (const segment of segments) {
    const words = tokenize(segment);
    for (let n = 1; n <= maxN; n++) {
      for (let i = 0; i + n <= words.length; i++) {
        const gram = words.slice(i, i + n);
        if (!isMeaningful(gram[0]) || !isMeaningful(gram[gram.length - 1])) continue;
        if (n > 1 && gram.every((w) => STOPWORDS.has(w))) continue;
        out.push(gram.join(" "));
      }
    }
  }
  return out;
}

export function countGrams(texts: string[], maxN = 3) {
  const counts = new Map<string, number>();
  for (const text of texts) {
    for (const gram of new Set(ngrams(text, maxN))) counts.set(gram, (counts.get(gram) ?? 0) + 1);
  }
  return counts;
}

export function mainTitleTerm(title: string) {
  const head = title.split(/[:\-–—|·,]/)[0] ?? title;
  const words = tokenize(head).filter(isMeaningful);
  return words[0] ?? tokenize(title).filter(isMeaningful)[0] ?? title.toLowerCase();
}

export function parseAppQuery(input: string): { trackId: number } | { term: string } | null {
  const value = input.trim();
  if (!value) return null;
  const fromUrl = value.match(/apps\.apple\.com\/.*?id(\d{6,})/i) ?? value.match(/[?&/]id(\d{6,})/i);
  if (fromUrl) return { trackId: Number(fromUrl[1]) };
  if (/^(id)?\d{6,}$/i.test(value)) return { trackId: Number(value.replace(/^id/i, "")) };
  return { term: value };
}
