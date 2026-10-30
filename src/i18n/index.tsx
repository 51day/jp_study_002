import React, { createContext, useContext, useMemo } from 'react';
import { UILanguage } from '../types';
import { zhCN, TranslationType } from './locales/zh-CN';
import { zhTW } from './locales/zh-TW';
import { enUS } from './locales/en-US';
import { jaJP } from './locales/ja-JP';

export interface LanguageOption {
  code: UILanguage;
  name: string;
  nativeName: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'zh-CN', name: '简体中文', nativeName: '简体中文', flag: '🇨🇳' },
  { code: 'zh-TW', name: '繁體中文', nativeName: '繁體中文', flag: '🇭🇰' },
  { code: 'en-US', name: 'English', nativeName: 'English (US)', flag: '🇺🇸' },
  { code: 'ja-JP', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
];

const TRANSLATIONS: Record<UILanguage, TranslationType> = {
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  'en-US': enUS,
  'ja-JP': jaJP,
};

interface I18nContextType {
  uiLang: UILanguage;
  setUiLang: (lang: UILanguage) => void;
  t: (path: string, params?: Record<string, string | number>) => string;
  supportedLanguages: LanguageOption[];
}

const I18nContext = createContext<I18nContextType | null>(null);

export const I18nProvider: React.FC<{
  uiLang: UILanguage;
  onLanguageChange: (lang: UILanguage) => void;
  children: React.ReactNode;
}> = ({ uiLang, onLanguageChange, children }) => {
  const currentTranslation = TRANSLATIONS[uiLang] || zhCN;

  const t = useMemo(() => {
    return (path: string, params?: Record<string, string | number>): string => {
      const keys = path.split('.');
      let current: any = currentTranslation;
      for (const k of keys) {
        if (current && typeof current === 'object' && k in current) {
          current = current[k];
        } else {
          // Fallback to zh-CN
          let fallback: any = zhCN;
          for (const fk of keys) {
            if (fallback && typeof fallback === 'object' && fk in fallback) {
              fallback = fallback[fk];
            } else {
              fallback = path;
              break;
            }
          }
          current = fallback;
          break;
        }
      }

      if (typeof current !== 'string') {
        return path;
      }

      if (params) {
        let result = current;
        for (const [pk, pv] of Object.entries(params)) {
          result = result.replace(new RegExp(`\\{${pk}\\}`, 'g'), String(pv));
        }
        return result;
      }

      return current;
    };
  }, [currentTranslation]);

  return (
    <I18nContext.Provider
      value={{
        uiLang,
        setUiLang: onLanguageChange,
        t,
        supportedLanguages: SUPPORTED_LANGUAGES,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};
