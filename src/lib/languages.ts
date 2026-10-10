/** Languages a viewer can learn. Translations are always into Azerbaijani. */
export const LANGUAGES = [
  { id: "en", label: "English", native: "English", speech: "en-US" },
  { id: "sk", label: "Slovak", native: "Slovenčina", speech: "sk-SK" },
] as const;

export type LanguageId = (typeof LANGUAGES)[number]["id"];

export const DEFAULT_LANGUAGE: LanguageId = "en";

export function isLanguageId(value: unknown): value is LanguageId {
  return LANGUAGES.some((l) => l.id === value);
}

export function languageOf(id: LanguageId) {
  return LANGUAGES.find((l) => l.id === id) ?? LANGUAGES[0];
}
