'use client'

import { useEffect, useState } from 'react'
import { loadData, saveData, openCapsule, type PetPlayerData } from '@/lib/petStore'
import { capsuleCostForTier, RARITY_STYLE, type CapsuleReward } from '@/lib/petData'
import { playCapsuleOpen, playCapsuleLegendary, playClick } from '@/lib/sounds'

interface DiscordUser { id: string; username: string; avatar: string | null; globalName: string | null }

type AnimState = 'idle' | 'shaking' | 'opening' | 'reveal'

const RARITY_GLOW: Record<string, string> = {
  'Comum':    'shadow-zinc-400/40',
  'Incomum':  'shadow-green-400/60',
  'Raro':     'shadow-blue-400/70',
  'Épico':    'shadow-purple-500/80',
  'Lendário': 'shadow-yellow-400/90',
}

const VIP_BADGE: Record<number, { label: string; color: string }> = {
  1: { label: 'VIP 1', color: 'text-green-400 border-green-400/50 bg-green-900/20' },
  2: { label: 'VIP 2', color: 'text-blue-400 border-blue-400/50 bg-blue-900/20' },
  3: { label: 'VIP 3', color: 'text-yellow-400 border-yellow-400/50 bg-yellow-900/20' },
}

// Odds por tier (para exibição)
const ODDS_BY_TIER: Record<number, { label: string; pct: string; color: string }[]> = {
  0: [
    { label:'⭐ +50 XP',         pct:'35%',  color:'text-zinc-300' },
    { label:'🌟 +200 XP',        pct:'20%',  color:'text-zinc-300' },
    { label:'💫 +500 XP',        pct:'10%',  color:'text-zinc-300' },
    { label:'🥚 Ovo Comum',      pct:'17%',  color:'text-zinc-400' },
    { label:'🟢 Ovo Incomum',    pct:'11%',  color:'text-green-400' },
    { label:'🔵 Ovo Raro',       pct:'5%',   color:'text-blue-400'  },
    { label:'🟣 Ovo Épico',      pct:'1.5%', color:'text-purple-400'},
    { label:'🌟 Ovo Lendário',   pct:'0.5%', color:'text-yellow-400'},
  ],
  1: [
    { label:'⭐ +50 XP',         pct:'35%',  color:'text-zinc-300' },
    { label:'🌟 +200 XP',        pct:'20%',  color:'text-zinc-300' },
    { label:'💫 +500 XP',        pct:'10%',  color:'text-zinc-300' },
    { label:'🥚 Ovo Comum',      pct:'17%',  color:'text-zinc-400' },
    { label:'🟢 Ovo Incomum',    pct:'11%',  color:'text-green-400' },
    { label:'🔵 Ovo Raro',       pct:'5%',   color:'text-blue-400'  },
    { label:'🟣 Ovo Épico',      pct:'1.5%', color:'text-purple-400'},
    { label:'🌟 Ovo Lendário',   pct:'0.5%', color:'text-yellow-400'},
  ],
  2: [
    { label:'⭐ +50 XP',         pct:'28%',  color:'text-zinc-300' },
    { label:'🌟 +200 XP',        pct:'18%',  color:'text-zinc-300' },
    { label:'💫 +500 XP',        pct:'11%',  color:'text-zinc-300' },
    { label:'🥚 Ovo Comum',      pct:'16%',  color:'text-zinc-400' },
    { label:'🟢 Ovo Incomum',    pct:'14%',  color:'text-green-400' },
    { label:'🔵 Ovo Raro',       pct:'9%',   color:'text-blue-400'  },
    { label:'🟣 Ovo Épico',      pct:'3.3%', color:'text-purple-400'},
    { label:'🌟 Ovo Lendário',   pct:'0.7%', color:'text-yellow-400'},
  ],
  3: [
    { label:'⭐ +50 XP',         pct:'20%',  color:'text-zinc-300' },
    { label:'🌟 +200 XP',        pct:'18%',  color:'text-zinc-300' },
    { label:'💫 +500 XP',        pct:'12%',  color:'text-zinc-300' },
    { label:'🥚 Ovo Comum',      pct:'15%',  color:'text-zinc-400' },
    { label:'🟢 Ovo Incomum',    pct:'17%',  color:'text-green-400' },
    { label:'🔵 Ovo Raro',       pct:'11%',  color:'text-blue-400'  },
    { label:'🟣 Ovo Épico',      pct:'5.5%', color:'text-purple-400'},
    { label:'🌟 Ovo Lendário',   pct:'1.5%', color:'text-yellow-400'},
  ],
}

