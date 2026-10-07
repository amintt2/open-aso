export type AscLocale = { code: string; name: string };

export const ASC_LOCALES: AscLocale[] = [
  { code: "ar-SA", name: "Arabic" },
  { code: "bn-BD", name: "Bangla" },
  { code: "ca", name: "Catalan" },
  { code: "zh-Hans", name: "Chinese (Simplified)" },
  { code: "zh-Hant", name: "Chinese (Traditional)" },
  { code: "hr", name: "Croatian" },
  { code: "cs", name: "Czech" },
  { code: "da", name: "Danish" },
  { code: "nl-NL", name: "Dutch" },
  { code: "en-AU", name: "English (Australia)" },
  { code: "en-CA", name: "English (Canada)" },
  { code: "en-GB", name: "English (U.K.)" },
  { code: "en-US", name: "English (U.S.)" },
  { code: "fi", name: "Finnish" },
  { code: "fr-FR", name: "French" },
  { code: "fr-CA", name: "French (Canada)" },
  { code: "de-DE", name: "German" },
  { code: "el", name: "Greek" },
  { code: "gu-IN", name: "Gujarati" },
  { code: "he", name: "Hebrew" },
  { code: "hi", name: "Hindi" },
  { code: "hu", name: "Hungarian" },
  { code: "id", name: "Indonesian" },
  { code: "it", name: "Italian" },
  { code: "ja", name: "Japanese" },
  { code: "kn-IN", name: "Kannada" },
  { code: "ko", name: "Korean" },
  { code: "ms", name: "Malay" },
  { code: "ml-IN", name: "Malayalam" },
  { code: "mr-IN", name: "Marathi" },
  { code: "no", name: "Norwegian" },
  { code: "or-IN", name: "Odia" },
  { code: "pl", name: "Polish" },
  { code: "pt-BR", name: "Portuguese (Brazil)" },
  { code: "pt-PT", name: "Portuguese (Portugal)" },
  { code: "pa-IN", name: "Punjabi" },
  { code: "ro", name: "Romanian" },
  { code: "ru", name: "Russian" },
  { code: "sk", name: "Slovak" },
  { code: "sl-SI", name: "Slovenian" },
  { code: "es-MX", name: "Spanish (Mexico)" },
  { code: "es-ES", name: "Spanish (Spain)" },
  { code: "sv", name: "Swedish" },
  { code: "ta-IN", name: "Tamil" },
  { code: "te-IN", name: "Telugu" },
  { code: "th", name: "Thai" },
  { code: "tr", name: "Turkish" },
  { code: "uk", name: "Ukrainian" },
  { code: "ur-PK", name: "Urdu" },
  { code: "vi", name: "Vietnamese" },
];

const BY_CODE = new Map(ASC_LOCALES.map((l) => [l.code.toLowerCase(), l]));

export function localeName(code: string) {
  return BY_CODE.get(code.toLowerCase())?.name ?? code;
}

export function sameLocale(a: string, b: string) {
  return a.toLowerCase() === b.toLowerCase();
}
