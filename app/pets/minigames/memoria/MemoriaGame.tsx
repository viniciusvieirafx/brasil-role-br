'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { loadData, saveData, addPoints } from '@/lib/petStore'
import GameTutorial, { TutorialButton } from '@/components/pets/GameTutorial'

interface DiscordUser { id: string; username: string; avatar: string | null; globalName: string | null }

const EMOJIS = ['🐉', '🦊', '🐼', '🦁', '🐸', '🦋', '🐧', '🦄']
const PAIR_COLORS = [
  'border-red-500 shadow-red-500/30',
  'border-orange-500 shadow-orange-500/30',
  'border-yellow-500 shadow-yellow-500/30',
  'border-green-500 shadow-green-500/30',
  'border-cyan-500 shadow-cyan-500/30',
  'border-blue-500 shadow-blue-500/30',
  'border-purple-500 shadow-purple-500/30',
  'border-pink-500 shadow-pink-500/30',
]

interface Card {
  id: number
  emoji: string
  pairIdx: number   // 0-7 (which pair)
  flipped: boolean
  matched: boolean
}

function shuffleCards(): Card[] {
  const cards: Card[] = []
  EMOJIS.forEach((emoji, i) => {
    cards.push({ id: i * 2, emoji, pairIdx: i, flipped: false, matched: false })
    cards.push({ id: i * 2 + 1, emoji, pairIdx: i, flipped: false, matched: false })
  })
  // Fisher-Yates shuffle
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]]
  }
  return cards
}

