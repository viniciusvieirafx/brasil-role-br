'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import PetAnimator, { type AnimType } from '@/components/pets/PetAnimator'
import {
  loadData, saveData, giveFirstEgg, startIncubation, loadFromServer,
  updateActivePetStats, addNotification, markAllRead, dismissNotification,
  type PetPlayerData, type PetInstance, type PetNotification,
} from '@/lib/petStore'
import { getPet, RARITY_STYLE, ELEMENT_EMOJI, ELEMENT_COLOR, CAPSULE_COST } from '@/lib/petData'
import { formatTimeLeft, incubationSecondsLeft } from '@/lib/petStore'
import { playClick, playSuccess } from '@/lib/sounds'
import type { ServerNotification } from '@/app/api/pets/notifications/route'

interface DiscordUser { id: string; username: string; avatar: string | null; globalName: string | null }

const VIP_INFO: Record<number, { label: string; icon: string; color: string; border: string; bonuses: string[] }> = {
  1: {
    label: 'Bronze', icon: '🥉', color: 'text-amber-600', border: 'border-amber-600/60',
    bonuses: ['3× entradas nos sorteios', 'Acesso ao sistema de bichinhos', 'Cargo exclusivo no Discord'],
  },
  2: {
    label: 'Prata', icon: '🥈', color: 'text-slate-300', border: 'border-slate-300/60',
    bonuses: ['5× entradas nos sorteios', 'Melhores odds na cápsula', 'Cargo exclusivo no Discord', 'Acesso a sorteios especiais'],
  },
  3: {
    label: 'Ouro', icon: '🥇', color: 'text-yellow-400', border: 'border-yellow-400/60',
    bonuses: ['10× entradas nos sorteios', 'Odds máximas na cápsula', 'Cargo exclusivo no Discord', 'Prioridade em todos os eventos', 'Bônus exclusivos futuros'],
  },
}

