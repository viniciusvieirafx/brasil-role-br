'use client'
import { useState, useEffect } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'

interface TopVip {
  discordId: string
  displayName: string
  totalMonths: number
}

interface TopGifter {
  displayName: string
  points: number
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
                    const isTop3 = i < 3
                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : ''
                    return (
                      <div
                        key={vip.discordId}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                          isTop3
                            ? 'border-br-green/30 bg-br-green/5 hover:scale-[1.02]'
                            : 'border-white/5 bg-white/[0.02]'
                        }`}
                      >
                        <span className={`text-lg font-bold w-7 text-center ${isTop3 ? 'text-br-green' : 'text-gray-600'}`}>
                          {medal || i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className={`font-bold truncate ${isTop3 ? 'text-white' : 'text-gray-300'}`}>
                            {vip.displayName}
                          </p>
                        </div>
                        <span className={`text-sm font-bold ${isTop3 ? 'text-br-green' : 'text-gray-500'}`}>
                          {vip.totalMonths} {vip.totalMonths === 1 ? t.contributors.monthLabel : t.contributors.monthsLabel}
                        </span>
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