export default function CapsulaPagina({ initialUser, vipTier = 0 }: { initialUser: DiscordUser | null; vipTier?: number }) {
  const [data, setData] = useState<PetPlayerData | null>(null)
  const [anim, setAnim] = useState<AnimState>('idle')
  const [reward, setReward] = useState<CapsuleReward | null>(null)
  const [history, setHistory] = useState<CapsuleReward[]>([])

  const cost = capsuleCostForTier(vipTier)

  useEffect(() => {
    if (!initialUser) return
    setData(loadData(initialUser.id))
  }, [initialUser])

  function handlePull() {
    if (!data || data.points < cost || anim !== 'idle') return
    playClick()
    setAnim('shaking')

    setTimeout(() => {
      setAnim('opening')
      const result = openCapsule(data, vipTier)
      if (!result) return
      saveData(result.data)
      setData(result.data)

      if (result.reward.rarity === 'Lendário') playCapsuleLegendary()
      else playCapsuleOpen()

      setTimeout(() => {
        setReward(result.reward)
        setHistory(h => [result.reward, ...h].slice(0, 10))
        setAnim('reveal')
      }, 400)
    }, 600)
  }

  function handleNext() {
    playClick()
    setAnim('idle')
    setReward(null)
  }

  if (!initialUser) return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <p className="text-zinc-400">Faça login para usar a cápsula.</p>
    </div>
  )
  if (!data) return <div className="flex items-center justify-center min-h-[80vh] text-zinc-400">Carregando...</div>

  const canAfford = data.points >= cost
  const vipBadge = vipTier > 0 ? VIP_BADGE[vipTier] : null
  const odds = ODDS_BY_TIER[Math.min(vipTier, 3)] ?? ODDS_BY_TIER[0]

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-white">🎰 Cápsula</h1>
          {vipBadge && (
            <span className={`text-xs font-bold border rounded-full px-2 py-0.5 ${vipBadge.color}`}>
              {vipBadge.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 bg-yellow-400/10 border border-yellow-400/30 rounded-xl px-3 py-1.5">
          <span className="text-yellow-400 font-bold">{data.points}</span>
          <span className="text-zinc-400 text-xs">pts</span>
        </div>
      </div>

      {/* Banner de desconto VIP */}
      {vipTier > 0 && (
        <div className={`rounded-xl border px-4 py-2 text-sm flex items-center gap-2 ${vipBadge!.color}`}>
          <span>✨</span>
          <span>
            Desconto {vipBadge!.label}: <strong>{cost} pts</strong> por pull
            {vipTier >= 2 && ' · Melhores chances'}
            {vipTier >= 3 && ' · Odds máximas'}
          </span>
        </div>
      )}

      {/* Máquina */}
      <div className="relative flex flex-col items-center gap-6">
        {/* Cápsula */}
        <div className="relative flex items-center justify-center" style={{ height: 180 }}>
          {anim === 'idle' && (
            <div className="text-[120px] cursor-pointer select-none hover:scale-110 transition-transform"
              onClick={handlePull}>
              💊
            </div>
          )}
          {anim === 'shaking' && (
            <div className="text-[120px] select-none"
              style={{ animation: 'shake 0.1s ease-in-out infinite' }}>
              💊
            </div>
          )}
          {anim === 'opening' && (
            <div className="text-[120px] select-none"
              style={{ animation: 'popIn 0.4s ease-out forwards' }}>
              ✨
            </div>
          )}
          {anim === 'reveal' && reward && (
            <div className={`flex flex-col items-center gap-3 ${
              reward.rarity === 'Lendário' ? 'animate-pulse' : ''
            }`}
              style={{ animation: 'bounceIn 0.5s cubic-bezier(0.175,0.885,0.32,1.275) forwards' }}>
              <div className={`text-[80px] drop-shadow-lg ${
                reward.rarity ? `shadow-2xl ${RARITY_GLOW[reward.rarity]}` : ''
              }`}>
                {reward.emoji}
              </div>
              <div className="text-center">
                <p className={`text-2xl font-bold ${
                  reward.rarity ? RARITY_STYLE[reward.rarity].text : 'text-yellow-300'
                }`}>
                  {reward.label}
                </p>
                {reward.type === 'egg' && reward.rarity && (
                  <p className="text-zinc-400 text-sm mt-1">
                    Adicionado ao inventário de ovos!
                  </p>
                )}
                {reward.type === 'xp_boost' && (
                  <p className="text-zinc-400 text-sm mt-1">
                    {data.activePetId
                      ? 'XP adicionado ao bichinho ativo!'
                      : 'Salvo — ative um bichinho para usar'}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Botão */}
        {anim === 'idle' && (
          <button onClick={handlePull} disabled={!canAfford}
            className={`w-full py-4 rounded-2xl font-bold text-lg transition-all ${
              canAfford
                ? 'bg-yellow-400 hover:bg-yellow-300 text-black hover:scale-105 shadow-lg shadow-yellow-400/30'
                : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
            }`}>
            {canAfford ? `🎰 Puxar Cápsula — ${cost} pts` : `Sem pontos suficientes (${cost} pts)`}
          </button>
        )}

        {anim === 'reveal' && (
          <button onClick={handleNext}
            className="w-full py-4 rounded-2xl font-bold text-lg bg-zinc-700 hover:bg-zinc-600 text-white transition-all hover:scale-105">
            {canAfford ? '🔄 Puxar Novamente' : '✓ Fechar'}
          </button>
        )}

        {(anim === 'shaking' || anim === 'opening') && (
          <div className="w-full py-4 rounded-2xl text-center text-zinc-500 text-sm">Abrindo...</div>
        )}
      </div>

      {/* Odds */}
      <details className="bg-zinc-800/60 border border-zinc-700 rounded-xl overflow-hidden">
        <summary className="px-4 py-3 text-zinc-400 text-sm cursor-pointer hover:text-white">
          Ver probabilidades {vipTier > 0 ? `(${VIP_BADGE[vipTier]?.label})` : ''}
        </summary>
        <div className="px-4 pb-4 space-y-1 text-sm">
          {odds.map(r => (
            <div key={r.label} className="flex justify-between">
              <span className={r.color}>{r.label}</span>
              <span className="text-zinc-500">{r.pct}</span>
            </div>
          ))}
        </div>
      </details>

      {/* Histórico */}
      {history.length > 0 && (
        <div>
          <p className="text-zinc-500 text-xs uppercase tracking-wider mb-2">Últimas cápsulas</p>
          <div className="flex gap-2 flex-wrap">
            {history.map((r, i) => (
              <span key={i} className="text-xl" title={r.label}>{r.emoji}</span>
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes shake {
          0%,100% { transform: translateX(0) rotate(0deg); }
          25% { transform: translateX(-8px) rotate(-5deg); }
          75% { transform: translateX(8px) rotate(5deg); }
        }
        @keyframes popIn {
          0%   { transform: scale(0.3); opacity:0; }
          60%  { transform: scale(1.3); opacity:1; }
          100% { transform: scale(1);   opacity:1; }
        }
        @keyframes bounceIn {
          0%   { transform: scale(0.3) translateY(20px); opacity:0; }
          60%  { transform: scale(1.15) translateY(-10px); opacity:1; }
          100% { transform: scale(1) translateY(0); opacity:1; }
        }
      `}</style>
    </div>
  )
}
