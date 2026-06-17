'use client'

import { useEffect, useRef, useState } from 'react'
import PetSprite from '@/components/pets/PetSprite'
import { loadData, saveData, addPoints } from '@/lib/petStore'

interface DiscordUser { id: string; username: string; avatar: string | null; globalName: string | null }

interface DirtSpot {
  id: number
  x: number   // % within pet area
  y: number
  size: number
  cleaned: boolean
}

const MAX_DIRTY = 8
const SPAWN_INTERVAL_START = 1500 // ms

export default function BanhoGame({ initialUser }: { initialUser: DiscordUser | null }) {
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'over'>('idle')
  const [spots, setSpots] = useState<DirtSpot[]>([])
  const [score, setScore] = useState(0)
  const [cleanliness, setCleanliness] = useState(100)
  const [timeLeft, setTimeLeft] = useState(45)
  const [earned, setEarned] = useState(0)
  const nextId = useRef(0)
  const scoreRef = useRef(0)
  const spawnRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const difficultyRef = useRef(0)

  const petId = (() => {
    if (!initialUser) return 1
    const d = loadData(initialUser.id)
    return d.ownedPets.find(p => p.instanceId === d.activePetId)?.petId ?? 1
  })()

  function startGame() {
    nextId.current = 0
    scoreRef.current = 0
    difficultyRef.current = 0
    setSpots([])
    setScore(0)
    setCleanliness(100)
    setTimeLeft(45)
    setGameState('playing')
  }

  function endGame() {
    if (spawnRef.current) clearInterval(spawnRef.current)
    if (timerRef.current) clearInterval(timerRef.current)
    setGameState('over')
    const pts = scoreRef.current * 3
    setEarned(pts)
    if (initialUser) {
      const d = loadData(initialUser.id)
      saveData(addPoints(d, pts))
    }
  }

  useEffect(() => {
    if (gameState !== 'playing') return

    function spawnSpot() {
      setSpots(prev => {
        const dirty = prev.filter(s => !s.cleaned)
        if (dirty.length >= MAX_DIRTY) {
          endGame()
          return prev
        }
        const newSpot: DirtSpot = {
          id: nextId.current++,
          x: 15 + Math.random() * 70,
          y: 15 + Math.random() * 70,
          size: 20 + Math.random() * 25,
          cleaned: false,
        }
        const newSpots = [...prev.filter(s => !s.cleaned || s.id > nextId.current - 5), newSpot]
        const dirtyCount = newSpots.filter(s => !s.cleaned).length
        setCleanliness(Math.max(0, 100 - dirtyCount * (100 / MAX_DIRTY)))
        return newSpots
      })
    }

    // Increase spawn rate over time
    function scheduleSpawn() {
      difficultyRef.current++
      const interval = Math.max(600, SPAWN_INTERVAL_START - difficultyRef.current * 80)
      spawnRef.current = setTimeout(() => {
        spawnSpot()
        scheduleSpawn()
      }, interval) as any
    }
    scheduleSpawn()

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { endGame(); return 0 }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (spawnRef.current) clearTimeout(spawnRef.current as any)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [gameState])

  function cleanSpot(id: number) {
    setSpots(prev => {
      const updated = prev.map(s => s.id === id && !s.cleaned ? { ...s, cleaned: true } : s)
      const dirtyCount = updated.filter(s => !s.cleaned).length
      setCleanliness(Math.max(0, 100 - dirtyCount * (100 / MAX_DIRTY)))
      return updated
    })
    scoreRef.current++
    setScore(s => s + 1)
  }

  if (!initialUser) return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <p className="text-zinc-400">Faça login para jogar.</p>
    </div>
  )

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">🛁 Banho</h1>
        {gameState === 'playing' && (
          <div className="flex gap-4 items-center text-sm">
            <span className="text-zinc-400">⏱ {timeLeft}s</span>
            <span className="text-white font-bold">🧼 {score}</span>
          </div>
        )}
      </div>

      {gameState === 'idle' && (
        <div className="text-center space-y-4 py-8">
          <PetSprite petId={petId} size={100} animate className="mx-auto" />
          <p className="text-zinc-400">Clique nas manchas para limpar o bichinho!</p>
          <p className="text-zinc-500 text-sm">As manchas aparecem mais rápido com o tempo. Não deixe acumular!</p>
          <button onClick={startGame}
            className="px-8 py-3 bg-blue-500 hover:bg-blue-400 text-white font-bold rounded-xl transition-all hover:scale-105">
            Começar!
          </button>
        </div>
      )}

      {gameState === 'playing' && (
        <div className="space-y-3">
          {/* Cleanliness bar */}
          <div>
            <div className="flex justify-between text-xs text-zinc-500 mb-1">
              <span>Limpeza</span><span>{Math.round(cleanliness)}%</span>
            </div>
            <div className="bg-zinc-800 rounded-full h-3 overflow-hidden">
              <div className={`h-full transition-all duration-300 rounded-full ${
                cleanliness > 60 ? 'bg-blue-400' : cleanliness > 30 ? 'bg-yellow-400' : 'bg-red-500'
              }`} style={{ width: `${cleanliness}%` }} />
            </div>
          </div>

          {/* Pet + dirt spots */}
          <div className="relative flex items-center justify-center bg-zinc-900 border-2 border-zinc-700 rounded-2xl overflow-hidden select-none"
            style={{ height: '360px' }}>
            {/* Bubbles decoration */}
            <div className="absolute inset-0 flex items-end pb-4 justify-center opacity-30">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="text-2xl mx-1 animate-bounce" style={{ animationDelay: `${i * 0.2}s` }}>🫧</div>
              ))}
            </div>

            {/* Pet */}
            <div className="relative z-10">
              <PetSprite petId={petId} size={140} />

              {/* Dirt spots overlay */}
              {spots.filter(s => !s.cleaned).map(s => (
                <button
                  key={s.id}
                  onClick={() => cleanSpot(s.id)}
                  className="absolute rounded-full cursor-pointer hover:scale-75 transition-transform"
                  style={{
                    left: `${s.x}%`,
                    top: `${s.y}%`,
                    width: s.size,
                    height: s.size,
                    background: 'radial-gradient(circle, #78350f 0%, #451a03 60%, transparent 80%)',
                    transform: 'translate(-50%, -50%)',
                  }}
                  title="Limpar"
                />
              ))}
            </div>
          </div>

          <p className="text-center text-zinc-500 text-sm">Toque nas manchas marrons para limpar!</p>
        </div>
      )}

      {gameState === 'over' && (
        <div className="text-center space-y-4 py-8">
          <div className="text-5xl">{score >= 15 ? '✨' : '🛁'}</div>
          <h2 className="text-white text-2xl font-bold">{score >= 15 ? 'Bichinho limpinho!' : 'Acabou o tempo!'}</h2>
          <p className="text-zinc-400">{score} manchas removidas</p>
          {initialUser && <p className="text-yellow-400 font-bold">+{earned} pontos ganhos!</p>}
          <button onClick={startGame}
            className="px-8 py-3 bg-blue-500 hover:bg-blue-400 text-white font-bold rounded-xl transition-all hover:scale-105">
            Jogar Novamente
          </button>
        </div>
      )}
    </div>
  )
}
