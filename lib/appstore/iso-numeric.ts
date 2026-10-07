export const ISO_NUMERIC: Record<string, string> = {
  us: "840", gb: "826", ca: "124", au: "036", nz: "554", ie: "372", fr: "250", de: "276", it: "380",
  es: "724", pt: "620", nl: "528", be: "056", lu: "442", ch: "756", at: "040", se: "752", no: "578",
  dk: "208", fi: "246", pl: "616", cz: "203", sk: "703", hu: "348", ro: "642", bg: "100", gr: "300",
  hr: "191", si: "705", ee: "233", lv: "428", lt: "440", ua: "804", ru: "643", tr: "792", il: "376",
  sa: "682", ae: "784", qa: "634", kw: "414", eg: "818", za: "710", ng: "566", kz: "398", in: "356",
  pk: "586", jp: "392", kr: "410", cn: "156", hk: "344", tw: "158", sg: "702", my: "458", th: "764",
  id: "360", ph: "608", vn: "704", br: "076", mx: "484", ar: "032", cl: "152", co: "170", pe: "604",
  ec: "218", cr: "188", do: "214",
};

export const ALPHA2_BY_NUMERIC: Record<string, string> = Object.fromEntries(
  Object.entries(ISO_NUMERIC).map(([a, n]) => [n, a]),
);
