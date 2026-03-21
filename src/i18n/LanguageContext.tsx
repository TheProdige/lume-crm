import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import en, { TranslationKeys } from './en';
import fr from './fr';

export type Language = 'en' | 'fr';

const translations: Record<Language, TranslationKeys> = { en, fr };

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationKeys;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  setLanguage: () => {},
  t: en,
});

function getInitialLanguage(): Language {
  const stored = localStorage.getItem('lume-language');
  if (stored === 'fr' || stored === 'en') return stored;
  const browserLang = navigator.language || '';
  if (browserLang.startsWith('fr')) return 'fr';
  return 'en';
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('lume-language', lang);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo(
    () => ({ language, setLanguage, t: translations[language] }),
    [language, setLanguage]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  return useContext(LanguageContext);
}
