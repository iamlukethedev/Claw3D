"use client";

/**
 * Translation system for Claw3D Traditional Chinese UI.
 * Simple React context + hook + <T> component approach.
 */

import React, { createContext, useCallback, useContext, useState } from "react";
import { zhTW } from "./zh-TW";

type Locale = "en" | "zh-TW";

type TranslationContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, fallback?: string) => string;
};

const TranslationContext = createContext<TranslationContextValue | null>(null);

export const TranslationProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [locale, setLocale] = useState<Locale>("zh-TW");

  const t = useCallback(
    (key: string, fallback?: string): string => {
      if (locale === "zh-TW") {
        return zhTW[key] ?? fallback ?? key;
      }
      return fallback ?? key;
    },
    [locale],
  );

  return (
    <TranslationContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </TranslationContext.Provider>
  );
};

export const useTranslation = (): TranslationContextValue => {
  const ctx = useContext(TranslationContext);
  if (!ctx) {
    throw new Error(
      "useTranslation must be used within a TranslationProvider",
    );
  }
  return ctx;
};

/**
 * Inline translation component.
 * Usage: <T id="gateway.connect" fallback="Connect" />
 */
export const T = ({
  id,
  fallback,
}: {
  id: string;
  fallback?: string;
}): React.ReactNode => {
  const { t } = useTranslation();
  return <>{t(id, fallback)}</>;
};
