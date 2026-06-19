'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  loadData, saveData, getClicker, saveClicker,
  type PetPlayerData,
} from '@/lib/petStore'
import {
  UPGRADES, computeStats, upgradeCost, upgradeEffectText, formatMoedas,
  BUY_RATE, SELL_RATE,
  type UpgradeDef,
} from '@/lib/clickerData'
import { playClick, getClickerMuted, setClickerMuted } from '@/lib/sounds'

interface DiscordUser { id: string; username: string; avatar: string | null; globalName: string | null }

interface FloatNum {
  id: number
  text: string
  x: number
  y: number
  isCrit: boolean
}

let floatCounter = 0

export default function ClickerGame({ initialUser }: { initialUser: DiscordUser | null }) {
  // Refs for hot-path values
  const moedasRef        = useRef(0)
  const upgradesRef      = useRef<Record<string, number>>({})
  const totalEarnedRef   = useRef(0)
  const lastTickRef      = useRef(Date.now())
  const furyCountRef     = useRef(0)
  const isFuryNextRef    = useRef(false)
  const autoClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSaveRef      = useRef(Date.now())

  // Display state
  const [moedas, setMoedas]           = useState(0)
  const [upgrades, setUpgrades]       = useState<Record<string, number>>({})
  const [userData, setUserData]       = useState<PetPlayerData | null>(null)
  const [floatNums, setFloatNums]     = useState<FloatNum[]>([])
  const [isFuryNext, setIsFuryNext]   = useState(false)
  const [offlineGain, setOfflineGain] = useState<number | null>(null)
  const [muted, setMuted]             = useState(false)

  useEffect(() => { setMuted(getClickerMuted()) }, [])

  // Load data on mount
  useEffect(() => {
    if (!initialUser) return
    const data = loadData(initialUser.id)
    const clicker = getClicker(data)

    moedasRef.current      = clicker.moedas
    upgradesRef.current    = clicker.upgrades
    totalEarnedRef.current = clicker.totalMoedasEarned
    lastTickRef.current    = Date.now()

    // Offline gains
    const stats = computeStats(clicker.upgrades)
    const offlineSecs = Math.min((Date.now() - clicker.lastTickAt) / 1000, 4 * 3600)
    if (stats.mps > 0 && offlineSecs > 60) {
      const gain = stats.mps * stats.multiplier * offlineSecs
      moedasRef.current      += gain
      totalEarnedRef.current += gain
      setOfflineGain(Math.floor(gain))
    }

    setMoedas(Math.floor(moedasRef.current))
    setUpgrades({ ...clicker.upgrades })
    setUserData(data)
  }, [initialUser])

  // Passive tick — every 100ms
  useEffect(() => {
    const id = setInterval(() => {
      const stats = computeStats(upgradesRef.current)
      if (stats.mps <= 0) return
      const now = Date.now()
      const deltaSecs = (now - lastTickRef.current) / 1000
      lastTickRef.current = now
      const gain = stats.mps * stats.multiplier * deltaSecs
      moedasRef.current      += gain
      totalEarnedRef.current += gain
      setMoedas(Math.floor(moedasRef.current))
    }, 100)
    return () => clearInterval(id)
  }, [])

  // Auto-save every 5 seconds
  useEffect(() => {
    const id = setInterval(() => {
      saveNow()
    }, 5000)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-click management
  const startAutoClick = useCallback(() => {
    if (autoClickTimerRef.current) clearTimeout(autoClickTimerRef.current)
    const stats = computeStats(upgradesRef.current)
    if (!stats.autoClickMs) return
    function tick() {
      performClick(true)
      const s = computeStats(upgradesRef.current)
      if (s.autoClickMs) {
        autoClickTimerRef.current = setTimeout(tick, s.autoClickMs)
      }
    }
    autoClickTimerRef.current = setTimeout(tick, stats.autoClickMs)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (autoClickTimerRef.current) clearTimeout(autoClickTimerRef.current)
    }
  }, [])

  function saveNow() {
    setUserData(prev => {
      if (!prev) return prev
      const clicker = {
        moedas: moedasRef.current,
        totalMoedasEarned: totalEarnedRef.current,
        upgrades: upgradesRef.current,
        lastTickAt: Date.now(),
      }
      const updated = saveClicker(prev, clicker)
      saveData(updated)
      return updated
    })
    lastSaveRef.current = Date.now()
  }

  function performClick(isAuto = false) {
    const stats = computeStats(upgradesRef.current)
    let gain = stats.mpc * stats.multiplier
    let isCrit = false

    // Crit check
    if (stats.critChance > 0 && Math.random() < stats.critChance) {
      gain *= 3
      isCrit = true
    }

    // Fury check
    if (stats.furyEvery !== null) {
      furyCountRef.current += 1
      if (furyCountRef.current >= stats.furyEvery) {
        gain *= 5
        furyCountRef.current = 0
        isFuryNextRef.current = false
        setIsFuryNext(false)
      } else if (furyCountRef.current === stats.furyEvery - 1) {
        isFuryNextRef.current = true
        setIsFuryNext(true)
      }
    }

    moedasRef.current      += gain
    totalEarnedRef.current += gain
    setMoedas(Math.floor(moedasRef.current))

    // Float number (only for manual clicks to avoid spamming)
    if (!isAuto) {
      const id = ++floatCounter
      const x = 40 + Math.random() * 20
      const y = 40 + Math.random() * 20
      setFloatNums(prev => [...prev, { id, text: `+${formatMoedas(gain)}`, x, y, isCrit }])
      setTimeout(() => {
        setFloatNums(prev => prev.filter(f => f.id !== id))
      }, 1000)
    }
  }

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (!userData) return
    playClick()
    const rect = e.currentTarget.getBoundingClientRect()
    const stats = computeStats(upgradesRef.current)
    let gain = stats.mpc * stats.multiplier
    let isCrit = false

    if (stats.critChance > 0 && Math.random() < stats.critChance) {
      gain *= 3
      isCrit = true
    }

    if (stats.furyEvery !== null) {
      furyCountRef.current += 1
      if (furyCountRef.current >= stats.furyEvery) {
        gain *= 5
        furyCountRef.current = 0
        isFuryNextRef.current = false
        setIsFuryNext(false)
      } else if (furyCountRef.current === stats.furyEvery - 1) {
        isFuryNextRef.current = true
        setIsFuryNext(true)
      }
    }

    moedasRef.current      += gain
    totalEarnedRef.current += gain
    setMoedas(Math.floor(moedasRef.current))

    const id = ++floatCounter
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setFloatNums(prev => [...prev, { id, text: `+${formatMoedas(gain)}`, x, y, isCrit }])
    setTimeout(() => {
      setFloatNums(prev => prev.filter(f => f.id !== id))
    }, 1000)
  }

  function handleBuyUpgrade(upgrade: UpgradeDef) {
    const currentLevel = upgradesRef.current[upgrade.id] ?? 0
    const cost = upgradeCost(upgrade, currentLevel)
    if (cost === Infinity || moedasRef.current < cost) return
    playClick()
    moedasRef.current -= cost
    upgradesRef.current = { ...upgradesRef.current, [upgrade.id]: currentLevel + 1 }
    setMoedas(Math.floor(moedasRef.current))
    setUpgrades({ ...upgradesRef.current })

    // Restart auto-click if interval changed
    if (upgrade.type === 'auto_click') {
      if (autoClickTimerRef.current) clearTimeout(autoClickTimerRef.current)
      startAutoClick()
    }

    saveNow()
  }

  function buyMoedas() {
    if (!userData) return
    if (userData.points < BUY_RATE.pts) return
    playClick()
    const updated = { ...userData, points: userData.points - BUY_RATE.pts }
    moedasRef.current      += BUY_RATE.moedas
    totalEarnedRef.current += BUY_RATE.moedas
    setMoedas(Math.floor(moedasRef.current))
    const withClicker = saveClicker(updated, {
      moedas: moedasRef.current,
      totalMoedasEarned: totalEarnedRef.current,
      upgrades: upgradesRef.current,
      lastTickAt: Date.now(),
    })
    saveData(withClicker)
    setUserData(withClicker)
  }

  function sellMoedas() {
    if (!userData) return
    if (moedasRef.current < SELL_RATE.moedas) return
    playClick()
    moedasRef.current -= SELL_RATE.moedas
    setMoedas(Math.floor(moedasRef.current))
    const updated = {
      ...userData,
      points: userData.points + SELL_RATE.pts,
      totalPoints: userData.totalPoints + SELL_RATE.pts,
    }
    const withClicker = saveClicker(updated, {
      moedas: moedasRef.current,
      totalMoedasEarned: totalEarnedRef.current,
      upgrades: upgradesRef.current,
      lastTickAt: Date.now(),
    })
    saveData(withClicker)
    setUserData(withClicker)
  }

  // Start auto-click after upgrades load
  useEffect(() => {
    if (!userData) return
    const stats = computeStats(upgradesRef.current)
    if (stats.autoClickMs) startAutoClick()
  }, [userData, startAutoClick])

  if (!initialUser) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <p className="text-zinc-400">Faça login para jogar a Fábrica de Moedas.</p>
      </div>
    )
  }
  if (!userData) {
    return <div className="flex items-center justify-center min-h-[80vh] text-zinc-400">Carregando...</div>
  }

  const stats = computeStats(upgrades)
  const furyUpg = upgrades['fury'] ?? 0
  const furyEvery = stats.furyEvery
  const furyCount = furyCountRef.current
  const canBuyMoedas  = userData.points >= BUY_RATE.pts
  const canSellMoedas = moedas >= SELL_RATE.moedas

  // Group upgrades
  const clickUpgrades    = UPGRADES.filter(u => u.type === 'click' || u.type === 'click_modifier' || u.type === 'fury' || u.type === 'auto_click')
  const passiveUpgrades  = UPGRADES.filter(u => u.type === 'passive')
  const globalUpgrades   = UPGRADES.filter(u => u.type === 'multiplier')

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <style>{`
        @keyframes floatUp {
          0%   { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-80px) scale(0.7); }
        }
        .float-num { animation: floatUp 1s ease-out forwards; }
      `}</style>

      {/* Offline banner */}
      {offlineGain !== null && (
        <div className="flex items-center justify-between bg-blue-900/30 border border-blue-500/40 rounded-xl px-4 py-3">
          <p className="text-blue-300 text-sm">
            Bem-vindo de volta! Você ganhou <span className="font-bold text-yellow-400">{formatMoedas(offlineGain)} moedas</span> offline.
          </p>
          <button onClick={() => setOfflineGain(null)} className="text-zinc-400 hover:text-white text-sm ml-3">×</button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/pets" className="text-zinc-400 hover:text-white transition-colors text-sm">
          ← Voltar
        </Link>
        <h1 className="text-xl font-bold text-white flex-1">🪙 Fábrica de Moedas</h1>
        <button
          onClick={() => { const v = !muted; setMuted(v); setClickerMuted(v) }}
          title={muted ? 'Ativar som' : 'Silenciar clicker'}
          className="text-xl text-zinc-400 hover:text-zinc-200 transition-colors"
        >{muted ? '🔇' : '🔊'}</button>
        <div className="flex items-center gap-2 bg-yellow-400/10 border border-yellow-400/30 rounded-xl px-3 py-1.5">
          <span className="text-yellow-400 font-bold">{userData.points}</span>
          <span className="text-zinc-400 text-xs">pts</span>
        </div>
      </div>

      {/* Main counter */}
      <div className="bg-zinc-800/60 border border-zinc-700 rounded-2xl p-5 text-center">
        <p className="text-5xl font-black text-yellow-400 tabular-nums">{formatMoedas(moedas)}</p>
        <p className="text-zinc-300 text-sm font-medium mt-1">moedas</p>
        <div className="flex items-center justify-center gap-6 mt-3 text-xs text-zinc-400">
          <span>{formatMoedas(stats.mps * stats.multiplier)}/s</span>
          <span>{formatMoedas(stats.mpc * stats.multiplier)} por clique</span>
        </div>
      </div>

      {/* Click button */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <button
            onClick={handleClick}
            className={`relative w-40 h-40 rounded-full bg-yellow-400 hover:bg-yellow-300 active:scale-95 transition-all shadow-lg select-none text-6xl overflow-hidden
              ${isFuryNext ? 'ring-4 ring-orange-500 ring-offset-2 ring-offset-black shadow-orange-500/50 shadow-2xl' : 'shadow-yellow-400/30'}`}
          >
            🪙
            {floatNums.map(f => (
              <span
                key={f.id}
                className={`float-num pointer-events-none absolute text-sm font-black whitespace-nowrap ${f.isCrit ? 'text-red-400' : 'text-white'}`}
                style={{ left: f.x, top: f.y, transform: 'translate(-50%, -50%)' }}
              >
                {f.text}{f.isCrit ? ' CRIT!' : ''}
              </span>
            ))}
          </button>
        </div>
        {isFuryNext && (
          <p className="text-orange-400 text-xs font-bold animate-pulse">🔥 PRÓXIMO CLIQUE É FÚRIA!</p>
        )}
      </div>

      {/* Fury progress */}
      {furyUpg > 0 && furyEvery !== null && (
        <div>
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
            <span>🔥 Fúria ({furyCount}/{furyEvery})</span>
            <span className={isFuryNext ? 'text-orange-400 font-bold' : ''}>
              {isFuryNext ? 'Pronto!' : `${furyEvery - furyCount} cliques`}
            </span>
          </div>
          <div className="h-2 bg-zinc-700/60 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${isFuryNext ? 'bg-orange-500' : 'bg-red-500'}`}
              style={{ width: `${Math.min(100, (furyCount / furyEvery) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Exchange */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-zinc-800/60 border border-zinc-700 rounded-xl p-4 space-y-2">
          <p className="text-xs font-bold text-zinc-300">Converter Pontos → 🪙</p>
          <p className="text-zinc-500 text-xs">{BUY_RATE.pts} pts = {formatMoedas(BUY_RATE.moedas)} moedas</p>
          <button
            onClick={buyMoedas}
            disabled={!canBuyMoedas}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-all"
          >
            {BUY_RATE.pts} pts → +{formatMoedas(BUY_RATE.moedas)}
          </button>
        </div>
        <div className="bg-zinc-800/60 border border-zinc-700 rounded-xl p-4 space-y-2">
          <p className="text-xs font-bold text-zinc-300">Converter 🪙 → Pontos</p>
          <p className="text-zinc-500 text-xs">{formatMoedas(SELL_RATE.moedas)} moedas = {SELL_RATE.pts} pts</p>
          <button
            onClick={sellMoedas}
            disabled={!canSellMoedas}
            className="w-full py-2 bg-green-700 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-all"
          >
            {formatMoedas(SELL_RATE.moedas)} → +{SELL_RATE.pts} pts
          </button>
        </div>
      </div>

      {/* Upgrades */}
      <div className="space-y-3">
        <h2 className="text-zinc-300 text-sm font-bold uppercase tracking-wider">Melhorias</h2>

        {[
          { title: 'Clique', items: clickUpgrades },
          { title: 'Produção Passiva', items: passiveUpgrades },
          { title: 'Multiplicador', items: globalUpgrades },
        ].map(group => (
          <div key={group.title}>
            <p className="text-zinc-500 text-xs uppercase tracking-wider mb-2">{group.title}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {group.items.map(upg => {
                const lvl  = upgrades[upg.id] ?? 0
                const cost = upgradeCost(upg, lvl)
                const isMax = lvl >= upg.maxLevel
                const canAfford = !isMax && moedas >= cost

                // Show next-level effect (or current if maxed)
                const effectText = upgradeEffectText(upg, isMax ? lvl : lvl + 1)

                return (
                  <div key={upg.id} className={`bg-zinc-800/60 border rounded-xl p-3 flex items-center gap-3
                    ${isMax ? 'border-yellow-500/40' : canAfford ? 'border-zinc-600 hover:border-zinc-500' : 'border-zinc-700/60'}`}>
                    <span className="text-2xl shrink-0">{upg.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-white text-xs font-bold">{upg.name}</p>
                        {isMax ? (
                          <span className="text-[10px] bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 px-1.5 py-0.5 rounded-full font-bold">MAX</span>
                        ) : (
                          <span className="text-[10px] bg-zinc-700 text-zinc-400 px-1.5 py-0.5 rounded-full">Nv {lvl}/{upg.maxLevel}</span>
                        )}
                      </div>
                      <p className="text-zinc-500 text-[10px]">{upg.description}</p>
                      {effectText && <p className="text-zinc-400 text-[10px] mt-0.5">{effectText}</p>}
                    </div>
                    {isMax ? (
                      <span className="text-yellow-400 text-xs shrink-0">✓</span>
                    ) : (
                      <button
                        onClick={() => handleBuyUpgrade(upg)}
                        disabled={!canAfford}
                        className="shrink-0 px-2.5 py-1.5 bg-yellow-400 hover:bg-yellow-300 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed text-black text-[10px] font-black rounded-lg transition-all whitespace-nowrap"
                      >
                        {formatMoedas(cost)}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Stats footer */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: 'Total Ganho', value: formatMoedas(totalEarnedRef.current) },
          { label: 'Produção/s', value: `${formatMoedas(stats.mps * stats.multiplier)}` },
          { label: 'Multiplicador', value: `×${stats.multiplier}` },
        ].map(s => (
          <div key={s.label} className="bg-zinc-800/40 border border-zinc-700/60 rounded-xl p-3">
            <p className="text-zinc-400 text-[10px] uppercase tracking-wider">{s.label}</p>
            <p className="text-white font-bold text-sm mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