function VipBadge({ tier }: { tier: number }) {
  const info = VIP_INFO[tier]
  if (!info) return null
  return (
    <div className="relative group">
      <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border ${info.border} bg-black/30 cursor-default select-none`}>
        <span className="text-base leading-none">{info.icon}</span>
        <span className={`text-xs font-bold ${info.color}`}>VIP {info.label}</span>
      </div>
      {/* Tooltip */}
      <div className="absolute right-0 top-full mt-2 z-50 w-56 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200">
        <div className="bg-[#130F2A] border border-zinc-700 rounded-xl p-3 shadow-xl shadow-black/50">
          <p className={`text-xs font-bold mb-2 ${info.color}`}>{info.icon} Bônus VIP {info.label}</p>
          <ul className="space-y-1">
            {info.bonuses.map((b, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-zinc-300">
                <span className="text-green-400 mt-0.5">✓</span>
                {b}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

// ── Barra de status Tamagotchi ────────────────────────────────────────────────
function StatBar({ label, icon, value, colorClass }: { label: string; icon: string; value: number; colorClass: string }) {
  return (
    <div className="flex-1">
      <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
        <span className="flex items-center gap-1">{icon} {label}</span>
        <span className="font-bold text-white">{Math.round(value)}%</span>
      </div>
      <div className="h-2.5 bg-zinc-700/60 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${colorClass}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  )
}

function petMood(hunger: number, dirty: number): string {
  const avg = hunger - dirty / 2
  if (avg >= 70) return '😊'
  if (avg >= 40) return '😐'
  if (avg >= 15) return '😢'
  return '😵'
}

// ── Notificações locais ────────────────────────────────────────────────────────
const NOTIF_ICON: Record<string, string> = {
  egg_ready:       '🥚',
  battle_win:      '🏆',
  battle_defended: '🛡️',
}

function timeAgo(ts: number): string {
  const secs = Math.floor((Date.now() - ts) / 1000)
  if (secs < 60) return 'agora'
  if (secs < 3600) return `${Math.floor(secs / 60)}m atrás`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h atrás`
  return `${Math.floor(secs / 86400)}d atrás`
}

// ── Bichinho animado (cicla idle → walk → idle) ────────────────────────────────
function LivePet({ petId }: { petId: number }) {
  const [anim, setAnim] = useState<AnimType>('idle')

  useEffect(() => {
    // Ciclo: 3s idle → 2.5s walk → 3s idle → ...
    const sequence: [AnimType, number][] = [
      ['idle', 3000], ['walk', 2500], ['idle', 2000], ['walk', 3000],
    ]
    let idx = 0
    let timer: ReturnType<typeof setTimeout>

    function next() {
      const [a, ms] = sequence[idx % sequence.length]
      setAnim(a)
      idx++
      timer = setTimeout(next, ms)
    }
    next()
    return () => clearTimeout(timer)
  }, [petId])

  return (
    <div className="flex flex-col items-center justify-end py-2" style={{ height: 400 }}>
      <PetAnimator
        petId={petId}
        anim={anim}
        width={390}
        height={390}
        fps={anim === 'walk' ? 12 : 8}
        smooth
      />
    </div>
  )
}

// ── Hub principal ─────────────────────────────────────────────────────────────
export default function PetHub({ initialUser, vipTier = 0 }: { initialUser: DiscordUser | null; vipTier?: number }) {
  const router = useRouter()
  const [data, setData] = useState<PetPlayerData | null>(null)
  const [activePet, setActivePetObj] = useState<PetInstance | null>(null)
  const [secsLeft, setSecsLeft] = useState(0)
  const [eggNotified, setEggNotified] = useState(false)

  function applyAndSave(updated: PetPlayerData) {
    saveData(updated)
    setData(updated)
    setActivePetObj(updated.activePetId ? (updated.ownedPets.find(p => p.instanceId === updated.activePetId) ?? null) : null)
  }

  useEffect(() => {
    if (!initialUser) return
    // Carrega localStorage imediatamente (sem delay)
    const local = updateActivePetStats(loadData(initialUser.id))
    setData(local)
    setActivePetObj(local.activePetId ? (local.ownedPets.find(p => p.instanceId === local.activePetId) ?? null) : null)
    // Depois tenta sincronizar com o servidor (cross-device)
    loadFromServer().then(server => {
      if (!server) return
      const synced = updateActivePetStats(server)
      saveData(synced)
      setData(synced)
      setActivePetObj(synced.activePetId ? (synced.ownedPets.find(p => p.instanceId === synced.activePetId) ?? null) : null)
    }).catch(() => {})

    // Busca notificações server-push (battle_defended) e mescla localmente
    fetch('/api/pets/notifications')
      .then(r => r.ok ? r.json() : [])
      .then((serverNotifs: ServerNotification[]) => {
        if (!serverNotifs.length) return
        setData(prev => {
          if (!prev) return prev
          let updated = prev
          for (const n of serverNotifs) {
            updated = addNotification(updated, n.type as PetNotification['type'], n.message)
          }
          saveData(updated)
          return updated
        })
      })
      .catch(() => {})
  }, [initialUser])

  // Atualiza stats de fome/sujeira a cada minuto
  useEffect(() => {
    if (!initialUser || !data?.activePetId) return
    const id = setInterval(() => {
      setData(prev => {
        if (!prev) return prev
        const updated = updateActivePetStats(prev)
        saveData(updated)
        setActivePetObj(updated.ownedPets.find(p => p.instanceId === updated.activePetId) ?? null)
        return updated
      })
    }, 60_000)
    return () => clearInterval(id)
  }, [initialUser, data?.activePetId])

  // Incubation countdown + notificação quando ovo fica pronto
  useEffect(() => {
    if (!data?.incubating) { setEggNotified(false); return }
    const id = setInterval(() => {
      const secs = incubationSecondsLeft(data.incubating!)
      setSecsLeft(secs)
      if (secs === 0 && !eggNotified) {
        setEggNotified(true)
        setData(prev => {
          if (!prev) return prev
          const updated = addNotification(prev, 'egg_ready', 'Seu ovo está pronto para eclodir! Vá até a página de ovos.')
          saveData(updated)
          return updated
        })
      }
    }, 1000)
    setSecsLeft(incubationSecondsLeft(data.incubating))
    return () => clearInterval(id)
  }, [data?.incubating, eggNotified])

  function handleStart() {
    if (!initialUser || !data) return
    playSuccess()
    const withEgg = giveFirstEgg(data)
    const firstEgg = withEgg.ownedEggs[withEgg.ownedEggs.length - 1]
    const updated = startIncubation(withEgg, firstEgg.instanceId)
    applyAndSave(updated)
    router.push('/pets/ovos')
  }

  // ── Not logged in ─────────────────────────────────────────────────────
  if (!initialUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-6 px-4 text-center">
        <div className="text-7xl animate-bounce">🐾</div>
        <h1 className="text-3xl font-bold text-white">Sistema de Bichinhos</h1>
        <p className="text-zinc-400 max-w-md">Entre com Discord para ter seu bichinho, incubar ovos e competir nos mini-games!</p>
        <a href="/api/auth/discord?from=/pets"
          className="px-6 py-3 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-xl font-semibold transition-all flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.08.114 18.1.132 18.11a19.896 19.896 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
          Entrar com Discord
        </a>
      </div>
    )
  }

  if (!data) return <div className="flex items-center justify-center min-h-[80vh] text-zinc-400">Carregando...</div>

  // ── First time ────────────────────────────────────────────────────────
  if (!data.hasStarted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-8 px-4 text-center">
        <div className="relative">
          <div className="text-8xl animate-bounce">🥚</div>
          <div className="absolute -top-2 -right-2 text-3xl animate-spin" style={{ animationDuration:'3s' }}>✨</div>
        </div>
        <h1 className="text-4xl font-bold text-white">Olá, <span className="text-yellow-400">{initialUser.globalName ?? initialUser.username}</span>!</h1>
        <p className="text-zinc-400 max-w-md text-lg">Comece sua jornada e ganhe seu primeiro ovo gratuito! Ele choca em 1 minuto.</p>
        <button onClick={handleStart}
          className="px-8 py-4 bg-yellow-400 hover:bg-yellow-300 text-black rounded-2xl font-bold text-xl transition-all hover:scale-105 shadow-lg shadow-yellow-400/30">
          🐣 Iniciar meu Bichinho!
        </button>
        <p className="text-zinc-600 text-sm">Ovo Comum gratuito · Choca em 1 minuto</p>
      </div>
    )
  }

  // ── Dashboard ─────────────────────────────────────────────────────────
  const petDef = activePet ? getPet(activePet.petId) : null
  const rarityStyle = petDef ? RARITY_STYLE[petDef.rarity] : null

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        {initialUser.avatar && (
          <img src={`https://cdn.discordapp.com/avatars/${initialUser.id}/${initialUser.avatar}.png`}
            className="w-9 h-9 rounded-full border-2 border-yellow-400/50" alt="avatar" />
        )}
        <div>
          <p className="text-zinc-500 text-xs">Bem-vindo,</p>
          <p className="text-white font-bold text-sm">{initialUser.globalName ?? initialUser.username}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {vipTier > 0 && <VipBadge tier={vipTier} />}
          <div className="flex items-center gap-2 bg-yellow-400/10 border border-yellow-400/30 rounded-xl px-3 py-1.5">
            <span className="text-yellow-400 font-bold">{data.points}</span>
            <span className="text-zinc-400 text-xs">pts</span>
          </div>
        </div>
      </div>

      {/* Active pet */}
      <div className={`rounded-2xl border-2 overflow-hidden ${rarityStyle ? `${rarityStyle.border} ${rarityStyle.bg}` : 'border-zinc-700 bg-zinc-800/60'}`}>
        {activePet && petDef ? (
          <div className="px-5 pt-4 pb-2">
            {/* Info topo */}
            <div className="flex items-start justify-between mb-1">
              <div>
                <p className="text-zinc-500 text-xs uppercase tracking-wider">Bichinho Ativo</p>
                <h2 className="text-white text-2xl font-bold leading-tight">{activePet.name}</h2>
                <p className={`text-sm font-medium mt-0.5 ${rarityStyle!.text}`}>
                  {petDef.rarity}
                </p>
              </div>
              <div className="text-right">
                <p className="text-zinc-500 text-xs">Nível</p>
                <p className="text-white font-bold text-3xl leading-none">{activePet.level}</p>
              </div>
            </div>

            {/* Elemento em destaque */}
            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold mb-2 bg-black/30`}>
              <span className="text-lg">{ELEMENT_EMOJI[activePet.element]}</span>
              <span className={ELEMENT_COLOR[activePet.element]}>{activePet.element}</span>
            </div>

            {/* Bichinho animado */}
            <LivePet petId={activePet.petId} />

            {/* Tamagotchi stats */}
            <div className="px-1 pb-3 space-y-2">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-sm">{petMood(activePet.hunger ?? 100, activePet.dirty ?? 0)}</span>
                <span className="text-zinc-500 text-xs">Humor</span>
              </div>
              <div className="flex gap-3">
                <StatBar
                  label="Fome"
                  icon="🍖"
                  value={activePet.hunger ?? 100}
                  colorClass={
                    (activePet.hunger ?? 100) > 50
                      ? 'bg-green-500'
                      : (activePet.hunger ?? 100) > 20
                      ? 'bg-yellow-400'
                      : 'bg-red-500'
                  }
                />
                <StatBar
                  label="Limpeza"
                  icon="🛁"
                  value={100 - (activePet.dirty ?? 0)}
                  colorClass={
                    (activePet.dirty ?? 0) < 40
                      ? 'bg-blue-400'
                      : (activePet.dirty ?? 0) < 70
                      ? 'bg-yellow-400'
                      : 'bg-orange-500'
                  }
                />
              </div>
              {(activePet.hunger ?? 100) < 20 && (
                <p className="text-red-400 text-xs text-center animate-pulse">😰 {activePet.name} está com muita fome! Jogue Alimentar.</p>
              )}
              {(activePet.dirty ?? 0) > 80 && (
                <p className="text-orange-400 text-xs text-center animate-pulse">🤢 {activePet.name} está muito sujo! Jogue Banho.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-zinc-500 text-4xl mb-2">👻</p>
            <p className="text-zinc-400 text-sm">Nenhum bichinho ativo</p>
            {data.ownedPets.length > 0 && (
              <Link href="/pets/colecao" className="text-yellow-400 hover:underline text-xs mt-1 block">
                Ver minha coleção →
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Stats rápidos */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label:'Ovos',      value: data.ownedEggs.length,  icon:'🥚', href:'/pets/ovos' },
          { label:'Bichinhos', value: data.ownedPets.length,  icon:'🐾', href:'/pets/colecao' },
          { label:'Pontos',    value: data.points,            icon:'⭐', href:'/pets/capsula' },
          { label:'Recorde',   value: `${data.highScore}m`,   icon:'🏆', href:'/pets/minigames/pulo' },
        ].map(s => (
          <Link key={s.label} href={s.href} onClick={playClick}
            className="bg-zinc-800/60 border border-zinc-700 hover:border-yellow-400/40 rounded-xl p-3 text-center transition-all hover:scale-105">
            <div className="text-xl mb-0.5">{s.icon}</div>
            <div className="text-white font-bold text-sm">{s.value}</div>
            <div className="text-zinc-600 text-xs">{s.label}</div>
          </Link>
        ))}
      </div>

      {/* Incubando */}
      {data.incubating && (
        <Link href="/pets/ovos"
          className="flex items-center gap-3 bg-zinc-800/60 border border-yellow-400/30 hover:border-yellow-400/60 rounded-xl p-4 transition-all">
          <span className="text-3xl animate-pulse">🥚</span>
          <div className="flex-1">
            <p className="text-white text-sm font-medium">Incubando...</p>
            <p className="text-zinc-400 text-xs">{formatTimeLeft(secsLeft)} restantes</p>
          </div>
          <span className="text-yellow-400 text-sm">→</span>
        </Link>
      )}

      {/* Mini-games e Cápsula */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/pets/capsula" onClick={playClick}
          className="flex items-center gap-3 bg-yellow-900/20 border border-yellow-500/40 hover:border-yellow-400 rounded-xl p-4 transition-all hover:scale-105">
          <span className="text-3xl">🎰</span>
          <div>
            <p className="text-yellow-400 font-bold text-sm">Cápsula</p>
            <p className="text-zinc-500 text-xs">{CAPSULE_COST} pts / pull</p>
          </div>
        </Link>
        <Link href="/pets/minigames" onClick={playClick}
          className="flex items-center gap-3 bg-green-900/20 border border-green-500/40 hover:border-green-400 rounded-xl p-4 transition-all hover:scale-105">
          <span className="text-3xl">🎮</span>
          <div>
            <p className="text-green-400 font-bold text-sm">Mini-games</p>
            <p className="text-zinc-500 text-xs">Ganhe pontos</p>
          </div>
        </Link>
      </div>

      {/* Notificações locais */}
      {(data.notifications?.length ?? 0) > 0 && (
        <div className="bg-zinc-800/60 border border-zinc-700 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700/60">
            <div className="flex items-center gap-2">
              <span>🔔</span>
              <p className="text-white font-bold text-sm">Notificações</p>
              {data.notifications.some(n => !n.read) && (
                <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                  {data.notifications.filter(n => !n.read).length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {data.notifications.some(n => !n.read) && (
                <button
                  onClick={() => applyAndSave(markAllRead(data))}
                  className="text-zinc-500 hover:text-zinc-300 text-xs transition-colors"
                >
                  Marcar lidas
                </button>
              )}
              <button
                onClick={() => {
                  let d = data
                  data.notifications.forEach(n => { d = dismissNotification(d, n.id) })
                  applyAndSave(d)
                }}
                className="text-zinc-600 hover:text-zinc-300 text-xs transition-colors"
              >
                Limpar
              </button>
            </div>
          </div>
          <ul className="divide-y divide-zinc-800/60">
            {data.notifications.slice(0, 5).map(n => (
              <li key={n.id} className={`flex items-start gap-3 px-4 py-3 transition-colors ${n.read ? 'opacity-60' : 'bg-yellow-400/5'}`}>
                <span className="text-xl shrink-0 mt-0.5">{NOTIF_ICON[n.type] ?? '📢'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm leading-snug">{n.message}</p>
                  <p className="text-zinc-500 text-xs mt-0.5">{timeAgo(n.timestamp)}</p>
                </div>
                <button
                  onClick={() => applyAndSave(dismissNotification(data, n.id))}
                  className="text-zinc-600 hover:text-zinc-300 text-sm shrink-0 mt-0.5 transition-colors"
                  title="Dispensar"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          {data.notifications.length > 5 && (
            <div className="px-4 py-2 text-center border-t border-zinc-800/60">
              <p className="text-zinc-500 text-xs">+{data.notifications.length - 5} notificações mais antigas</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
