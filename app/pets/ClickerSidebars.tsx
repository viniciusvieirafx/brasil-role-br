'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { loadData, saveData, getClicker, saveClicker, type PetPlayerData } from '@/lib/petStore'
import { UPGRADES, computeStats, upgradeCost, formatMoedas, BUY_RATE, SELL_RATE } from '@/lib/clickerData'
import { playClick, getClickerMuted, setClickerMuted } from '@/lib/sounds'

interface DiscordUser { id: string; username: string; avatar: string | null; globalName: string | null }

let floatCounter = 0

export default function ClickerSidebars({ initialUser }: { initialUser: DiscordUser | null }) {
  const moedasRef        = useRef(0)
  const upgradesRef      = useRef<Record<string, number>>({})
  const totalEarnedRef   = useRef(0)
  const lastTickRef      = useRef(Date.now())
  const furyCountRef     = useRef(0)
  const isFuryNextRef    = useRef(false)
  const autoClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [moedas, setMoedas]         = useState(0)
  const [upgrades, setUpgrades]     = useState<Record<string, number>>({})
  const [userData, setUserData]     = useState<PetPlayerData | null>(null)
  const [isFuryNext, setIsFuryNext] = useState(false)
  const [floatNums, setFloatNums]   = useState<{ id: number; text: string; isCrit: boolean }[]>([])
  const [muted, setMuted]           = useState(false)

  useEffect(() => { setMuted(getClickerMuted()) }, [])

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
    }

    setMoedas(Math.floor(moedasRef.current))
    setUpgrades({ ...clicker.upgrades })
    setUserData(data)
  }, [initialUser])

  // Passive tick
  useEffect(() => {
    const id = setInterval(() => {
      const stats = computeStats(upgradesRef.current)
      if (stats.mps <= 0) return
      const now = Date.now()
      const gain = stats.mps * stats.multiplier * ((now - lastTickRef.current) / 1000)
      lastTickRef.current = now
      moedasRef.current      += gain
      totalEarnedRef.current += gain
      setMoedas(Math.floor(moedasRef.current))
    }, 100)
    return () => clearInterval(id)
  }, [])

  // Auto-save every 5s
  useEffect(() => {
    const id = setInterval(() => saveNow(), 5000)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-click
  const startAutoClick = useCallback(() => {
    if (autoClickTimerRef.current) clearTimeout(autoClickTimerRef.current)
    const stats = computeStats(upgradesRef.current)
    if (!stats.autoClickMs) return
    function tick() {
      doClick(true)
      const s = computeStats(upgradesRef.current)
      if (s.autoClickMs) autoClickTimerRef.current = setTimeout(tick, s.autoClickMs)
    }
    autoClickTimerRef.current = setTimeout(tick, stats.autoClickMs)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { if (autoClickTimerRef.current) clearTimeout(autoClickTimerRef.current) }, [])

  useEffect(() => {
    if (!userData) return
    const stats = computeStats(upgradesRef.current)
    if (stats.autoClickMs) startAutoClick()
  }, [userData, startAutoClick])

  function saveNow() {
    setUserData(prev => {
      if (!prev) return prev
      const clicker = { moedas: moedasRef.current, totalMoedasEarned: totalEarnedRef.current, upgrades: upgradesRef.current, lastTickAt: Date.now() }
      const updated = saveClicker(prev, clicker)
      saveData(updated)
      return updated
    })
  }

  function doClick(isAuto = false) {
    const stats = computeStats(upgradesRef.current)
    let gain = stats.mpc * stats.multiplier
    let isCrit = false

    if (stats.critChance > 0 && Math.random() < stats.critChance) { gain *= 3; isCrit = true }

    if (stats.furyEvery !== null) {
      furyCountRef.current += 1
      if (furyCountRef.current >= stats.furyEvery) {
        gain *= 5; furyCountRef.current = 0; isFuryNextRef.current = false; setIsFuryNext(false)
      } else if (furyCountRef.current === stats.furyEvery - 1) {
        isFuryNextRef.current = true; setIsFuryNext(true)
      }
    }

    moedasRef.current      += gain
    totalEarnedRef.current += gain
    setMoedas(Math.floor(moedasRef.current))

    if (!isAuto) {
      const id = ++floatCounter
      setFloatNums(prev => [...prev, { id, text: `+${formatMoedas(gain)}`, isCrit }])
      setTimeout(() => setFloatNums(prev => prev.filter(f => f.id !== id)), 900)
    }
  }

  function handleBuyUpgrade(upgradeId: string) {
    const upgrade = UPGRADES.find(u => u.id === upgradeId)!
    const lvl = upgradesRef.current[upgradeId] ?? 0
    const cost = upgradeCost(upgrade, lvl)
    if (cost === Infinity || moedasRef.current < cost) return
    playClick()
    moedasRef.current -= cost
    upgradesRef.current = { ...upgradesRef.current, [upgradeId]: lvl + 1 }
    setMoedas(Math.floor(moedasRef.current))
    setUpgrades({ ...upgradesRef.current })
    if (upgrade.type === 'auto_click') { if (autoClickTimerRef.current) clearTimeout(autoClickTimerRef.current); startAutoClick() }
    saveNow()
  }

  function buyMoedas() {
    if (!userData || userData.points < BUY_RATE.pts) return
    playClick()
    const updated = { ...userData, points: userData.points - BUY_RATE.pts }
    moedasRef.current      += BUY_RATE.moedas
    totalEarnedRef.current += BUY_RATE.moedas
    setMoedas(Math.floor(moedasRef.current))
    const withClicker = saveClicker(updated, { moedas: moedasRef.current, totalMoedasEarned: totalEarnedRef.current, upgrades: upgradesRef.current, lastTickAt: Date.now() })
    saveData(withClicker); setUserData(withClicker)
  }

  function sellMoedas() {
    if (!userData || moedasRef.current < SELL_RATE.moedas) return
    playClick()
    moedasRef.current -= SELL_RATE.moedas
    setMoedas(Math.floor(moedasRef.current))
    const updated = { ...userData, points: userData.points + SELL_RATE.pts, totalPoints: userData.totalPoints + SELL_RATE.pts }
    const withClicker = saveClicker(updated, { moedas: moedasRef.current, totalMoedasEarned: totalEarnedRef.current, upgrades: upgradesRef.current, lastTickAt: Date.now() })
    saveData(withClicker); setUserData(withClicker)
  }

  if (!initialUser || !userData) return null

  const stats     = computeStats(upgrades)
  const furyEvery = stats.furyEvery
  const furyCount = furyCountRef.current

  return (
    <>
      <style>{`
        @keyframes floatUpSide {
          0%   { opacity:1; transform:translateY(0) scale(1); }
          100% { opacity:0; transform:translateY(-60px) scale(0.8); }
        }
        .float-side { animation: floatUpSide 0.9s ease-out forwards; pointer-events:none; }
      `}</style>

      {/* ── LEFT SIDEBAR ─────────────────────────────────────────────── */}
      <div className="hidden xl:flex fixed left-4 top-1/2 -translate-y-1/2 w-52 flex-col gap-3 z-20">

        {/* Counter */}
        <div className="bg-zinc-900/90 backdrop-blur border border-zinc-700 rounded-2xl p-4 text-center relative">
          <button
            onClick={() => { const v = !muted; setMuted(v); setClickerMuted(v) }}
            title={muted ? 'Ativar som' : 'Silenciar clicker'}
            className="absolute top-2 right-2 text-base leading-none text-zinc-500 hover:text-zinc-300 transition-colors"
          >{muted ? '🔇' : '🔊'}</button>
          <p className="text-yellow-400 text-3xl font-black tabular-nums leading-none">{formatMoedas(moedas)}</p>
          <p className="text-zinc-500 text-[11px] mt-0.5">moedas</p>
          <div className="flex justify-center gap-4 mt-2 text-[11px] text-zinc-400">
            <span title="por segundo">{formatMoedas(stats.mps * stats.multiplier)}/s</span>
            <span title="por clique">{formatMoedas(stats.mpc * stats.multiplier)}/clique</span>
          </div>
        </div>

        {/* Click button */}
        <div className="flex flex-col items-center gap-2 w-full">
          <div className="relative">
            <button
              onClick={() => { playClick(); doClick() }}
              className={`relative w-28 h-28 rounded-full text-5xl select-none transition-all active:scale-90
                bg-yellow-400 hover:bg-yellow-300 shadow-lg overflow-hidden
                ${isFuryNext
                  ? 'ring-4 ring-orange-500 ring-offset-2 ring-offset-black shadow-orange-500/50 shadow-2xl'
                  : 'shadow-yellow-400/30 hover:shadow-yellow-400/50'}`}
            >
              🪙
              {floatNums.map(f => (
                <span key={f.id} className={`float-side absolute top-6 left-1/2 text-xs font-black whitespace-nowrap ${f.isCrit ? 'text-red-300' : 'text-white'}`}>
                  {f.text}{f.isCrit ? '!' : ''}
                </span>
              ))}
            </button>
          </div>
          {isFuryNext && (
            <p className="text-orange-400 text-[11px] font-bold animate-pulse">🔥 PRÓXIMO = FÚRIA!</p>
          )}
        </div>

        {/* Fury bar */}
        {(upgrades['fury'] ?? 0) > 0 && furyEvery !== null && (
          <div className="bg-zinc-900/90 backdrop-blur border border-zinc-700 rounded-xl px-3 py-2">
            <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
              <span>🔥 Fúria</span>
              <span>{furyCount}/{furyEvery}</span>
            </div>
            <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${isFuryNext ? 'bg-orange-500' : 'bg-red-500'}`}
                style={{ width: `${Math.min(100, (furyCount / furyEvery) * 100)}%` }} />
            </div>
          </div>
        )}

        {/* Link to full page */}
        <Link href="/pets/clicker"
          className="text-center text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors">
          ver tudo →
        </Link>
      </div>

      {/* ── RIGHT SIDEBAR ────────────────────────────────────────────── */}
      <div className="hidden xl:flex fixed right-4 top-[52px] w-56 flex-col gap-3 z-20 max-h-[calc(100vh-52px)] overflow-y-auto pb-4"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#3f3f46 transparent' }}>

        {/* Exchange */}
        <div className="bg-zinc-900/90 backdrop-blur border border-zinc-700 rounded-2xl p-3 space-y-2">
          <p className="text-zinc-400 text-[11px] font-bold uppercase tracking-wider">Câmbio</p>
          <button onClick={buyMoedas} disabled={userData.points < BUY_RATE.pts}
            className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-[11px] font-bold rounded-lg transition-all">
            {BUY_RATE.pts} pts → +{formatMoedas(BUY_RATE.moedas)}M
          </button>
          <button onClick={sellMoedas} disabled={moedas < SELL_RATE.moedas}
            className="w-full py-1.5 bg-green-700 hover:bg-green-600 disabled:opacity-30 disabled:cursor-not-allowed text-white text-[11px] font-bold rounded-lg transition-all">
            {formatMoedas(SELL_RATE.moedas)}M → +{SELL_RATE.pts} pts
          </button>
          <p className="text-zinc-600 text-[10px] text-center">Pts disponíveis: {userData.points}</p>
        </div>

        {/* Upgrades */}
        <div className="bg-zinc-900/90 backdrop-blur border border-zinc-700 rounded-2xl p-3 space-y-1.5">
          <p className="text-zinc-400 text-[11px] font-bold uppercase tracking-wider mb-2">Melhorias</p>
          {UPGRADES.map(upg => {
            const lvl      = upgrades[upg.id] ?? 0
            const cost     = upgradeCost(upg, lvl)
            const isMax    = lvl >= upg.maxLevel
            const canAfford = !isMax && moedas >= cost

            return (
              <div key={upg.id} className={`flex items-center gap-2 p-2 rounded-xl border transition-all
                ${isMax ? 'border-yellow-500/30 bg-yellow-900/10' : canAfford ? 'border-zinc-600 bg-zinc-800/60' : 'border-zinc-700/50 bg-zinc-800/30'}`}>
                <span className="text-lg shrink-0">{upg.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-[11px] font-bold truncate">{upg.name}</p>
                  <p className="text-zinc-500 text-[10px]">{isMax ? 'MAX' : `Nv ${lvl}/${upg.maxLevel}`}</p>
                </div>
                {isMax ? (
                  <span className="text-yellow-400 text-[10px] shrink-0">✓</span>
                ) : (
                  <button
                    onClick={() => handleBuyUpgrade(upg.id)}
                    disabled={!canAfford}
                    className="shrink-0 px-2 py-1 bg-yellow-400 hover:bg-yellow-300 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed text-black text-[10px] font-black rounded-lg transition-all"
                  >
                    {formatMoedas(cost)}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Stats */}
        <div className="bg-zinc-900/90 backdrop-blur border border-zinc-700 rounded-2xl p-3 grid grid-cols-2 gap-2 text-center">
          <div>
            <p className="text-zinc-500 text-[10px]">Total</p>
            <p className="text-white text-xs font-bold">{formatMoedas(totalEarnedRef.current)}</p>
          </div>
          <div>
            <p className="text-zinc-500 text-[10px]">×Multi</p>
            <p className="text-white text-xs font-bold">×{stats.multiplier}</p>
          </div>
        </div>
      </div>
    </>
  )
}
