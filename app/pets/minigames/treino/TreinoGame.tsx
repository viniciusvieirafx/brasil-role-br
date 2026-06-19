'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { loadData, saveData, addPoints, addXpBoostToActivePet } from '@/lib/petStore'
import GameTutorial, { TutorialButton } from '@/components/pets/GameTutorial'

interface DiscordUser { id: string; username: string; avatar: string | null; globalName: string | null }

const GAME_DURATION = 30
const EXERCISES = ['Flexão 🏋️', 'Agachamento 🦵', 'Pulo ⬆️', 'Corrida 🏃']

function getGreenZone(reps: number): [number, number] {
  const sets = Math.floor(reps / 5)
  const half = Math.max(7, 15 - sets * 1.5)
  return [50 - half, 50 + half]
}

function getSpeed(reps: number): number {
  const sets = Math.floor(reps / 5)
  return Math.min(2.5, 0.8 + sets * 0.34)
}

export default function TreinoGame({ initialUser }: { initialUser: DiscordUser | null }) {
  const [phase, setPhase] = useState<'idle' | 'tutorial' | 'playing' | 'over'>('idle')
  const [barPos, setBarPos] = useState(0)
  const [reps, setReps] = useState(0)
  const [misses, setMisses] = useState(0)
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
  const [flashMsg, setFlashMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [earned, setEarned] = useState(0)

  const barPosRef = useRef(0)
  const dirRef = useRef(1)  // 1 = moving right, -1 = moving left
  const repsRef = useRef(0)
  const timeRef = useRef(GAME_DURATION)
  const aliveRef = useRef(false)
  const rafRef = useRef(0)
  const lastFrameRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleTapRef = useRef<(() => void) | null>(null)

  function stopAll() {
    aliveRef.current = false
    cancelAnimationFrame(rafRef.current)
    if (timerRef.current) clearInterval(timerRef.current)
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
  }

  function endGame() {
    stopAll()
    const pts = repsRef.current * 4
    setEarned(pts)
    setPhase('over')
    if (initialUser) {
      let d = loadData(initialUser.id)
      d = addPoints(d, pts)
      if (repsRef.current > 0) d = addXpBoostToActivePet(d, Math.floor(repsRef.current / 2))
      saveData(d)
    }
  }

  const animate = useCallback((now: number) => {
    if (!aliveRef.current) return
    const delta = Math.min(now - lastFrameRef.current, 50)
    lastFrameRef.current = now
    const dt = delta / (1000 / 60)
    const speed = getSpeed(repsRef.current)
    barPosRef.current += dirRef.current * speed * dt
    if (barPosRef.current >= 100) { barPosRef.current = 100; dirRef.current = -1 }
    if (barPosRef.current <= 0) { barPosRef.current = 0; dirRef.current = 1 }
    setBarPos(Math.round(barPosRef.current))
    rafRef.current = requestAnimationFrame(animate)
  }, [])

  function startGame() {
    stopAll()
    barPosRef.current = 0
    dirRef.current = 1
    repsRef.current = 0
    timeRef.current = GAME_DURATION
    aliveRef.current = true
    setBarPos(0)
    setReps(0)
    setMisses(0)
    setTimeLeft(GAME_DURATION)
    setFlashMsg(null)
    setPhase('playing')

    setTimeout(() => { lastFrameRef.current = performance.now(); rafRef.current = requestAnimationFrame(animate) }, 50)

    timerRef.current = setInterval(() => {
      if (!aliveRef.current) return
      const newTime = Math.max(0, timeRef.current - 1)
      timeRef.current = newTime
      setTimeLeft(newTime)
      if (newTime <= 0) endGame()
    }, 1000)
  }

  const handleTap = useCallback(() => {
    if (!aliveRef.current) return
    const pos = barPosRef.current
    const [gMin, gMax] = getGreenZone(repsRef.current)
    const isHit = pos >= gMin && pos <= gMax

    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    setFlashMsg({ text: isHit ? 'HIT! 💪' : 'MISS!', ok: isHit })
    flashTimerRef.current = setTimeout(() => setFlashMsg(null), 600)

    if (isHit) {
      repsRef.current++
      setReps(repsRef.current)
    } else {
      setMisses(m => m + 1)
    }
  }, [])

  handleTapRef.current = handleTap

  // Keyboard (spacebar) — stable via ref
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code === 'Space' && phase === 'playing') {
        e.preventDefault()
        handleTapRef.current?.()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase])

  useEffect(() => { return () => stopAll() }, [])

  if (!initialUser) return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <p className="text-zinc-400">Faça login para jogar.</p>
    </div>
  )

  const currentExercise = EXERCISES[Math.floor(reps / 5) % EXERCISES.length]
  const currentSet = Math.floor(reps / 5) + 1
  const [gMin, gMax] = getGreenZone(reps)

  const steps = [
    { emoji: '🎯', title: 'Objetivo',       desc: `Complete reps no ritmo certo em ${GAME_DURATION} segundos!` },
    { emoji: '🟢', title: 'Zona verde',     desc: 'A barra oscila. Toque/pressione Espaço quando o indicador estiver na zona verde do meio.' },
    { emoji: '📈', title: 'Dificuldade',    desc: 'A cada 5 reps, a zona verde fica menor e a barra fica mais rápida. Fique preciso!' },
    { emoji: '🏋️', title: 'Exercícios',     desc: 'A cada 5 reps completas, você muda de exercício: Flexão, Agachamento, Pulo e Corrida.' },
    { emoji: '⭐', title: 'Pontos',         desc: 'Cada rep vale 4 pontos. Reps também dão XP bônus para o seu bichinho!' },
    { emoji: '⌨️', title: 'Controles',      desc: 'Toque no botão grande ou pressione a barra de espaço para dar a rep.' },
  ]

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">💪 Treino</h1>
        <div className="flex items-center gap-3">
          {phase === 'playing' && (
            <div className="flex gap-3 items-center text-sm">
              <span className="text-zinc-400">⏱ {timeLeft}s</span>
              <span className="text-white font-bold">{reps} reps</span>
            </div>
          )}
          <TutorialButton onClick={() => { stopAll(); setPhase('tutorial') }} />
        </div>
      </div>

      {(phase === 'idle' || phase === 'tutorial') && (
        <GameTutorial
          title="Treino"
          emoji="💪"
          startColor="bg-yellow-500 hover:bg-yellow-400"
          startLabel={phase === 'tutorial' ? 'Voltar ao início' : 'Começar!'}
          onStart={() => phase === 'tutorial' ? setPhase('idle') : startGame()}
          steps={steps}
        />
      )}

      {phase === 'playing' && (
        <div className="space-y-6">
          {/* Exercise name */}
          <div className="text-center">
            <p className="text-zinc-400 text-sm">Exercício {currentSet}</p>
            <h2 className="text-white text-2xl font-bold">{currentExercise}</h2>
          </div>

          {/* Power bar */}
          <div className="space-y-2">
            <div className="relative w-full h-8 rounded-full overflow-hidden bg-zinc-800">
              {/* Red zones */}
              <div className="absolute inset-y-0 left-0 bg-red-600/80" style={{ width: '20%' }} />
              <div className="absolute inset-y-0 right-0 bg-red-600/80" style={{ width: '20%' }} />
              {/* Yellow zones */}
              <div className="absolute inset-y-0 bg-yellow-500/80" style={{ left: '20%', width: '20%' }} />
              <div className="absolute inset-y-0 bg-yellow-500/80" style={{ left: '60%', width: '20%' }} />
              {/* Green zone */}
              <div
                className="absolute inset-y-0 bg-green-500/90"
                style={{ left: `${gMin}%`, width: `${gMax - gMin}%` }}
              />
              {/* Indicator */}
              <div
                className="absolute top-1 bottom-1 w-3 rounded-full bg-white shadow-lg transition-none"
                style={{ left: `calc(${barPos}% - 6px)` }}
              />
            </div>
            <div className="flex justify-between text-xs text-zinc-500">
              <span>🔴 Fraco</span>
              <span>🟢 Perfeito!</span>
              <span>🔴 Fraco</span>
            </div>
          </div>

          {/* Flash message */}
          <div className="h-10 flex items-center justify-center">
            {flashMsg && (
              <span className={`text-2xl font-bold animate-pulse ${flashMsg.ok ? 'text-green-400' : 'text-red-400'}`}>
                {flashMsg.text}
              </span>
            )}
          </div>

          {/* Tap button */}
          <button
            onClick={handleTap}
            className="w-full py-5 bg-yellow-500 hover:bg-yellow-400 active:scale-95 text-white text-xl font-bold rounded-2xl transition-all select-none"
          >
            TAP! / Espaço
          </button>

          {/* Stats */}
          <div className="flex justify-around text-center text-sm text-zinc-400">
            <div><p className="text-white font-bold text-lg">{reps}</p><p>Reps</p></div>
            <div><p className="text-white font-bold text-lg">{currentSet}</p><p>Set</p></div>
            <div><p className="text-red-400 font-bold text-lg">{misses}</p><p>Erros</p></div>
          </div>
        </div>
      )}

      {phase === 'over' && (
        <div className="text-center space-y-4 py-8">
          <div className="text-5xl">💪</div>
          <h2 className="text-white text-2xl font-bold">Treino completo!</h2>
          <p className="text-zinc-400">Total de reps: <span className="text-white font-bold">{reps}</span></p>
          <p className="text-yellow-400 font-bold">+{earned} pontos ganhos!</p>
          <p className="text-blue-400 text-sm">+{Math.floor(reps / 2)} XP de bônus!</p>
          <button onClick={startGame}
            className="px-8 py-3 bg-yellow-500 hover:bg-yellow-400 text-white font-bold rounded-xl transition-all hover:scale-105">
            Treinar Novamente
          </button>
        </div>
      )}
    </div>
  )
}
