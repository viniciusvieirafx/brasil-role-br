'use client'
import { useState, useEffect } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'

interface TopVip {
  discordId: string
  displayName: string
  tier: number
  expiresAt: string
  daysLeft: number
}

interface TopGifter {
  displayName: string
  points: number
}

const TIER_STYLE: Record<number, { name: string; emoji: string; color: string; border: string; bg: string }> = {
  1: { name: 'Bronze', emoji: '🥉', color: 'text-amber-500', border: 'border-amber-700/40', bg: 'bg-amber-900/20' },
  2: { name: 'Prata', emoji: '🥈', color: 'text-slate-300', border: 'border-slate-400/40', bg: 'bg-slate-800/20' },
  3: { name: 'Ouro', emoji: '🥇', color: 'text-yellow-400', border: 'border-yellow-500/40', bg: 'bg-yellow-900/20' },
}

export default function Contributors() {
  const { t } = useLanguage()
  const [topVips, setTopVips] = useState<TopVip[]>([])
  const [topGifters, setTopGifters] = useState<TopGifter[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/contributors')
      .then((r) => r.json())
      .then((data) => {
        setTopVips(data.topVips ?? [])
        setTopGifters(data.topGifters ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const hasData = topVips.length > 0 || topGifters.length > 0

  return (
    <section id="contribuidores" className="py-24 bg-br-dark relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-br-yellow/3 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-14 reveal">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="text-br-yellow">{t.contributors.titleA}</span>{' '}
            <span className="text-white">{t.contributors.titleB}</span>
          </h2>
          <p className="text-gray-400 text-lg">{t.contributors.subtitle}</p>
        </div>

        {loading ? (
          <div className="text-center text-gray-500 animate-pulse py-16">
            {t.contributors.loading}
          </div>
        ) : !hasData ? (
          <div className="text-center text-gray-500 py-16">
            {t.contributors.empty}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-8">
            {/* Top VIPs */}
            <div className="bg-br-purple/30 rounded-2xl border border-white/5 p-6">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-3xl">👑</span>
                <div>
                  <h3 className="text-xl font-bold text-white">{t.contributors.vipTitle}</h3>
                  <p className="text-gray-500 text-sm">{t.contributors.vipDesc}</p>
                </div>
              </div>

              {topVips.length === 0 ? (
                <p className="text-gray-600 text-sm text-center py-4">{t.contributors.noVips}</p>
              ) : (
                <div className="space-y-2">
                  {topVips.map((vip, i) => {
                    const style = TIER_STYLE[vip.tier] ?? TIER_STYLE[1]
                    const isTop3 = i < 3
                    return (
                      <div
                        key={vip.discordId}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${style.border} ${style.bg} ${
                          isTop3 ? 'hover:scale-[1.02]' : ''
                        }`}
                      >
                        <span className={`text-lg font-bold w-7 text-center ${isTop3 ? style.color : 'text-gray-600'}`}>
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className={`font-bold truncate ${isTop3 ? 'text-white' : 'text-gray-300'}`}>
                            {vip.displayName}
                          </p>
                          <p className={`text-xs ${style.color}`}>
                            {style.emoji} {style.name} — {vip.daysLeft} {t.contributors.daysLeft}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Top Gifters */}
            <div className="bg-br-purple/30 rounded-2xl border border-white/5 p-6">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-3xl">🎁</span>
                <div>
                  <h3 className="text-xl font-bold text-white">{t.contributors.gifterTitle}</h3>
                  <p className="text-gray-500 text-sm">{t.contributors.gifterDesc}</p>
                </div>
              </div>

              {topGifters.length === 0 ? (
                <p className="text-gray-600 text-sm text-center py-4">{t.contributors.noGifters}</p>
              ) : (
                <div className="space-y-2">
                  {topGifters.map((gifter, i) => {
                    const isTop3 = i < 3
                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : ''
                    return (
                      <div
                        key={gifter.displayName}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                          isTop3
                            ? 'border-br-yellow/30 bg-br-yellow/5 hover:scale-[1.02]'
                            : 'border-white/5 bg-white/[0.02]'
                        }`}
                      >
                        <span className={`text-lg font-bold w-7 text-center ${isTop3 ? 'text-br-yellow' : 'text-gray-600'}`}>
                          {medal || i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className={`font-bold truncate ${isTop3 ? 'text-white' : 'text-gray-300'}`}>
                            {gifter.displayName}
                          </p>
                        </div>
                        <span className={`text-sm font-bold ${isTop3 ? 'text-br-yellow' : 'text-gray-500'}`}>
                          {gifter.points} pts
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
