'use client'
import { useState, useEffect, useRef } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import type { Lang } from '@/lib/i18n'

const langs: { code: Lang; flag: string; label: string }[] = [
  { code: 'pt', flag: '🇧🇷', label: 'PT' },
  { code: 'en', flag: '🇺🇸', label: 'EN' },
  { code: 'es', flag: '🇪🇸', label: 'ES' },
]

interface NavbarProps {
  latestVersion: string
}

export default function Navbar({ latestVersion }: NavbarProps) {
  const { t, lang, setLang } = useLanguage()
  const [open, setOpen] = useState(false)
  const [hasNew, setHasNew] = useState(false)
  const progressRef = useRef<HTMLDivElement>(null)
  const discordInvite = process.env.NEXT_PUBLIC_DISCORD_INVITE ?? '#'

  const links = [
    { href: '#inicio', label: t.nav.home, badge: false },
    { href: '#sobre', label: t.nav.about, badge: false },
    { href: '#equipe', label: t.nav.team, badge: false },
    { href: '#atualizacoes', label: t.nav.updates, badge: hasNew },
    { href: '#vip', label: t.nav.vip, badge: false },
    { href: '#contato', label: t.nav.contact, badge: false },
  ]

  useEffect(() => {
    const seen = localStorage.getItem('updates_seen_version')
    setHasNew(seen !== latestVersion)

    const onSeen = () => setHasNew(false)
    window.addEventListener('updates-seen', onSeen)
    return () => window.removeEventListener('updates-seen', onSeen)
  }, [latestVersion])

  const markSeen = () => {
    localStorage.setItem('updates_seen_version', latestVersion)
    setHasNew(false)
  }

  useEffect(() => {
    const update = () => {
      const scrolled = window.scrollY
      const total = document.documentElement.scrollHeight - window.innerHeight
      if (progressRef.current) {
        progressRef.current.style.transform = `scaleX(${total > 0 ? scrolled / total : 0})`
      }
    }
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-br-dark/90 backdrop-blur-md border-b border-white/5">
      {/* Scroll progress bar */}
      <div
        ref={progressRef}
        className="absolute bottom-0 left-0 h-[2px] w-full bg-gradient-to-r from-br-yellow via-br-green to-br-blue origin-left"
        style={{ transform: 'scaleX(0)' }}
      />

      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <a href="#inicio" className="text-xl font-bold tracking-wide group">
          <span className="text-br-yellow group-hover:text-glow-yellow transition-all duration-300">Brasil</span>{' '}
          <span className="text-br-green group-hover:text-glow-green transition-all duration-300">Role</span>{' '}
          <span className="text-white">BR</span>
        </a>

        <div className="hidden md:flex items-center gap-8">
          {links.map(l => (
            <a
              key={l.href}
              href={l.href}
              onClick={l.badge ? markSeen : undefined}
              className="relative text-gray-400 hover:text-br-yellow transition-colors text-sm font-medium group"
            >
              {l.label}
              {l.badge && (
                <span className="absolute -top-1 -right-2.5 w-2 h-2 bg-red-500 rounded-full">
                  <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-75" />
                </span>
              )}
              <span className="absolute -bottom-1 left-0 w-0 h-[2px] bg-br-yellow rounded-full transition-all duration-300 group-hover:w-full" />
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          {/* Language switcher */}
          <div className="flex items-center gap-1 bg-white/5 rounded-lg px-2 py-1 border border-white/10">
            {langs.map((l, i) => (
              <span key={l.code} className="flex items-center">
                <button
                  onClick={() => setLang(l.code)}
                  title={l.label}
                  className={`text-xs font-bold transition-all px-1.5 py-0.5 rounded ${
                    lang === l.code
                      ? 'text-br-yellow'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {l.flag} {l.label}
                </button>
                {i < langs.length - 1 && (
                  <span className="text-white/10 text-xs select-none">|</span>
                )}
              </span>
            ))}
          </div>

          <a
            href={discordInvite}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#5865F2] text-white font-bold px-5 py-2 rounded-lg hover:brightness-110 transition-all text-sm btn-shine"
          >
            <DiscordIcon />
            Discord
          </a>
        </div>

        <button className="md:hidden text-white text-2xl" onClick={() => setOpen(!open)}>
          {open ? '✕' : '☰'}
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-br-dark2 border-t border-white/5 px-6 py-4 space-y-3">
          {links.map(l => (
            <a
              key={l.href}
              href={l.href}
              className="flex items-center gap-2 text-gray-300 hover:text-br-yellow py-2 transition-colors"
              onClick={() => { setOpen(false); if (l.badge) markSeen() }}
            >
              {l.label}
              {l.badge && (
                <span className="w-2 h-2 bg-red-500 rounded-full shrink-0" />
              )}
            </a>
          ))}
          {/* Mobile language switcher */}
          <div className="flex gap-2 py-2">
            {langs.map(l => (
              <button
                key={l.code}
                onClick={() => { setLang(l.code); setOpen(false) }}
                className={`text-sm font-bold transition-all px-3 py-1.5 rounded-lg border ${
                  lang === l.code
                    ? 'text-br-yellow border-br-yellow/40 bg-br-yellow/10'
                    : 'text-gray-500 border-white/10 hover:text-gray-300'
                }`}
              >
                {l.flag} {l.label}
              </button>
            ))}
          </div>
          <a
            href={discordInvite}
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-[#5865F2] text-white font-bold px-6 py-3 rounded-lg text-center mt-2"
          >
            Discord
          </a>
        </div>
      )}
    </nav>
  )
}

function DiscordIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 127.14 96.36" fill="currentColor">
      <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
    </svg>
  )
}
