import { COUNTRIES, COUNTRY_BY_CODE } from "@/lib/appstore/countries";

export const ALPHA3: Record<string, string> = {
  us: "USA", gb: "GBR", ca: "CAN", au: "AUS", nz: "NZL", ie: "IRL", fr: "FRA", de: "DEU", it: "ITA",
  es: "ESP", pt: "PRT", nl: "NLD", be: "BEL", lu: "LUX", ch: "CHE", at: "AUT", se: "SWE", no: "NOR",
  dk: "DNK", fi: "FIN", pl: "POL", cz: "CZE", sk: "SVK", hu: "HUN", ro: "ROU", bg: "BGR", gr: "GRC",
  hr: "HRV", si: "SVN", ee: "EST", lv: "LVA", lt: "LTU", ua: "UKR", ru: "RUS", tr: "TUR", il: "ISR",
  sa: "SAU", ae: "ARE", qa: "QAT", kw: "KWT", eg: "EGY", za: "ZAF", ng: "NGA", kz: "KAZ", in: "IND",
  pk: "PAK", jp: "JPN", kr: "KOR", cn: "CHN", hk: "HKG", tw: "TWN", sg: "SGP", my: "MYS", th: "THA",
  id: "IDN", ph: "PHL", vn: "VNM", br: "BRA", mx: "MEX", ar: "ARG", cl: "CHL", co: "COL", pe: "PER",
  ec: "ECU", cr: "CRI", do: "DOM",
};

export const ALPHA2_BY_ALPHA3: Record<string, string> = Object.fromEntries(Object.entries(ALPHA3).map(([a2, a3]) => [a3, a2]));

export const STOREFRONT_TERRITORIES = COUNTRIES.map((c) => ALPHA3[c.code]).filter(Boolean);

export function territoryInfo(territory: string) {
  const code = ALPHA2_BY_ALPHA3[territory];
  const country = code ? COUNTRY_BY_CODE.get(code) : undefined;
  return { territory, code: code ?? null, name: country?.name ?? territory, flag: country?.flag ?? "", currency: country?.currency ?? null };
}
