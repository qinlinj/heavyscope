import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import zhCN from "./locales/zh-CN.json";

export const LANG_STORAGE_KEY = "heavyscope.lang";

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      "zh-CN": { translation: zhCN },
      en: { translation: en },
    },
    fallbackLng: "zh-CN",
    supportedLngs: ["zh-CN", "en"],
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: LANG_STORAGE_KEY,
      caches: ["localStorage"],
    },
  });

export default i18n;

export function persistLanguage(
  next: string,
  persistSetting?: (key: string, value: string) => void,
): void {
  void i18n.changeLanguage(next);
  localStorage.setItem(LANG_STORAGE_KEY, next);
  document.documentElement.lang = next;
  persistSetting?.("language", next);
}
