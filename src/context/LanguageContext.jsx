import { createContext, useContext, useState, useCallback, useMemo } from 'react'
import bn from '../locales/bn'
import en from '../locales/en'

const LANG_KEY = 'xts-lang'
const translations = { bn, en }

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    // 1. If user manually selected a language before, use that
    const saved = localStorage.getItem(LANG_KEY)
    if (saved && translations[saved]) return saved

    // 2. Detect browser language (but don't override manual selection)
    const browserLang = navigator?.language?.slice(0, 2)
    if (browserLang === 'bn') return 'bn'

    // 3. Default to Bangla
    return 'bn'
  })

  const switchLang = useCallback((newLang) => {
    if (translations[newLang]) {
      setLang(newLang)
      localStorage.setItem(LANG_KEY, newLang)
    }
  }, [])

  const t = useCallback(
    (key, replacements) => {
      let text = translations[lang]?.[key] || translations['en']?.[key] || key
      if (replacements) {
        Object.entries(replacements).forEach(([k, v]) => {
          text = text.replace(new RegExp(`__${k}__`, 'g'), v)
        })
      }
      return text
    },
    [lang]
  )

  const isBn = lang === 'bn'

  // Memoize the locale string for toLocaleDateString usage
  const dateLocale = useMemo(() => (lang === 'bn' ? 'bn-BD' : 'en-US'), [lang])

  const value = useMemo(
    () => ({ lang, switchLang, t, isBn, dateLocale }),
    [lang, switchLang, t, isBn, dateLocale]
  )

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used inside <LanguageProvider>')
  return ctx
}
