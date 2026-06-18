'use client'

import { useEffect, useState, useRef } from 'react'
import PetAnimator, { type AnimType } from '@/components/pets/PetAnimator'
import {
  loadData, saveData, applyBattleLoss, checkRecovery, recoverySecondsLeft,
  addPoints, addNotification, formatTimeLeft, type PetPlayerData, type PetInstance,
} from '@/lib/petStore'
import { getPet, ELEMENT_EMOJI, ELEMENT_COLOR } from '@/lib/petData'
import {
  makeBattlePet, simulateBattle,
  getElementAdvantage,
  type BattlePet, type BattleLog,
} from '@/lib/battle'
import type { ArenaEntry } from '@/app/api/pets/arena/route'

interface DiscordUser { id: string; username: string; avatar: string | null; globalName: string | null }

// ── Barra de HP ───────────────────────────────────────────────────────────────
function HpBar({ current, max, side }: { current: number; max: number; side: 'left' | 'right' }) {
  const pct = Math.max(0, (current / max) * 100)
  const color = pct > 50 ? 'bg-green-500' : pct > 25 ? 'bg-yellow-400' : 'bg-red-500'
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-zinc-400 mb-1">
        {side === 'left' ? (
          <><span className="font-bold text-white">{current}</span><span>/ {max}</span></>
        ) : (
          <><span>/ {max}</span><span className="font-bold text-white">{current}</span></>
        )}
      </div>
      <div className={`h-3 bg-zinc-700 rounded-full overflow-hidden ${side === 'right' ? 'rotate-180' : ''}`}>
        <div className={`h-full ${color} transition-all duration-300 rounded-full`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ── Vidas ─────────────────────────────────────────────────────────────────────
function Lives({ lives, max = 3 }: { lives: number; max?: number }) {
  return (
    <div className="flex gap-1 justify-center">
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={`text-sm transition-all ${i < lives ? 'opacity-100' : 'opacity-20 grayscale'}`}>❤️</span>
      ))}
    </div>
  )
}

