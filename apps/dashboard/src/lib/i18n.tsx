"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import de from "@/messages/de";
import en from "@/messages/en";

export const locales = ["de", "en"] as const;
export type Locale = (typeof locales)[number];

const messages = { de, en } as const;
type TranslationKey =
  | "common.language"
  | "common.german"
  | "common.english"
  | "userMenu.settings"
  | "userMenu.security"
  | "userMenu.signOut"
  | "userMenu.signingOut"
  | "account.title"
  | "account.description"
  | "account.fullName"
  | "account.email"
  | "account.password"
  | "account.security"
  | "auth.login"
  | "auth.passkey"
  | "auth.companySso"
  | "auth.forgotPassword";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function translate(locale: Locale, key: TranslationKey) {
  const [section, property] = key.split(".");
  return (messages[locale] as Record<string, Record<string, string>>)[section][
    property
  ];
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("de");

  useEffect(() => {
    const savedLocale = window.localStorage.getItem("devion-locale");
    if (savedLocale && locales.includes(savedLocale as Locale))
      setLocaleState(savedLocale as Locale);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    window.localStorage.setItem("devion-locale", locale);
  }, [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale: setLocaleState,
      t: (key) => translate(locale, key),
    }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside I18nProvider");
  return context;
}
