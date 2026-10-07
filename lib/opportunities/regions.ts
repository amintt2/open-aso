import { COUNTRIES } from "@/lib/appstore/countries";

export type RegionId = "europe" | "americas" | "apac" | "mea";

export const REGIONS: { id: RegionId; label: string; countries: string[] }[] = [
  {
    id: "europe",
    label: "Europe",
    countries: ["gb", "ie", "fr", "de", "it", "es", "pt", "nl", "be", "lu", "ch", "at", "se", "no", "dk", "fi", "pl", "cz", "sk", "hu", "ro", "bg", "gr", "hr", "si", "ee", "lv", "lt", "ua", "ru", "tr"],
  },
  { id: "americas", label: "Americas", countries: ["us", "ca", "br", "mx", "ar", "cl", "co", "pe", "ec", "cr", "do"] },
  { id: "apac", label: "Asia-Pacific", countries: ["au", "nz", "jp", "kr", "cn", "hk", "tw", "sg", "my", "th", "id", "ph", "vn", "in", "pk", "kz"] },
  { id: "mea", label: "Middle East & Africa", countries: ["il", "sa", "ae", "qa", "kw", "eg", "za", "ng"] },
];

export const ALL_COUNTRY_CODES = COUNTRIES.map((c) => c.code);
