'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { loadData, saveData, addPoints, addXpBoostToActivePet } from '@/lib/petStore'
import GameTutorial, { TutorialButton } from '@/components/pets/GameTutorial'

interface DiscordUser { id: string; username: string; avatar: string | null; globalName: string | null }

type Direction = 'up' | 'down' | 'left' | 'right'
type Phase = 'idle' | 'tutorial' | 'show' | 'input' | 'feedback_ok' | 'feedback_fail' | 'over'

const DIR_EMOJI: Record<Direction, string> = { up: '⬆️', down: '⬇️', left: '⬅️', right: '➡️' }
const DIR_COLORS: Record<Direction, string> = {
  up: 'border-blue-500 bg-blue-900/40 text-blue-300',
  down: 'border-purple-500 bg-purple-900/40 text-purple-300',
  left: 'border-orange-500 bg-orange-900/40 text-orange-300',
  right: 'border-green-500 bg-green-900/40 text-green-300',
}
const DIR_HIGHLIGHT: Record<Direction, string> = {
  up: 'border-blue-300 bg-blue-500 text-white shadow-lg shadow-blue-500/50',
  down: 'border-purple-300 bg-purple-500 text-white shadow-lg shadow-purple-500/50',
  left: 'border-orange-300 bg-orange-500 text-white shadow-lg shadow-orange-500/50',
  right: 'border-green-300 bg-green-500 text-white shadow-lg shadow-green-500/50',
}

const DIRS: Direction[] = ['up', 'down', 'left', 'right']

function randomDir(): Direction {
  return DIRS[Math.floor(Math.random() * DIRS.length)]
}

