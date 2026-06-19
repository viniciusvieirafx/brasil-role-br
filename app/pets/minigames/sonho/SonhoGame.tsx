'use client'

import { useEffect, useRef, useState } from 'react'
import { loadData, saveData, addPoints } from '@/lib/petStore'
import GameTutorial, { TutorialButton } from '@/components/pets/GameTutorial'
import PetSprite from '@/components/pets/PetSprite'

interface DiscordUser { id: string; username: string; avatar: string | null; globalName: string | null }

const GAME_DURATION = 45
const NIGHTMARE_EMOJIS = ['👻', '😈', '🕷️', '🐍', '💀', '👁️']

interface Nightmare {
  id: number
  emoji: string
  progress: number   // 0 → 100
  speed: number
  side: 'left' | 'right'
  row: number        // vertical position (0-3)
  sizeClass: string
}

let nextNightmareId = 0

export default function SonhoGame({ initialUser }: { initialUser: DiscordUser | null }) {
  const [phase, setPhase] = useState<'idle' | 'tutorial' | 'playing' | 'over'>('idle')
  const [nightmares, setNightmares] = useState<Nightmare[]>([])
  const [dreamHP, setDreamHP] = useState(100)
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
  const [earned, setEarned] = useState(0)

  const nightmaresRef = useRef<Nightmare[]>([])
  const dreamHPRef = useRef(100)
  const scoreRef = useRef(0)
  const timeRef = useRef(GAME_DURATION)
  const aliveRef = useRef(false)
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const spawnIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const difficultyRef = useRef(0)

  const petId = initialUser ? (() => {
    const d = loadData(initialUser.id)
    return d.ownedPets.find(p => p.instanceId === d.activePetId)?.petId ?? 1
  })() : 1

  function stopAll() {
    aliveRef.current = false
    if (tickIntervalRef.current) clearInterval(tickIntervalRef.current)
    if (spawnIntervalRef.current) clearInterval(spawnIntervalRef.current)
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
  }

  function endGame() {
    stopAll()
    const pts = scoreRef.current * 4
    setEarned(pts)
    setPhase('over')
    if (initialUser) {
      let d = loadData(initialUser.id)
      d = addPoints(d, pts)
      saveData(d)
    }
  }

  function spawnNightmare(difficulty: number) {
    const side: 'left' | 'right' = Math.random() < 0.5 ? 'left' : 'right'
    const speed = 1.2 + difficulty * 0.3 + Math.random() * 0.8
    const sizeClasses = ['text-2xl', 'text-3xl', 'text-4xl']
    const sizeIdx = speed > 2.5 ? 2 : speed > 1.8 ? 1 : 0
    nextNightmareId++
    const nm: Nightmare = {
      id: nextNightmareId,
      emoji: NIGHTMARE_EMOJIS[Math.floor(Math.random() * NIGHTMARE_EMOJIS.length)],
      progress: 0,
      speed,
      side,
      row: Math.floor(Math.random() * 4),
      sizeClass: sizeClasses[sizeIdx],
    }
    nightmaresRef.current = [...nightmaresRef.current, nm]
    setNightmares([...nightmaresRef.current])
  }

  function startGame() {
    stopAll()
    nightmaresRef.current = []
    dreamHPRef.current = 100
    scoreRef.current = 0
    timeRef.current = GAME_DURATION
    difficultyRef.current = 0
    aliveRef.current = true
    nextNightmareId = 0
    setNightmares([])
    setDreamHP(100)
    setScore(0)
    setTimeLeft(GAME_DURATION)
    setPhase('playing')

    // Tick: advance nightmare progress every 100ms
    tickIntervalRef.current = setInterval(() => {
      if (!aliveRef.current) return
      const updated: Nightmare[] = []
      let dmg = 0
      for (const nm of nightmaresRef.current) {
        const newProg = nm.progress + nm.speed
        if (newProg >= 100) {
          dmg += 20
        } else {
          updated.push({ ...nm, progress: newProg })
        }
      }
      nightmaresRef.current = updated
      setNightmares([...updated])
      if (dmg > 0) {
        const newHP = Math.max(0, dreamHPRef.current - dmg)
        dreamHPRef.current = newHP
        setDreamHP(newHP)
        if (newHP <= 0) { endGame() }
      }
    }, 100)

    // Spawn interval: starts at 3000ms, decreases with difficulty
    function scheduleSpawn() {
      if (!aliveRef.current) return
      spawnNightmare(difficultyRef.current)
      const nextDelay = Math.max(800, 3000 - difficultyRef.current * 220)
      spawnIntervalRef.current = setTimeout(scheduleSpawn, nextDelay)
    }
    spawnIntervalRef.current = setTimeout(scheduleSpawn, 1000)

    // Timer
    timerIntervalRef.current = setInterval(() => {
      if (!aliveRef.current) return
      const newTime = Math.max(0, timeRef.current - 1)
      timeRef.current = newTime
      difficultyRef.current = Math.floor((GAME_DURATION - newTime) / 8)
      setTimeLeft(newTime)
      if (newTime <= 0) { endGame() }
    }, 1000)
  }

  function killNightmare(id: number) {
    if (!aliveRef.current) return
    nightmaresRef.current = nightmaresRef.current.filter(nm => nm.id !== id)
    setNightmares([...nightmaresRef.current])
    scoreRef.current++
    setScore(scoreRef.current)
  }

  useEffect(() => {
    return () => stopAll()
  }, [])

  if (!initialUser) return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <p className="text-zinc-400">Faça login para jogar.</p>
    </div>
  )

  const steps = [
    { emoji: '🎯', title: 'Objetivo',       desc: 'Proteja o bichinho dormindo! Elimine os pesadelos antes que cheguem ao centro.' },
    { emoji: '👆', title: 'Eliminar',        desc: 'Clique ou toque nos pesadelos para eliminá-los.' },
    { emoji: '💙', title: 'HP do Sonho',     desc: 'Se um pesadelo chegar ao centro, tira 20 de HP. Se o HP zerar, o sonho acaba!' },
    { emoji: '⚡', title: 'Dificuldade',    desc: 'Com o tempo, os pesadelos ficam mais rápidos e aparecem com mais frequência.' },
    { emoji: '⏱', title: 'Tempo',           desc: `Sobreviva por ${GAME_DURATION} segundos para completar o sonho.` },
    { emoji: '⭐', title: 'Pontos',         desc: 'Cada pesadelo eliminado vale 4 pontos.' },
  ]

  const hpPercent = dreamHP
  const hpColor = hpPercent > 60 ? 'from-blue-500 to-cyan-400' : hpPercent > 30 ? 'from-yellow-500 to-orange-400' : 'from-red-600 to-red-400'

  const rowTops = ['15%', '30%', '55%', '70%']

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">💤 Sonho</h1>
        <div className="flex items-center gap-3">
          {phase === 'playing' && (
            <div className="flex gap-3 items-center text-sm">
              <span className="text-zinc-400">⏱ {timeLeft}s</span>
              <span className="text-white font-bold">{score} pts</span>
            </div>
          )}
          <TutorialButton onClick={() => { stopAll(); setPhase('tutorial') }} />
        </div>
      </div>

      {(phase === 'idle' || phase === 'tutorial') && (
        <GameTutorial
          title="Sonho"
          emoji="💤"
          startColor="bg-violet-500 hover:bg-violet-400"
          startLabel={phase === 'tutorial' ? 'Voltar ao início' : 'Começar!'}
          onStart={() => phase === 'tutorial' ? setPhase('idle') : startGame()}
          steps={steps}
        />
      )}

      {phase === 'playing' && (
        <div className="space-y-3">
          {/* Dream HP bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-zinc-400">
              <span>💙 HP do Sonho</span>
              <span>{dreamHP}/100</span>
            </div>
            <div className="w-full h-4 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r transition-all duration-300 ${hpColor}`}
                style={{ width: `${hpPercent}%` }}
              />
            </div>
          </div>

          {/* Game arena */}
          <div
            className="relative w-full rounded-2xl border-2 border-zinc-700 overflow-hidden"
            style={{ height: 300, background: 'radial-gradient(ellipse at center, #1a0a3a 0%, #050310 100%)' }}
          >
            {/* Stars */}
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-1 bg-white rounded-full opacity-40"
                style={{ left: `${(i * 17 + 3) % 100}%`, top: `${(i * 13 + 5) % 80}%` }}
              />
            ))}

            {/* Pet sleeping in center */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-1">
                <PetSprite petId={petId} size={72} />
                <span className="text-lg animate-bounce">💤</span>
              </div>
            </div>

            {/* Nightmares */}
            {nightmares.map(nm => {
              const leftPct = nm.side === 'left' ? nm.progress * 0.45 : undefined
              const rightPct = nm.side === 'right' ? nm.progress * 0.45 : undefined
              return (
                <button
                  key={nm.id}
                  onClick={() => killNightmare(nm.id)}
                  className={`absolute ${nm.sizeClass} cursor-pointer select-none transition-none hover:scale-125 active:scale-90 z-10`}
                  style={{
                    top: rowTops[nm.row],
                    ...(leftPct !== undefined ? { left: `${leftPct}%` } : {}),
                    ...(rightPct !== undefined ? { right: `${rightPct}%` } : {}),
                    transform: nm.side === 'right' ? 'scaleX(-1)' : undefined,
                  }}
                  aria-label={`Pesadelo ${nm.emoji}`}
                >
                  {nm.emoji}
                </button>
              )
            })}
          </div>

          <p className="text-center text-zinc-600 text-xs">Clique nos pesadelos antes que cheguem ao bichinho!</p>
        </div>
      )}

      {phase === 'over' && (
        <div className="text-center space-y-4 py-8">
          <div className="text-5xl">{dreamHP > 0 ? '🌟' : '😱'}</div>
          <h2 className="text-white text-2xl font-bold">
            {dreamHP > 0 ? 'Sonho protegido!' : 'Pesadelo venceu!'}
          </h2>
          <p className="text-zinc-400">Pesadelos eliminados: <span className="text-white font-bold">{score}</span></p>
          <p className="text-yellow-400 font-bold">+{earned} pontos ganhos!</p>
          <button onClick={startGame}
            className="px-8 py-3 bg-violet-500 hover:bg-violet-400 text-white font-bold rounded-xl transition-all hover:scale-105">
            Sonhar Novamente
          </button>
        </div>
      )}
    </div>
  )
}
