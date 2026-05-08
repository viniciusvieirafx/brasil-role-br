'use client'
import { useState, useEffect } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import type { Lang } from '@/lib/i18n'
import type { Update } from '@/lib/get-updates'

type ChangeType = 'new' | 'fix' | 'improve' | 'remove'
type Tag = 'mapa' | 'site' | 'vip' | 'discord'

const TAG_COLORS: Record<string, string> = {
  mapa: 'bg-br-green/20 text-br-green border-br-green/30',
  site: 'bg-br-blue/20 text-br-blue border-br-blue/30',
  vip: 'bg-br-yellow/20 text-br-yellow border-br-yellow/30',
  discord: 'bg-[#5865F2]/20 text-[#7289da] border-[#5865F2]/30',
}

const TYPE_CONFIG: Record<ChangeType, { label: Record<Lang, string>; dot: string; text: string }> = {
  new:     { label: { pt: 'Novo',     en: 'New',      es: 'Nuevo'   }, dot: 'bg-br-green', text: 'text-br-green' },
  fix:     { label: { pt: 'Fix',      en: 'Fix',      es: 'Fix'     }, dot: 'bg-red-400',  text: 'text-red-400'  },
  improve: { label: { pt: 'Melhoria', en: 'Improved', es: 'Mejora'  }, dot: 'bg-br-yellow',text: 'text-br-yellow'},
  remove:  { label: { pt: 'Removido', en: 'Removed',  es: 'Eliminado'}, dot: 'bg-gray-500',text: 'text-gray-500' },
}

function formatDate(dateStr: string, lang: Lang) {
  const date = new Date(dateStr + 'T12:00:00')
  const localeMap: Record<Lang, string> = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' }
  return date.toLocaleDateString(localeMap[lang], { day: '2-digit', month: 'long', year: 'numeric' })
}

const ALL_TAGS: Tag[] = ['mapa', 'site', 'vip', 'discord']

interface PatchNotesProps {
  updates: Update[]
  latestVersion: string
}

export default function PatchNotes({ updates, latestVersion }: PatchNotesProps) {
  const { t, lang } = useLanguage()
  const [activeTag, setActiveTag] = useState<Tag | null>(null)
  const [expanded, setExpanded] = useState<string | null>(updates[0]?.version ?? null)

  // Mark updates as seen when this section is visited
  useEffect(() => {
    const seen = () => {
      if (document.getElementById('atualizacoes')) {
        localStorage.setItem('updates_seen_version', latestVersion)
        window.dispatchEvent(new Event('updates-seen'))
      }
    }
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) seen() },
      { threshold: 0.2 }
    )
    const el = document.getElementById('atualizacoes')
    if (el) observer.observe(el)
    return () => observer.disconnect()
  }, [latestVersion])

  const filtered = activeTag
    ? updates.filter(u => u.tags.includes(activeTag))
    : updates

  const tagLabel: Record<string, string> = {
    mapa: lang === 'en' ? 'Map' : 'Mapa',
    site: 'Site',
    vip: 'VIP',
    discord: 'Discord',
  }

  return (
    <section id="atualizacoes" className="py-24 bg-br-dark2 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-br-green/3 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-br-yellow/3 rounded-full blur-3xl" />
      </div>

      <div className="max-w-4xl mx-auto px-6 relative">
        {/* Header */}
        <div className="text-center mb-12 reveal">
          <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
            <span className="text-white">{t.updates.titleA} </span>
            <span className="text-br-yellow">{t.updates.titleB}</span>
          </h2>
          <p className="text-gray-400 text-lg">{t.updates.subtitle}</p>
        </div>

        {/* Tag filters */}
        <div className="flex flex-wrap gap-2 justify-center mb-10">
          <button
            onClick={() => setActiveTag(null)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${
              activeTag === null
                ? 'bg-white/10 text-white border-white/20'
                : 'text-gray-500 border-white/10 hover:text-gray-300'
            }`}
          >
            {t.updates.filterAll}
          </button>
          {ALL_TAGS.map(tag => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${
                activeTag === tag
                  ? (TAG_COLORS[tag] ?? 'bg-white/10 text-white border-white/20')
                  : 'text-gray-500 border-white/10 hover:text-gray-300'
              }`}
            >
              {tagLabel[tag] ?? tag}
            </button>
          ))}
        </div>

        {/* Timeline */}
        <div className="relative">
          <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-br-yellow/40 via-br-green/20 to-transparent hidden sm:block" />

          <div className="space-y-4">
            {filtered.map((update, i) => {
              const isOpen = expanded === update.version
              const isLatest = i === 0 && !activeTag

              return (
                <div key={update.version} className="sm:pl-16 relative">
                  <div className="absolute left-4 top-6 w-4 h-4 rounded-full border-2 border-br-yellow bg-br-dark2 hidden sm:block z-10">
                    {isLatest && (
                      <span className="absolute inset-0 rounded-full bg-br-yellow/40 animate-ping" />
                    )}
                  </div>

                  <div
                    className={`bg-white/[0.03] border rounded-xl overflow-hidden transition-all duration-300 ${
                      isOpen ? 'border-br-yellow/30' : 'border-white/5 hover:border-white/10'
                    }`}
                  >
                    <button
                      onClick={() => setExpanded(isOpen ? null : update.version)}
                      className="w-full flex items-center justify-between px-5 py-4 text-left"
                    >
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-mono font-bold text-br-yellow text-sm">
                          v{update.version}
                        </span>
                        {isLatest && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-br-green/20 text-br-green border border-br-green/30 uppercase tracking-wider">
                            {t.updates.latest}
                          </span>
                        )}
                        {update.tags.map(tag => (
                          <span
                            key={tag}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${TAG_COLORS[tag] ?? 'bg-white/10 text-white border-white/20'}`}
                          >
                            {tagLabel[tag] ?? tag}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-2">
                        <span className="text-gray-500 text-xs hidden sm:block">
                          {formatDate(update.date, lang)}
                        </span>
                        <span className={`text-gray-400 text-xs transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
                          ▾
                        </span>
                      </div>
                    </button>

                    <div className="px-5 -mt-2 pb-1 sm:hidden">
                      <span className="text-gray-500 text-xs">{formatDate(update.date, lang)}</span>
                    </div>

                    {isOpen && (
                      <div className="px-5 pb-5 border-t border-white/5 pt-4 space-y-2">
                        {(update.changes[lang] ?? update.changes['pt'])?.map((change, j) => {
                          const cfg = TYPE_CONFIG[change.type as ChangeType] ?? TYPE_CONFIG.new
                          return (
                            <div key={j} className="flex items-start gap-3 text-sm">
                              <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                              <span className={`font-bold shrink-0 text-[11px] mt-0.5 ${cfg.text}`}>
                                [{cfg.label[lang]}]
                              </span>
                              <span className="text-gray-300">{change.text}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {filtered.length === 0 && (
          <p className="text-center text-gray-500 py-12">{t.updates.empty}</p>
        )}
      </div>
    </section>
  )
}
