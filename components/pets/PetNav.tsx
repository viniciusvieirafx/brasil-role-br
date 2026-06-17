'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/pets',              label: '🏠',      title: 'Início',     exact: true },
  { href: '/pets/ovos',         label: '🥚',      title: 'Ovos' },
  { href: '/pets/colecao',      label: '📖',      title: 'Coleção' },
  { href: '/pets/capsula',      label: '🎰',      title: 'Cápsula' },
  { href: '/pets/minigames',    label: '🎮',      title: 'Games' },
  { href: '/pets/batalha',      label: '⚔️',      title: 'Batalha' },
]

export default function PetNav() {
  const pathname = usePathname()

  return (
    <nav className="flex items-center gap-1 bg-[#0A0718]/90 backdrop-blur border-b border-yellow-500/20 px-4 py-2 sticky top-0 z-50">
      <span className="text-yellow-400 font-bold text-sm mr-3 hidden sm:block">🐾 Bichinhos</span>
      <div className="flex gap-1">
        {TABS.map(tab => {
          const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              title={tab.title}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
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
