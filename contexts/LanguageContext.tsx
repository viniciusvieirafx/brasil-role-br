'use client'
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { translations, type Lang, type Translations } from '@/lib/i18n'

const STORAGE_KEY = 'brasil-role-lang'

const PT_BROWSER = /^pt/i
const ES_BROWSER = /^es/i

function browserLang(): Lang | null {
  if (typeof navigator === 'undefined') return null
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language]
  for (const l of langs) {
    if (PT_BROWSER.test(l)) return 'pt'
    if (ES_BROWSER.test(l)) return 'es'
  }
  return 'en'
}

type LanguageContextType = {
  lang: Lang
  setLang: (lang: Lang) => void
  t: Translations
}

const LanguageContext = createContext<LanguageContextType | null>(null)

export function LanguageProvider({
  children,
  serverLang,
}: {
  children: ReactNode
  serverLang: Lang
}) {
  const [lang, setLangState] = useState<Lang>(serverLang)

  useEffect(() => {
    // 1. Prefer saved manual choice
    const saved = localStorage.getItem(STORAGE_KEY) as Lang | null
    if (saved && (saved === 'pt' || saved === 'en' || saved === 'es')) {
      setLangState(saved)
      return
    }
    // 2. Fall back to browser language
    const detected = browserLang()
    if (detected) setLangState(detected)
    // serverLang already set as initial state, acts as last resort
  }, [])

  const setLang = (l: Lang) => {
    setLangState(l)
    localStorage.setItem(STORAGE_KEY, l)
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: translations[lang] }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}
