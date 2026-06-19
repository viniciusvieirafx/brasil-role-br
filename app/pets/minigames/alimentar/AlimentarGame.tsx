'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { loadData, saveData, addPoints, feedActivePet } from '@/lib/petStore'
import GameTutorial, { TutorialButton } from '@/components/pets/GameTutorial'

interface DiscordUser { id: string; username: string; avatar: string | null; globalName: string | null }

const W = 360
const H = 440
const GAME_DURATION = 30
const FOODS = ['🍎','🍌','🍇','🍓','🥕','🌽','🍕','🍔','🍩','🍦','🍭','🥐']
const FOOD_SIZE = 40
const FOOD_SPEED_MIN = 2.5
const FOOD_SPEED_MAX = 5

interface FoodItem {
  id: number
  emoji: string
  x: number
  y: number
  speed: number
  caught: boolean
  catchAnim: number  // countdown frames after catch (scale pop)
}

export default function AlimentarGame({ initialUser }: { initialUser: DiscordUser | null }) {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const foodsRef = useRef<FoodItem[]>([])
  const nextIdRef = useRef(0)
  const livesRef = useRef(3)
  const scoreRef = useRef(0)
  const hungerRef = useRef(0)
  const timeRef = useRef(GAME_DURATION)
  const rafRef = useRef(0)
  const lastFrameRef = useRef(0)
  const aliveRef = useRef(false)
  const lastSpawnRef = useRef(0)
  const lastSecRef = useRef(0)
  const petImgRef = useRef<HTMLImageElement | null>(null)

  const [displayState, setDisplayState] = useState<'idle' | 'playing' | 'over' | 'tutorial'>('idle')
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
  const [hunger, setHunger] = useState(0)
  const [earned, setEarned] = useState(0)

  // Load pet sprite
  useEffect(() => {
    if (!initialUser) return
    const d = loadData(initialUser.id)
    const pid = d.ownedPets.find(p => p.instanceId === d.activePetId)?.petId ?? 1
    const img = new Image()
    img.src = `/pets/sprites/monster_${String(pid).padStart(3, '0')}_idle.png`
    img.onload = () => { petImgRef.current = img }
  }, [initialUser])

  function endGame() {
    aliveRef.current = false
    cancelAnimationFrame(rafRef.current)
    const pts = scoreRef.current * 2
    setEarned(pts)
    setDisplayState('over')
    if (initialUser) {
      let d = loadData(initialUser.id)
      d = addPoints(d, pts)
      // Cada comida capturada alimenta o bichinho em 8 pontos de saciedade
      d = feedActivePet(d, scoreRef.current * 8)
      saveData(d)
    }
  }

  const draw = useCallback((now: number, dt: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    // Spawn new food every ~900ms
    if (now - lastSpawnRef.current > 900) {
      lastSpawnRef.current = now
      foodsRef.current.push({
        id: nextIdRef.current++,
        emoji: FOODS[Math.floor(Math.random() * FOODS.length)],
        x: FOOD_SIZE + Math.random() * (W - FOOD_SIZE * 2),
        y: -FOOD_SIZE,
        speed: FOOD_SPEED_MIN + Math.random() * (FOOD_SPEED_MAX - FOOD_SPEED_MIN),
        caught: false,
        catchAnim: 0,
      })
    }

    // Count down timer (every second)
    if (now - lastSecRef.current > 1000) {
      lastSecRef.current = now
      timeRef.current = Math.max(0, timeRef.current - 1)
      setTimeLeft(timeRef.current)
      if (timeRef.current <= 0) { endGame(); return }
    }

    // Update food positions
    const toRemove = new Set<number>()
    for (const f of foodsRef.current) {
      if (f.caught) {
        f.catchAnim -= dt
        if (f.catchAnim <= 0) toRemove.add(f.id)
        continue
      }
      f.y += f.speed * dt
      if (f.y > H + FOOD_SIZE) {
        toRemove.add(f.id)
        livesRef.current = Math.max(0, livesRef.current - 1)
        setLives(livesRef.current)
        if (livesRef.current <= 0) { endGame(); return }
      }
    }
    foodsRef.current = foodsRef.current.filter(f => !toRemove.has(f.id))

    // ── Draw ───────────────────────────────────────────────────────────
    ctx.fillStyle = '#0f0a1e'
    ctx.fillRect(0, 0, W, H)

    // Pet at bottom center
    if (petImgRef.current) {
      const pw = 80, ph = 80
      ctx.drawImage(petImgRef.current, W / 2 - pw / 2, H - ph - 8, pw, ph)
    } else {
      ctx.font = '60px serif'
      ctx.textAlign = 'center'
      ctx.fillText('🐾', W / 2, H - 20)
    }

    // Draw food items using emoji on canvas
    for (const f of foodsRef.current) {
      ctx.save()
      ctx.translate(f.x, f.y)
      if (f.caught) {
        const scale = 1 + (12 - f.catchAnim) * 0.1
        ctx.globalAlpha = f.catchAnim / 12
        ctx.scale(scale, scale)
      }
      ctx.font = `${FOOD_SIZE}px serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(f.emoji, 0, 0)
      ctx.restore()
    }

    // Hunger bar
    const barX = 10, barY = H - 18, barW = W - 20, barH = 8
    ctx.fillStyle = '#27272a'
    ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, 4); ctx.fill()
    const hFill = Math.min(1, hungerRef.current / 100)
    if (hFill > 0) {
      const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0)
      grad.addColorStop(0, '#ef4444')
      grad.addColorStop(1, '#22c55e')
      ctx.fillStyle = grad
      ctx.beginPath(); ctx.roundRect(barX, barY, barW * hFill, barH, 4); ctx.fill()
    }
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.font = '9px sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(`Saciedade ${Math.round(hungerRef.current)}%`, barX + 2, barY - 12)
  }, [])

  const loop = useCallback((now: number) => {
    if (!aliveRef.current) return
    const delta = Math.min(now - lastFrameRef.current, 50)
    lastFrameRef.current = now
    const dt = delta / (1000 / 60)
    draw(now, dt)
    rafRef.current = requestAnimationFrame(loop)
  }, [draw])

  function startGame() {
    cancelAnimationFrame(rafRef.current)
    foodsRef.current = []
    nextIdRef.current = 0
    livesRef.current = 3
    scoreRef.current = 0
    hungerRef.current = 0
    timeRef.current = GAME_DURATION
    lastSpawnRef.current = 0
    lastSecRef.current = 0
    aliveRef.current = true
    setScore(0); setLives(3); setTimeLeft(GAME_DURATION); setHunger(0); setDisplayState('playing')
    setTimeout(() => { lastFrameRef.current = performance.now(); rafRef.current = requestAnimationFrame(loop) }, 50)
  }

  // Click/tap on canvas → catch food
  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = W / rect.width
    const scaleY = H / rect.height
    const cx = (e.clientX - rect.left) * scaleX
    const cy = (e.clientY - rect.top) * scaleY

    for (const f of foodsRef.current) {
      if (f.caught) continue
      const dx = cx - f.x, dy = cy - f.y
      if (Math.sqrt(dx * dx + dy * dy) < FOOD_SIZE) {
        f.caught = true
        f.catchAnim = 12
        scoreRef.current++
        hungerRef.current = Math.min(100, hungerRef.current + 10)
        setScore(scoreRef.current)
        setHunger(Math.round(hungerRef.current))
        break
      }
    }
  }

  if (!initialUser) return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <p className="text-zinc-400">Faça login para jogar.</p>
    </div>
  )

  const livesDisplay = Array.from({ length: 3 }, (_, i) => i < lives ? '❤️' : '🖤').join('')

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">🍎 Alimentar</h1>
        <div className="flex items-center gap-3">
          {displayState === 'playing' && (
            <div className="flex gap-3 items-center text-sm">
              <span className="text-zinc-400">⏱ {timeLeft}s</span>
              <span className="text-white font-bold">{score} pts</span>
              <span>{livesDisplay}</span>
            </div>
          )}
          <TutorialButton onClick={() => { cancelAnimationFrame(rafRef.current); aliveRef.current = false; setDisplayState('tutorial') }} />
        </div>
      </div>

      {(displayState === 'idle' || displayState === 'tutorial') && (
        <GameTutorial
          title="Alimentar"
          emoji="🍎"
          startColor="bg-red-500 hover:bg-red-400"
          startLabel={displayState === 'tutorial' ? 'Voltar ao início' : 'Começar!'}
          onStart={() => displayState === 'tutorial' ? setDisplayState('idle') : startGame()}
          steps={[
            { emoji: '🎯', title: 'Objetivo',      desc: `Clique nas comidas que caem antes que elas saiam da tela. Você tem ${GAME_DURATION} segundos.` },
            { emoji: '👆', title: 'Como coletar',  desc: 'Clique ou toque diretamente na comida para coletar. Seja rápido!' },
            { emoji: '❤️', title: 'Vidas',          desc: 'Você tem 3 vidas. Cada comida que escapa tira uma vida. Se perder todas, o jogo acaba.' },
            { emoji: '🍽️', title: 'Saciedade',      desc: 'Cada comida coletada aumenta a saciedade do seu bichinho. Encha a barra!' },
            { emoji: '⭐', title: 'Pontos',         desc: 'Ganhe 2 pontos por comida coletada. Quanto mais coletar, mais pontos!' },
            { emoji: '⚡', title: 'Dificuldade',    desc: 'Com o tempo, as comidas caem mais rápido. Fique atento!' },
          ]}
        />
      )}

      {displayState === 'playing' && (
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onClick={handleCanvasClick}
          className="rounded-2xl border-2 border-zinc-700 w-full cursor-pointer"
          style={{ maxWidth: W, display: 'block', margin: '0 auto', touchAction: 'none' }}
        />
      )}

      {displayState === 'over' && (
        <div className="text-center space-y-4 py-8">
          <div className="text-5xl">{score >= 10 ? '🎉' : '😅'}</div>
          <h2 className="text-white text-2xl font-bold">Fim de jogo!</h2>
          <p className="text-zinc-400">Você alimentou {score} vezes</p>
          <p className="text-yellow-400 font-bold">+{earned} pontos ganhos!</p>
          <button onClick={startGame}
            className="px-8 py-3 bg-red-500 hover:bg-red-400 text-white font-bold rounded-xl transition-all hover:scale-105">
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