export default function DancaGame({ initialUser }: { initialUser: DiscordUser | null }) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('idle')
  const [sequence, setSequence] = useState<Direction[]>([])
  const [showIdx, setShowIdx] = useState(-1)
  const [inputIdx, setInputIdx] = useState(0)
  const [highlighted, setHighlighted] = useState<Direction | null>(null)
  const [lives, setLives] = useState(3)
  const [score, setScore] = useState(0)
  const [statusMsg, setStatusMsg] = useState('')
  const [earned, setEarned] = useState(0)

  // Refs for stable access in event listeners
  const phaseRef = useRef<Phase>('idle')
  const sequenceRef = useRef<Direction[]>([])
  const inputIdxRef = useRef(0)
  const livesRef = useRef(3)
  const scoreRef = useRef(0)
  const handleInputRef = useRef<((dir: Direction) => void) | null>(null)

  function syncPhase(p: Phase) { phaseRef.current = p; setPhase(p) }

  function startGame() {
    const firstSeq = [randomDir()]
    sequenceRef.current = firstSeq
    inputIdxRef.current = 0
    livesRef.current = 3
    scoreRef.current = 0
    setSequence(firstSeq)
    setInputIdx(0)
    setLives(3)
    setScore(0)
    setShowIdx(-1)
    setHighlighted(null)
    syncPhase('show')
  }

  // Show phase: step through sequence
  useEffect(() => {
    if (phase !== 'show') return
    setShowIdx(-1)
    setHighlighted(null)
    setStatusMsg('Memorize...')

    let idx = 0
    const seq = sequenceRef.current

    function showNext() {
      if (idx >= seq.length) {
        setShowIdx(seq.length)
        setHighlighted(null)
        syncPhase('input')
        setStatusMsg('Sua vez!')
        return
      }
      const dir = seq[idx]
      setShowIdx(idx)
      setHighlighted(dir)
      const t1 = setTimeout(() => {
        setHighlighted(null)
        idx++
        const t2 = setTimeout(showNext, 300)
        return () => clearTimeout(t2)
      }, 450)
      return () => clearTimeout(t1)
    }

    const initTimer = setTimeout(showNext, 400)
    return () => clearTimeout(initTimer)
  }, [phase, sequence.length])

  // Handle input
  const handleInput = useCallback((dir: Direction) => {
    if (phaseRef.current !== 'input') return
    const seq = sequenceRef.current
    const idx = inputIdxRef.current
    setHighlighted(dir)
    setTimeout(() => setHighlighted(null), 200)

    if (dir === seq[idx]) {
      // Correct
      const nextIdx = idx + 1
      inputIdxRef.current = nextIdx
      setInputIdx(nextIdx)
      if (nextIdx >= seq.length) {
        // Round complete
        const newScore = scoreRef.current + seq.length * 3
        scoreRef.current = newScore
        setScore(newScore)
        syncPhase('feedback_ok')
        setStatusMsg('✅ Perfeito!')
        setTimeout(() => {
          const newSeq = [...seq, randomDir()]
          sequenceRef.current = newSeq
          inputIdxRef.current = 0
          setSequence(newSeq)
          setInputIdx(0)
          syncPhase('show')
        }, 700)
      }
    } else {
      // Wrong
      const newLives = livesRef.current - 1
      livesRef.current = newLives
      setLives(newLives)
      syncPhase('feedback_fail')
      setStatusMsg('❌ Errou!')
      setTimeout(() => {
        if (newLives <= 0) {
          // Game over
          const pts = scoreRef.current
          const xpBoost = Math.floor(pts / 3)
          setEarned(pts)
          syncPhase('over')
          if (initialUser) {
            let d = loadData(initialUser.id)
            d = addPoints(d, pts)
            if (xpBoost > 0) d = addXpBoostToActivePet(d, xpBoost)
            saveData(d)
          }
        } else {
          // Retry same sequence
          inputIdxRef.current = 0
          setInputIdx(0)
          syncPhase('show')
        }
      }, 700)
    }
  }, [initialUser])

  handleInputRef.current = handleInput

  // Keyboard listener (stable via ref)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (phaseRef.current !== 'input') return
      const map: Record<string, Direction> = {
        ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      }
      const dir = map[e.code]
      if (dir) { e.preventDefault(); handleInputRef.current?.(dir) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!initialUser) return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <p className="text-zinc-400">Faça login para jogar.</p>
    </div>
  )

  const livesDisplay = Array.from({ length: 3 }, (_, i) => i < lives ? '❤️' : '🖤').join('')

  const steps = [
    { emoji: '🎯', title: 'Objetivo',       desc: 'Memorize e repita sequências de setas. Cada rodada fica mais longa!' },
    { emoji: '👀', title: 'Observe',        desc: 'Na fase "Memorize...", os botões acendem um a um. Grave a ordem na memória — não aparece depois!' },
    { emoji: '🕹️', title: 'Repita',         desc: 'Na fase "Sua vez!", pressione os botões na mesma ordem. Use as setas do teclado também!' },
    { emoji: '❤️', title: 'Vidas',          desc: 'Você tem 3 vidas. Cada erro custa uma vida.' },
    { emoji: '📈', title: 'Dificuldade',    desc: 'A cada rodada completada, mais uma seta é adicionada à sequência.' },
    { emoji: '⭐', title: 'Recompensa',     desc: 'Pontos = tamanho da sequência × 3. Quanto mais longe chegar, mais pontos e XP!' },
  ]

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">🎵 Dança</h1>
        <div className="flex items-center gap-3">
          {(phase === 'show' || phase === 'input' || phase === 'feedback_ok' || phase === 'feedback_fail') && (
            <div className="flex gap-3 items-center text-sm">
              <span className="text-white font-bold">{score} pts</span>
              <span>{livesDisplay}</span>
            </div>
          )}
          <TutorialButton onClick={() => { syncPhase('tutorial') }} />
        </div>
      </div>

      {(phase === 'idle' || phase === 'tutorial') && (
        <GameTutorial
          title="Dança"
          emoji="🎵"
          startColor="bg-pink-500 hover:bg-pink-400"
          startLabel={phase === 'tutorial' ? 'Voltar ao início' : 'Começar!'}
          onStart={() => phase === 'tutorial' ? syncPhase('idle') : startGame()}
          steps={steps}
        />
      )}

      {(phase === 'show' || phase === 'input' || phase === 'feedback_ok' || phase === 'feedback_fail') && (
        <div className="space-y-6">
          {/* Progress dots — só mostra quantidade, não as direções */}
          <div className="bg-zinc-800 rounded-2xl p-4 min-h-[60px] flex flex-col items-center justify-center gap-2">
            <div className="flex gap-2">
              {sequence.map((_, i) => (
                <span key={i} className={`w-3 h-3 rounded-full transition-all ${
                  phase === 'input' && i < inputIdx ? 'bg-green-400' :
                  phase === 'show' && i === showIdx ? 'bg-white scale-125' :
                  'bg-zinc-600'
                }`} />
              ))}
            </div>
            <span className="text-zinc-500 text-xs">{sequence.length} movimento{sequence.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Status message */}
          <div className="text-center h-8">
            <span className={`text-lg font-bold ${
              statusMsg.includes('✅') ? 'text-green-400' :
              statusMsg.includes('❌') ? 'text-red-400' :
              statusMsg === 'Sua vez!' ? 'text-yellow-400' : 'text-zinc-400'
            }`}>{statusMsg}</span>
          </div>

          {/* Diamond layout */}
          <div className="relative flex flex-col items-center gap-2">
            {/* Up */}
            <button
              onClick={() => handleInput('up')}
              disabled={phase !== 'input'}
              className={`w-16 h-16 rounded-xl border-2 text-3xl font-bold transition-all select-none
                ${highlighted === 'up' ? DIR_HIGHLIGHT['up'] : DIR_COLORS['up']}
                ${phase !== 'input' ? 'opacity-60 cursor-default' : 'hover:scale-105 active:scale-95'}`}
            >
              ⬆️
            </button>
            {/* Left / Right row */}
            <div className="flex gap-16">
              <button
                onClick={() => handleInput('left')}
                disabled={phase !== 'input'}
                className={`w-16 h-16 rounded-xl border-2 text-3xl font-bold transition-all select-none
                  ${highlighted === 'left' ? DIR_HIGHLIGHT['left'] : DIR_COLORS['left']}
                  ${phase !== 'input' ? 'opacity-60 cursor-default' : 'hover:scale-105 active:scale-95'}`}
              >
                ⬅️
              </button>
              <button
                onClick={() => handleInput('right')}
                disabled={phase !== 'input'}
                className={`w-16 h-16 rounded-xl border-2 text-3xl font-bold transition-all select-none
                  ${highlighted === 'right' ? DIR_HIGHLIGHT['right'] : DIR_COLORS['right']}
                  ${phase !== 'input' ? 'opacity-60 cursor-default' : 'hover:scale-105 active:scale-95'}`}
              >
                ➡️
              </button>
            </div>
            {/* Down */}
            <button
              onClick={() => handleInput('down')}
              disabled={phase !== 'input'}
              className={`w-16 h-16 rounded-xl border-2 text-3xl font-bold transition-all select-none
                ${highlighted === 'down' ? DIR_HIGHLIGHT['down'] : DIR_COLORS['down']}
                ${phase !== 'input' ? 'opacity-60 cursor-default' : 'hover:scale-105 active:scale-95'}`}
            >
              ⬇️
            </button>
          </div>

          <p className="text-center text-zinc-600 text-xs">Use as setas do teclado ou toque nos botões</p>
        </div>
      )}

      {phase === 'over' && (
        <div className="text-center space-y-4 py-8">
          <div className="text-5xl">🎵</div>
          <h2 className="text-white text-2xl font-bold">Fim de jogo!</h2>
          <p className="text-zinc-400">Sequência máxima: <span className="text-white font-bold">{sequence.length}</span> movimentos</p>
          <p className="text-yellow-400 font-bold">+{earned} pontos ganhos!</p>
          <p className="text-blue-400 text-sm">+{Math.floor(earned / 3)} XP de bônus!</p>
          <button onClick={startGame}
            className="px-8 py-3 bg-pink-500 hover:bg-pink-400 text-white font-bold rounded-xl transition-all hover:scale-105">
            Jogar Novamente
          </button>
          <button onClick={() => router.push('/pets')}
            className="px-8 py-3 bg-zinc-700 hover:bg-zinc-600 text-white font-bold rounded-xl transition-all hover:scale-105">
            ← Ver meu bichinho
          </button>
        </div>
      )}
    </div>
  )
}
