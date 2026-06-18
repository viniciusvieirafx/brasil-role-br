'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/pets',              label: '🏠', title: 'Início',   exact: true },
  { href: '/pets/ovos',         label: '🥚', title: 'Ovos' },
  { href: '/pets/colecao',      label: '📖', title: 'Coleção' },
  { href: '/pets/capsula',      label: '🎰', title: 'Cápsula' },
  { href: '/pets/minigames',    label: '🎮', title: 'Games' },
  { href: '/pets/batalha',      label: '⚔️', title: 'Batalha' },
]

export default function PetNav() {
  const pathname = usePathname()

  return (
    <nav className="flex items-center gap-2 bg-[#0A0718]/90 backdrop-blur border-b border-yellow-500/20 px-3 py-2 sticky top-0 z-50">
      {/* Voltar ao site */}
      <Link
        href="/"
        title="Voltar ao site"
        className="flex items-center gap-1 text-zinc-500 hover:text-zinc-200 transition-colors text-xs font-medium border border-zinc-700 hover:border-zinc-500 rounded-lg px-2 py-1.5 shrink-0"
      >
        <span>←</span>
        <span className="hidden sm:inline">Site</span>
      </Link>

      <span className="text-yellow-400 font-bold text-sm hidden sm:block shrink-0">🐾</span>

      <div className="flex gap-1 overflow-x-auto scrollbar-none">
        {TABS.map(tab => {
          const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              title={tab.title}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 shrink-0 ${
                active
                  ? 'bg-yellow-400 text-black'
                  : 'text-zinc-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <span>{tab.label}</span>
              <span className="hidden sm:inline">{tab.title}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