// ── Arena: dois pets animados frente a frente ──────────────────────────────────
function Arena({
  playerPet, enemyPet,
  playerAnim, enemyAnim,
  playerHp, enemyHp,
  shake,
}: {
  playerPet: BattlePet
  enemyPet: BattlePet
  playerAnim: AnimType
  enemyAnim: AnimType
  playerHp: number
  enemyHp: number
  shake: 'player' | 'enemy' | null
}) {
  return (
    <div className="relative bg-gradient-to-b from-zinc-900 to-[#0d0920] rounded-2xl border border-zinc-700 overflow-hidden h-52">
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-600/40" />

      {/* Lado esquerdo — jogador */}
      <div className={`absolute bottom-4 left-8 flex flex-col items-center gap-1 transition-transform ${shake === 'player' ? 'animate-bounce' : ''}`}>
        <div className="w-24">
          <HpBar current={playerHp} max={playerPet.maxHp} side="left" />
        </div>
        <PetAnimator petId={playerPet.petId} anim={playerAnim} width={90} height={90} fps={playerAnim === 'idle' ? 8 : 14} />
        <p className="text-white text-xs font-medium truncate max-w-[90px] text-center">{playerPet.name}</p>
      </div>

      {/* Lado direito — oponente (espelhado) */}
      <div className={`absolute bottom-4 right-8 flex flex-col items-center gap-1 transition-transform ${shake === 'enemy' ? 'animate-bounce' : ''}`}>
        <div className="w-24">
          <HpBar current={enemyHp} max={enemyPet.maxHp} side="right" />
        </div>
        <PetAnimator petId={enemyPet.petId} anim={enemyAnim} width={90} height={90} fps={enemyAnim === 'idle' ? 8 : 14} flipX />
        <p className="text-white text-xs font-medium truncate max-w-[90px] text-center">{enemyPet.name}</p>
      </div>

      {/* VS badge */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="text-yellow-400/30 font-black text-5xl select-none">VS</span>
      </div>
    </div>
  )
}

type Phase = 'select' | 'fighting' | 'result'

// ── Componente principal ───────────────────────────────────────────────────────
export default function BatalhaClient({ initialUser }: { initialUser: DiscordUser | null }) {
  const [data, setData]             = useState<PetPlayerData | null>(null)
  const [arenaPlayers, setArenaPlayers] = useState<ArenaEntry[]>([])
  const [loadingArena, setLoadingArena] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<ArenaEntry | null>(null)
  const [phase, setPhase]           = useState<Phase>('select')
  const [logs, setLogs]             = useState<BattleLog[]>([])
  const [logIdx, setLogIdx]         = useState(0)
  const [playerHp, setPlayerHp]     = useState(0)
  const [enemyHp, setEnemyHp]       = useState(0)
  const [playerAnim, setPlayerAnim] = useState<AnimType>('idle')
  const [enemyAnim, setEnemyAnim]   = useState<AnimType>('idle')
  const [shake, setShake]           = useState<'player' | 'enemy' | null>(null)
  const [winner, setWinner]         = useState<'player' | 'enemy' | null>(null)
  const [battleMsg, setBattleMsg]   = useState('')
  const [battlePets, setBattlePets] = useState<{ p: BattlePet; e: BattlePet } | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Carrega dados locais e registra na arena
  useEffect(() => {
    if (!initialUser) return
    const d = checkRecovery(loadData(initialUser.id))
    setData(d)
  }, [initialUser])

  // Quando dados carregados: registra na arena + busca oponentes
  useEffect(() => {
    if (!data || !initialUser) return
    const activePet = data.ownedPets.find(p => p.instanceId === data.activePetId)
    if (!activePet) return

    registerInArena(initialUser, activePet)
    fetchArena(initialUser.id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.activePetId])

  async function registerInArena(user: DiscordUser, pet: PetInstance) {
    try {
      await fetch('/api/pets/arena', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discordId: user.id,
          username: user.username,
          globalName: user.globalName,
          avatar: user.avatar,
          pet: {
            instanceId: pet.instanceId,
            petId: pet.petId,
            name: pet.name,
            level: pet.level,
            element: pet.element,
          },
        }),
      })
    } catch { /* silencioso */ }
  }

  async function fetchArena(excludeId: string) {
    setLoadingArena(true)
    try {
      const res = await fetch(`/api/pets/arena?exclude=${excludeId}`)
      const list: ArenaEntry[] = await res.json()
      setArenaPlayers(list)
    } catch {
      setArenaPlayers([])
    } finally {
      setLoadingArena(false)
    }
  }

  // Replay de batalha: avança um log por vez
  useEffect(() => {
    if (phase !== 'fighting' || !logs.length || !battlePets) return

    if (logIdx >= logs.length) {
      timerRef.current = setTimeout(() => {
        setPhase('result')
        setWinner(logs[logs.length - 1].playerHpAfter > 0 ? 'player' : 'enemy')
      }, 600)
      return () => { if (timerRef.current) clearTimeout(timerRef.current) }
    }

    const log = logs[logIdx]
    const isPlayer = log.attacker === 'player'

    if (isPlayer) setPlayerAnim('attack')
    else          setEnemyAnim('attack')

    timerRef.current = setTimeout(() => {
      if (isPlayer) { setEnemyAnim('hit'); setShake('enemy') }
      else          { setPlayerAnim('hit'); setShake('player') }

      setPlayerHp(log.playerHpAfter)
      setEnemyHp(log.enemyHpAfter)

      const advMsg =
        log.advantage === 'strong' ? ' ⚡ É super efetivo!' :
        log.advantage === 'weak'   ? ' 💨 Pouco efetivo...' : ''
      setBattleMsg(
        `${isPlayer ? battlePets.p.name : battlePets.e.name} causou ${log.damage} de dano!${advMsg}`
      )

      timerRef.current = setTimeout(() => {
        if (isPlayer) setEnemyAnim('idle')
        else          setPlayerAnim('idle')
        setShake(null)
        setLogIdx(i => i + 1)
      }, 500)
    }, 400)

    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [phase, logIdx, logs, battlePets])

  function handleStartBattle(entry: ArenaEntry) {
    if (!data || !initialUser) return
    const activePet = data.ownedPets.find(p => p.instanceId === data.activePetId)
    if (!activePet) return

    const p = makeBattlePet(activePet.instanceId, activePet.petId, activePet.name, activePet.level, activePet.element)
    const e = makeBattlePet(entry.pet.instanceId, entry.pet.petId, entry.pet.name, entry.pet.level, entry.pet.element as any)
    const result = simulateBattle(p, e)

    setBattlePets({ p, e })
    setPlayerHp(p.maxHp)
    setEnemyHp(e.maxHp)
    setPlayerAnim('idle')
    setEnemyAnim('idle')
    setLogs(result.logs)
    setLogIdx(0)
    setWinner(null)
    setBattleMsg('A batalha começou!')
    setSelectedEntry(entry)
    setPhase('fighting')
  }

  function handleBattleEnd() {
    if (!data || !initialUser || !battlePets) return
    const activePet = data.ownedPets.find(p => p.instanceId === data.activePetId)
    if (!activePet) return

    const reward = selectedEntry ? Math.max(20, selectedEntry.pet.level * 15) : 20

    let updated = data
    if (winner === 'enemy') {
      // Você perdeu — perde uma vida mas sem notificação de sofrimento
      updated = applyBattleLoss(data, activePet.instanceId)
      // Pet do oponente venceu — notifica o dono (server-push)
      if (selectedEntry) {
        fetch('/api/pets/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetDiscordId: selectedEntry.discordId,
            type: 'battle_defended',
            message: `Seu bichinho ${selectedEntry.pet.name} defendeu um desafio de ${initialUser.username} e venceu!`,
            points: reward,
          }),
        }).catch(() => {})
      }
    } else {
      // Você ganhou — ganha pontos + notificação local
      updated = addPoints(data, reward)
      updated = addNotification(
        updated,
        'battle_win',
        `${activePet.name} venceu a batalha contra ${selectedEntry?.pet.name ?? 'oponente'}! +${reward} pontos`,
      )
    }
    saveData(updated)
    setData(checkRecovery(updated))
    setPhase('select')
    setSelectedEntry(null)
    setBattlePets(null)
  }

  // ── Sem login ──────────────────────────────────────────────────────────────
  if (!initialUser) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <p className="text-zinc-400">Faça login para batalhar.</p>
      </div>
    )
  }

  if (!data) return <div className="flex items-center justify-center min-h-[80vh] text-zinc-400">Carregando...</div>

  const activePet = data.ownedPets.find(p => p.instanceId === data.activePetId)

  // ── Sem pet ativo ──────────────────────────────────────────────────────────
  if (!activePet) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center space-y-4">
        <p className="text-5xl">⚔️</p>
        <h1 className="text-2xl font-bold text-white">Batalha</h1>
        <p className="text-zinc-400">Você precisa de um bichinho ativo para batalhar.</p>
        <a href="/pets/colecao" className="inline-block px-6 py-2 bg-yellow-400 text-black font-bold rounded-xl hover:bg-yellow-300 transition-all">
          Ir para a Coleção
        </a>
      </div>
    )
  }

  const petDef = getPet(activePet.petId)
  const recSecs = recoverySecondsLeft(activePet)

  // ── Em recuperação ─────────────────────────────────────────────────────────
  if (activePet.recovering) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center space-y-4">
        <p className="text-5xl animate-pulse">💤</p>
        <h1 className="text-2xl font-bold text-white">Recuperando...</h1>
        <p className="text-zinc-400">{activePet.name} perdeu todas as vidas e está se recuperando.</p>
        <div className="bg-zinc-800/60 border border-zinc-700 rounded-2xl p-6 max-w-xs mx-auto">
          <p className="text-red-400 font-bold text-lg">{formatTimeLeft(recSecs)}</p>
          <p className="text-zinc-500 text-sm mt-1">até estar pronto para batalhar</p>
          <Lives lives={0} />
        </div>
      </div>
    )
  }

  // ── Resultado ──────────────────────────────────────────────────────────────
  if (phase === 'result' && battlePets) {
    const won = winner === 'player'
    const reward = selectedEntry ? Math.max(20, selectedEntry.pet.level * 15) : 20
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <Arena
          playerPet={battlePets.p} enemyPet={battlePets.e}
          playerAnim={won ? 'idle' : 'dead'} enemyAnim={won ? 'dead' : 'idle'}
          playerHp={playerHp} enemyHp={enemyHp}
          shake={null}
        />

        <div className={`rounded-2xl border-2 p-6 text-center space-y-3 ${won ? 'border-yellow-400 bg-yellow-900/20' : 'border-red-500 bg-red-900/20'}`}>
          <p className="text-5xl">{won ? '🏆' : '💀'}</p>
          <h2 className={`text-3xl font-black ${won ? 'text-yellow-400' : 'text-red-400'}`}>
            {won ? 'Vitória!' : 'Derrota...'}
          </h2>
          {won ? (
            <p className="text-zinc-300">
              +<span className="text-yellow-400 font-bold">{reward}</span> pontos ganhos!
            </p>
          ) : (
            <div className="space-y-1">
              <p className="text-zinc-300">{activePet.name} perdeu uma vida.</p>
              <Lives lives={Math.max(0, (activePet.lives ?? 3) - 1)} />
              {(activePet.lives ?? 3) <= 1 && (
                <p className="text-red-400 text-sm">Sem vidas! Entrará em recuperação por 24h.</p>
              )}
            </div>
          )}
          <button
            onClick={handleBattleEnd}
            className={`w-full py-3 font-bold rounded-xl transition-all hover:scale-105 ${
              won ? 'bg-yellow-400 hover:bg-yellow-300 text-black' : 'bg-red-500 hover:bg-red-400 text-white'
            }`}
          >
            {won ? '✨ Continuar' : '💔 Voltar'}
          </button>
        </div>
      </div>
    )
  }

  // ── Batalha em andamento ───────────────────────────────────────────────────
  if (phase === 'fighting' && battlePets) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <h1 className="text-xl font-bold text-white text-center">⚔️ Batalha!</h1>
        <Arena
          playerPet={battlePets.p} enemyPet={battlePets.e}
          playerAnim={playerAnim} enemyAnim={enemyAnim}
          playerHp={playerHp} enemyHp={enemyHp}
          shake={shake}
        />
        <div className="bg-zinc-800/60 border border-zinc-700 rounded-xl p-3 text-center">
          <p className="text-zinc-300 text-sm">{battleMsg}</p>
          <p className="text-zinc-600 text-xs mt-1">Turno {logIdx} / {logs.length}</p>
        </div>
      </div>
    )
  }

  // ── Seleção de oponente ────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-white">⚔️ Batalha</h1>

      {/* Pet ativo */}
      <div className="bg-zinc-800/60 border border-zinc-700 rounded-2xl p-4 flex items-center gap-4">
        <PetAnimator petId={activePet.petId} anim="idle" width={72} height={72} fps={8} />
        <div className="flex-1">
          <p className="text-white font-bold">{activePet.name}</p>
          <p className="text-zinc-400 text-sm">{petDef.rarity} · Nv.{activePet.level}</p>
          <p className="text-sm">
            {ELEMENT_EMOJI[activePet.element]}
            <span className={`ml-1 ${ELEMENT_COLOR[activePet.element]}`}>{activePet.element}</span>
          </p>
        </div>
        <div className="text-right">
          <Lives lives={activePet.lives ?? 3} />
          <p className="text-zinc-500 text-xs mt-1">{activePet.lives ?? 3}/3 vidas</p>
        </div>
      </div>

      {/* Lista de jogadores na arena */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-zinc-400 text-sm uppercase tracking-wider">Jogadores na Arena</h2>
          <button
            onClick={() => fetchArena(initialUser.id)}
            disabled={loadingArena}
            className="text-xs text-zinc-500 hover:text-white transition-colors disabled:opacity-50"
          >
            {loadingArena ? 'Atualizando...' : '↻ Atualizar'}
          </button>
        </div>

        {loadingArena && (
          <div className="text-center py-8 text-zinc-500 text-sm">Buscando jogadores...</div>
        )}

        {!loadingArena && arenaPlayers.length === 0 && (
          <div className="text-center py-10 space-y-2">
            <p className="text-4xl">🏜️</p>
            <p className="text-zinc-400 text-sm">Nenhum jogador na arena no momento.</p>
            <p className="text-zinc-600 text-xs">Você já está registrado! Aguarde outros jogadores entrarem.</p>
          </div>
        )}

        {arenaPlayers.map(entry => {
          const adv = getElementAdvantage(activePet.element, entry.pet.element as any)
          const advLabel =
            adv === 'strong' ? '⚡ Vantagem' :
            adv === 'weak'   ? '💨 Desvantagem' : '— Neutro'
          const advColor =
            adv === 'strong' ? 'text-green-400' :
            adv === 'weak'   ? 'text-red-400'   : 'text-zinc-400'

          const displayName = entry.globalName ?? entry.username

          return (
            <div
              key={entry.discordId}
              className="flex items-center gap-3 bg-zinc-800/60 border border-zinc-700 hover:border-yellow-400/40 rounded-xl p-3 transition-all"
            >
              {/* Avatar do jogador */}
              <div className="shrink-0 relative">
                {entry.avatar ? (
                  <img
                    src={`https://cdn.discordapp.com/avatars/${entry.discordId}/${entry.avatar}.png?size=64`}
                    className="w-10 h-10 rounded-full border-2 border-zinc-600"
                    alt={displayName}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-400 text-sm font-bold border-2 border-zinc-600">
                    {displayName[0]?.toUpperCase()}
                  </div>
                )}
              </div>

              {/* Pet do oponente */}
              <PetAnimator petId={entry.pet.petId} anim="idle" width={56} height={56} fps={8} />

              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{displayName}</p>
                <p className="text-zinc-500 text-xs">
                  {entry.pet.name} · Nv.{entry.pet.level}
                </p>
                <p className="text-xs">
                  {(ELEMENT_EMOJI as Record<string, string>)[entry.pet.element] ?? '?'}
                  <span className={`ml-1 ${(ELEMENT_COLOR as Record<string, string>)[entry.pet.element] ?? 'text-zinc-400'}`}>
                    {entry.pet.element}
                  </span>
                  <span className={`ml-2 text-xs ${advColor}`}>{advLabel}</span>
                </p>
              </div>

              <div className="text-right shrink-0">
                <p className="text-yellow-400 text-xs font-bold mb-1">
                  +{Math.max(20, entry.pet.level * 15)} pts
                </p>
                <button
                  onClick={() => handleStartBattle(entry)}
                  className="px-3 py-1.5 bg-red-500 hover:bg-red-400 text-white text-xs font-bold rounded-lg transition-all hover:scale-105"
                >
                  Lutar
                </button>
              </div>
            </div>
          )
        })}
      </section>
    </div>
  )
}
