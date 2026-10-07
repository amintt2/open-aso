export type Country = {
  code: string;
  name: string;
  storefront: number;
  lang: string;
  flag: string;
  currency: string;
  indexedLocales: string[];
};

function flag(code: string) {
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

const RAW: [string, string, number, string, string, string[]][] = [
  ["us", "United States", 143441, "en_us", "USD", ["en-US", "es-MX", "ar-SA", "zh-Hans", "zh-Hant", "fr-FR", "ko", "pt-BR", "ru", "vi"]],
  ["gb", "United Kingdom", 143444, "en_gb", "GBP", ["en-GB", "en-US"]],
  ["ca", "Canada", 143455, "en_ca", "CAD", ["en-CA", "fr-CA", "en-US"]],
  ["au", "Australia", 143460, "en_au", "AUD", ["en-AU", "en-GB", "en-US"]],
  ["nz", "New Zealand", 143461, "en_nz", "NZD", ["en-AU", "en-GB", "en-US"]],
  ["ie", "Ireland", 143449, "en_gb", "EUR", ["en-GB", "en-US"]],
  ["fr", "France", 143442, "fr_fr", "EUR", ["fr-FR", "en-GB"]],
  ["de", "Germany", 143443, "de_de", "EUR", ["de-DE", "en-GB"]],
  ["it", "Italy", 143450, "it_it", "EUR", ["it", "en-GB"]],
  ["es", "Spain", 143454, "es_es", "EUR", ["es-ES", "ca", "en-GB"]],
  ["pt", "Portugal", 143453, "pt_pt", "EUR", ["pt-PT", "en-GB"]],
  ["nl", "Netherlands", 143452, "nl_nl", "EUR", ["nl-NL", "en-GB"]],
  ["be", "Belgium", 143446, "nl_nl", "EUR", ["nl-NL", "fr-FR", "en-GB"]],
  ["lu", "Luxembourg", 143451, "fr_fr", "EUR", ["fr-FR", "de-DE", "en-GB"]],
  ["ch", "Switzerland", 143459, "de_ch", "CHF", ["de-DE", "fr-FR", "it", "en-GB"]],
  ["at", "Austria", 143445, "de_de", "EUR", ["de-DE", "en-GB"]],
  ["se", "Sweden", 143456, "sv_se", "SEK", ["sv", "en-GB"]],
  ["no", "Norway", 143457, "nb_no", "NOK", ["no", "en-GB"]],
  ["dk", "Denmark", 143458, "da_dk", "DKK", ["da", "en-GB"]],
  ["fi", "Finland", 143447, "fi_fi", "EUR", ["fi", "sv", "en-GB"]],
  ["pl", "Poland", 143478, "pl_pl", "PLN", ["pl", "en-GB"]],
  ["cz", "Czechia", 143489, "cs_cz", "CZK", ["cs", "en-GB"]],
  ["sk", "Slovakia", 143496, "sk_sk", "EUR", ["sk", "en-GB"]],
  ["hu", "Hungary", 143482, "hu_hu", "HUF", ["hu", "en-GB"]],
  ["ro", "Romania", 143487, "ro_ro", "RON", ["ro", "en-GB"]],
  ["bg", "Bulgaria", 143526, "en_gb", "BGN", ["en-GB"]],
  ["gr", "Greece", 143448, "el_gr", "EUR", ["el", "en-GB"]],
  ["hr", "Croatia", 143494, "hr_hr", "EUR", ["hr", "en-GB"]],
  ["si", "Slovenia", 143499, "en_gb", "EUR", ["en-GB"]],
  ["ee", "Estonia", 143518, "en_gb", "EUR", ["en-GB"]],
  ["lv", "Latvia", 143519, "en_gb", "EUR", ["en-GB"]],
  ["lt", "Lithuania", 143520, "en_gb", "EUR", ["en-GB"]],
  ["ua", "Ukraine", 143492, "uk_ua", "UAH", ["uk", "ru", "en-GB"]],
  ["ru", "Russia", 143469, "ru_ru", "RUB", ["ru", "en-US"]],
  ["tr", "Türkiye", 143480, "tr_tr", "TRY", ["tr", "en-GB"]],
  ["il", "Israel", 143491, "he_il", "ILS", ["he", "en-GB"]],
  ["sa", "Saudi Arabia", 143479, "ar_sa", "SAR", ["ar-SA", "en-GB"]],
  ["ae", "United Arab Emirates", 143481, "ar_sa", "AED", ["ar-SA", "en-GB"]],
  ["qa", "Qatar", 143498, "ar_sa", "QAR", ["ar-SA", "en-GB"]],
  ["kw", "Kuwait", 143493, "ar_sa", "KWD", ["ar-SA", "en-GB"]],
  ["eg", "Egypt", 143516, "ar_sa", "EGP", ["ar-SA", "en-GB"]],
  ["za", "South Africa", 143472, "en_gb", "ZAR", ["en-GB"]],
  ["ng", "Nigeria", 143561, "en_gb", "NGN", ["en-GB"]],
  ["kz", "Kazakhstan", 143517, "ru_ru", "KZT", ["ru", "en-GB"]],
  ["in", "India", 143467, "en_gb", "INR", ["en-GB", "hi"]],
  ["pk", "Pakistan", 143477, "en_gb", "PKR", ["en-GB"]],
  ["jp", "Japan", 143462, "ja_jp", "JPY", ["ja", "en-US"]],
  ["kr", "South Korea", 143466, "ko_kr", "KRW", ["ko", "en-GB"]],
  ["cn", "China mainland", 143465, "zh_cn", "CNY", ["zh-Hans", "en-GB"]],
  ["hk", "Hong Kong", 143463, "zh_hk", "HKD", ["zh-Hant", "en-GB", "zh-Hans"]],
  ["tw", "Taiwan", 143470, "zh_tw", "TWD", ["zh-Hant", "en-GB"]],
  ["sg", "Singapore", 143464, "en_gb", "SGD", ["en-GB", "zh-Hans"]],
  ["my", "Malaysia", 143473, "en_gb", "MYR", ["ms", "en-GB", "zh-Hans"]],
  ["th", "Thailand", 143475, "th_th", "THB", ["th", "en-GB"]],
  ["id", "Indonesia", 143476, "id_id", "IDR", ["id", "en-GB"]],
  ["ph", "Philippines", 143474, "en_gb", "PHP", ["en-GB"]],
  ["vn", "Vietnam", 143471, "vi_vn", "VND", ["vi", "en-GB"]],
  ["br", "Brazil", 143503, "pt_br", "BRL", ["pt-BR", "en-GB"]],
  ["mx", "Mexico", 143468, "es_mx", "MXN", ["es-MX", "en-GB"]],
  ["ar", "Argentina", 143505, "es_mx", "USD", ["es-MX", "en-GB"]],
  ["cl", "Chile", 143483, "es_mx", "CLP", ["es-MX", "en-GB"]],
  ["co", "Colombia", 143501, "es_mx", "COP", ["es-MX", "en-GB"]],
  ["pe", "Peru", 143507, "es_mx", "PEN", ["es-MX", "en-GB"]],
  ["ec", "Ecuador", 143509, "es_mx", "USD", ["es-MX", "en-GB"]],
  ["cr", "Costa Rica", 143495, "es_mx", "USD", ["es-MX", "en-GB"]],
  ["do", "Dominican Republic", 143508, "es_mx", "USD", ["es-MX", "en-GB"]],
];

export const COUNTRIES: Country[] = RAW.map(
  ([code, name, storefront, lang, currency, indexedLocales]) => ({
    code,
    name,
    storefront,
    lang,
    currency,
    indexedLocales,
    flag: flag(code),
  }),
);

export const COUNTRY_BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

export function getCountry(code: string): Country {
  const country = COUNTRY_BY_CODE.get(code.toLowerCase());
  if (!country) throw new Error(`Unsupported country: ${code}`);
  return country;
}

export function isCountry(code: string) {
  return COUNTRY_BY_CODE.has(code.toLowerCase());
}