export default function MemoriaGame({ initialUser }: { initialUser: DiscordUser | null }) {
  const router = useRouter()
  const [phase, setPhase] = useState<'idle' | 'tutorial' | 'playing' | 'over'>('idle')
  const [cards, setCards] = useState<Card[]>([])
  const [moves, setMoves] = useState(0)
  const [matched, setMatched] = useState(0)
  const [timeElapsed, setTimeElapsed] = useState(0)
  const [earned, setEarned] = useState(0)
  const [locked, setLocked] = useState(false)

  const cardsRef = useRef<Card[]>([])
  const movesRef = useRef(0)
  const matchedRef = useRef(0)
  const flippedRef = useRef<number[]>([])  // ids of currently face-up but unmatched cards
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeRef = useRef(0)
  const startedRef = useRef(false)

  function stopTimer() {
    if (timerRef.current) clearInterval(timerRef.current)
  }

  function startTimer() {
    stopTimer()
    timerRef.current = setInterval(() => {
      timeRef.current++
      setTimeElapsed(timeRef.current)
    }, 1000)
  }

  function startGame() {
    stopTimer()
    const fresh = shuffleCards()
    cardsRef.current = fresh
    movesRef.current = 0
    matchedRef.current = 0
    flippedRef.current = []
    timeRef.current = 0
    startedRef.current = false
    setCards(fresh)
    setMoves(0)
    setMatched(0)
    setTimeElapsed(0)
    setLocked(false)
    setEarned(0)
    setPhase('playing')
  }

  function endGame() {
    stopTimer()
    const timeBonus = Math.max(0, 100 - timeRef.current)
    const pts = Math.max(50, 200 - movesRef.current * 3) + timeBonus
    setEarned(pts)
    setPhase('over')
    if (initialUser) {
      let d = loadData(initialUser.id)
      d = addPoints(d, pts)
      saveData(d)
    }
  }

  function handleCardClick(cardId: number) {
    if (locked) return
    const c = cardsRef.current.find(c => c.id === cardId)
    if (!c || c.flipped || c.matched) return

    // Start timer on first flip
    if (!startedRef.current) {
      startedRef.current = true
      startTimer()
    }

    // Flip this card
    const updated = cardsRef.current.map(card =>
      card.id === cardId ? { ...card, flipped: true } : card
    )
    cardsRef.current = updated
    setCards([...updated])

    const flipped = [...flippedRef.current, cardId]
    flippedRef.current = flipped

    if (flipped.length === 2) {
      movesRef.current++
      setMoves(movesRef.current)
      setLocked(true)

      const [id1, id2] = flipped
      const card1 = updated.find(c => c.id === id1)!
      const card2 = updated.find(c => c.id === id2)!

      if (card1.pairIdx === card2.pairIdx) {
        // Match!
        setTimeout(() => {
          const withMatch = cardsRef.current.map(card =>
            card.id === id1 || card.id === id2 ? { ...card, matched: true, flipped: true } : card
          )
          cardsRef.current = withMatch
          flippedRef.current = []
          matchedRef.current++
          setMatched(matchedRef.current)
          setCards([...withMatch])
          setLocked(false)
          if (matchedRef.current >= 8) endGame()
        }, 600)
      } else {
        // No match — flip back
        setTimeout(() => {
          const flippedBack = cardsRef.current.map(card =>
            card.id === id1 || card.id === id2 ? { ...card, flipped: false } : card
          )
          cardsRef.current = flippedBack
          flippedRef.current = []
          setCards([...flippedBack])
          setLocked(false)
        }, 900)
      }
    }
  }

  useEffect(() => { return () => stopTimer() }, [])

  if (!initialUser) return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <p className="text-zinc-400">Faça login para jogar.</p>
    </div>
  )

  const steps = [
    { emoji: '🎯', title: 'Objetivo',       desc: 'Encontre todos os 8 pares de cartas iguais!' },
    { emoji: '👆', title: 'Como jogar',     desc: 'Clique em duas cartas para virá-las. Se forem iguais, ficam viradas!' },
    { emoji: '🧠', title: 'Memorize',       desc: 'Lembre onde estão as cartas que você já viu. Use o mínimo de jogadas!' },
    { emoji: '⏱', title: 'Tempo',           desc: 'O cronômetro começa na primeira carta. Terminar rápido dá bônus de pontos!' },
    { emoji: '⭐', title: 'Pontos',         desc: 'Pontos base: 200 menos 3 por jogada (mínimo 50) + bônus de tempo (máx 100).' },
    { emoji: '🏆', title: 'Dica',           desc: 'Para pontuação máxima: termine em menos de 20 movimentos e menos de 30 segundos!' },
  ]

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">🃏 Memória</h1>
        <div className="flex items-center gap-3">
          {phase === 'playing' && (
            <div className="flex gap-3 items-center text-sm">
              <span className="text-zinc-400">⏱ {timeElapsed}s</span>
              <span className="text-white font-bold">{moves} jogadas</span>
            </div>
          )}
          <TutorialButton onClick={() => { stopTimer(); setPhase('tutorial') }} />
        </div>
      </div>

      {(phase === 'idle' || phase === 'tutorial') && (
        <GameTutorial
          title="Memória"
          emoji="🃏"
          startColor="bg-indigo-500 hover:bg-indigo-400"
          startLabel={phase === 'tutorial' ? 'Voltar ao início' : 'Começar!'}
          onStart={() => phase === 'tutorial' ? setPhase('idle') : startGame()}
          steps={steps}
        />
      )}

      {phase === 'playing' && (
        <div className="space-y-4">
          {/* Stats row */}
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Pares: <span className="text-green-400 font-bold">{matched}/8</span></span>
            <span className="text-zinc-400">Tempo: <span className="text-white font-bold">{timeElapsed}s</span></span>
            <span className="text-zinc-400">Jogadas: <span className="text-white font-bold">{moves}</span></span>
          </div>

          {/* 4×4 grid */}
          <div className="grid grid-cols-4 gap-2">
            {cards.map(card => (
              <button
                key={card.id}
                onClick={() => handleCardClick(card.id)}
                disabled={locked || card.flipped || card.matched}
                className={`
                  aspect-square rounded-xl border-2 text-2xl font-bold
                  flex items-center justify-center
                  transition-all duration-300 select-none
                  ${card.matched
                    ? `${PAIR_COLORS[card.pairIdx]} bg-zinc-800 shadow-md scale-95`
                    : card.flipped
                    ? `${PAIR_COLORS[card.pairIdx]} bg-zinc-700`
                    : 'border-zinc-700 bg-zinc-800 hover:border-zinc-500 hover:bg-zinc-750 active:scale-95 cursor-pointer text-zinc-600'}
                `}
              >
                {card.flipped || card.matched ? card.emoji : '?'}
              </button>
            ))}
          </div>

          <p className="text-center text-zinc-600 text-xs">Clique nas cartas para virá-las. Encontre os pares!</p>
        </div>
      )}

      {phase === 'over' && (
        <div className="text-center space-y-4 py-8">
          <div className="text-5xl">🎉</div>
          <h2 className="text-white text-2xl font-bold">Parabéns!</h2>
          <p className="text-zinc-400">Concluído em <span className="text-white font-bold">{moves}</span> jogadas e <span className="text-white font-bold">{timeElapsed}s</span></p>
          <p className="text-yellow-400 font-bold">+{earned} pontos ganhos!</p>
          <button onClick={startGame}
            className="px-8 py-3 bg-indigo-500 hover:bg-indigo-400 text-white font-bold rounded-xl transition-all hover:scale-105">
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
