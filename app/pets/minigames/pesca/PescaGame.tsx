'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { loadData, saveData, addPoints, feedActivePet } from '@/lib/petStore'
import GameTutorial, { TutorialButton } from '@/components/pets/GameTutorial'

interface DiscordUser { id: string; username: string; avatar: string | null; globalName: string | null }

const W = 360
const H = 420
const GAME_DURATION = 45
const FISH_EMOJIS = ['🐟', '🐠', '🐡', '🦐', '🦞', '🦀']
const BOBBER_X = 160
const BOBBER_Y = 195
const BITE_WINDOW_MS = 1500
const FISH_SPAWN_INTERVAL = 2500

interface Fish {
  id: number
  emoji: string
  x: number
  y: number
  speedX: number
  caught: boolean
  floatAnim: number // countdown for float-up animation
}

export default function PescaGame({ initialUser }: { initialUser: DiscordUser | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const aliveRef = useRef(false)
  const scoreRef = useRef(0)
  const timeRef = useRef(GAME_DURATION)
  const fishRef = useRef<Fish[]>([])
  const nextFishIdRef = useRef(0)
  const activeBiteRef = useRef(false)
  const bobberJiggleRef = useRef(0) // sine wave phase
  const biteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafRef = useRef(0)
  const lastFrameRef = useRef(0)
  const lastSpawnRef = useRef(0)
  const lastSecRef = useRef(0)

  const [displayState, setDisplayState] = useState<'idle' | 'playing' | 'over' | 'tutorial'>('idle')
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
  const [earned, setEarned] = useState(0)

  function endGame() {
    aliveRef.current = false
    cancelAnimationFrame(rafRef.current)
    if (biteTimerRef.current) clearTimeout(biteTimerRef.current)
    const pts = scoreRef.current * 5
    setEarned(pts)
    setDisplayState('over')
    if (initialUser) {
      let d = loadData(initialUser.id)
      d = addPoints(d, pts)
      d = feedActivePet(d, scoreRef.current * 6)
      saveData(d)
    }
  }

  const draw = useCallback((now: number, dt: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    // Spawn fish every ~2500ms
    if (now - lastSpawnRef.current > FISH_SPAWN_INTERVAL) {
      lastSpawnRef.current = now
      const fromLeft = Math.random() < 0.5
      const yDepths = [210, 230, 250, 270, 290, 310]
      const fy = yDepths[Math.floor(Math.random() * yDepths.length)]
      fishRef.current.push({
        id: nextFishIdRef.current++,
        emoji: FISH_EMOJIS[Math.floor(Math.random() * FISH_EMOJIS.length)],
        x: fromLeft ? -40 : W + 40,
        y: fy,
        speedX: fromLeft ? 1.2 + Math.random() * 0.8 : -(1.2 + Math.random() * 0.8),
        caught: false,
        floatAnim: 0,
      })
    }

    // Countdown timer
    if (now - lastSecRef.current > 1000) {
      lastSecRef.current = now
      timeRef.current = Math.max(0, timeRef.current - 1)
      setTimeLeft(timeRef.current)
      if (timeRef.current <= 0) { endGame(); return }
    }

    // Update bobber jiggle
    if (activeBiteRef.current) {
      bobberJiggleRef.current += 0.25 * dt
    } else {
      bobberJiggleRef.current += 0.04 * dt
    }

    // Update fish positions & check bite trigger
    const toRemove = new Set<number>()
    for (const f of fishRef.current) {
      if (f.caught) {
        f.floatAnim -= dt
        f.y -= 2 * dt
        if (f.floatAnim <= 0) toRemove.add(f.id)
        continue
      }
      f.x += f.speedX * dt
      // Check if fish reached bobber x
      if (!activeBiteRef.current && Math.abs(f.x - BOBBER_X) < 15) {
        activeBiteRef.current = true
        // Auto-reset bite after window
        biteTimerRef.current = setTimeout(() => {
          activeBiteRef.current = false
          // Remove escaped fish
          fishRef.current = fishRef.current.filter(fish => fish.caught || Math.abs(fish.x - BOBBER_X) >= 15)
        }, BITE_WINDOW_MS)
      }
      // Remove if off-screen
      if (f.x < -60 || f.x > W + 60) toRemove.add(f.id)
    }
    fishRef.current = fishRef.current.filter(f => !toRemove.has(f.id))

    // ── Draw background ────────────────────────────────────────────────────────
    // Night sky gradient (top 150px)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 150)
    skyGrad.addColorStop(0, '#050310')
    skyGrad.addColorStop(1, '#0c1a3a')
    ctx.fillStyle = skyGrad
    ctx.fillRect(0, 0, W, 150)

    // Stars
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    const starPositions = [
      [20, 15], [60, 30], [110, 10], [155, 40], [200, 8], [240, 25],
      [280, 15], [320, 35], [345, 12], [75, 60], [190, 55], [310, 65],
    ]
    for (const [sx, sy] of starPositions) {
      const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(now * 0.001 + sx))
      ctx.globalAlpha = twinkle
      ctx.fillRect(sx, sy, 1.5, 1.5)
    }
    ctx.globalAlpha = 1

    // Crescent moon
    ctx.save()
    ctx.fillStyle = '#fffde7'
    ctx.beginPath()
    ctx.arc(310, 35, 18, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#0c1a3a'
    ctx.beginPath()
    ctx.arc(320, 30, 16, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // Water gradient (150px to bottom)
    const waterGrad = ctx.createLinearGradient(0, 150, 0, H)
    waterGrad.addColorStop(0, '#0a2a4a')
    waterGrad.addColorStop(1, '#051525')
    ctx.fillStyle = waterGrad
    ctx.fillRect(0, 150, W, H - 150)

    // Wavy surface line
    ctx.strokeStyle = 'rgba(100,200,255,0.4)'
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let x = 0; x <= W; x += 4) {
      const wy = 152 + Math.sin((x * 0.04) + now * 0.002) * 3
      if (x === 0) ctx.moveTo(x, wy)
      else ctx.lineTo(x, wy)
    }
    ctx.stroke()

    // Shimmer lines
    for (let i = 0; i < 5; i++) {
      const shimX = ((i * 80 + now * 0.03) % (W + 80)) - 40
      const shimY = 170 + i * 35
      ctx.strokeStyle = `rgba(150,220,255,${0.05 + i * 0.02})`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(shimX, shimY)
      ctx.lineTo(shimX + 60, shimY)
      ctx.stroke()
    }

    // ── Fishing rod (bottom-right to tip) ─────────────────────────────────────
    ctx.strokeStyle = '#8B4513'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(W - 10, H)
    ctx.lineTo(W - 50, H - 80)
    ctx.stroke()
    ctx.strokeStyle = '#A0522D'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(W - 50, H - 80)
    ctx.lineTo(300, 40)
    ctx.stroke()

    // ── Fishing line ───────────────────────────────────────────────────────────
    const bobberY = BOBBER_Y + (activeBiteRef.current ? Math.sin(bobberJiggleRef.current) * 6 : Math.sin(bobberJiggleRef.current) * 1.5)
    ctx.strokeStyle = 'rgba(200,200,200,0.7)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(300, 40)
    ctx.lineTo(BOBBER_X, bobberY)
    ctx.stroke()

    // ── Bobber ─────────────────────────────────────────────────────────────────
    // Top (red)
    ctx.fillStyle = activeBiteRef.current ? '#ff2020' : '#dc2626'
    ctx.beginPath()
    ctx.arc(BOBBER_X, bobberY - 4, 6, Math.PI, 0)
    ctx.fill()
    // Bottom (white)
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(BOBBER_X, bobberY + 2, 6, 0, Math.PI)
    ctx.fill()

    // ── TAP! indicator ─────────────────────────────────────────────────────────
    if (activeBiteRef.current) {
      const pulse = 0.7 + 0.3 * Math.abs(Math.sin(now * 0.008))
      ctx.globalAlpha = pulse
      ctx.fillStyle = '#fbbf24'
      ctx.font = 'bold 18px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('TAP! 🎣', BOBBER_X, bobberY - 28)
      ctx.globalAlpha = 1
    }

    // ── Fish ───────────────────────────────────────────────────────────────────
    for (const f of fishRef.current) {
      ctx.save()
      ctx.translate(f.x, f.y)
      if (f.speedX < 0) ctx.scale(-1, 1) // flip when moving left
      if (f.caught) {
        ctx.globalAlpha = Math.max(0, f.floatAnim / 20)
      }
      ctx.font = '22px serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(f.emoji, 0, 0)
      ctx.restore()
    }

    // ── HUD ────────────────────────────────────────────────────────────────────
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.font = 'bold 14px sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.globalAlpha = 1
    ctx.fillText(`🐟 ${scoreRef.current}`, 10, 10)
    ctx.textAlign = 'right'
    ctx.fillText(`⏱ ${timeRef.current}s`, W - 10, 10)
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
    if (biteTimerRef.current) clearTimeout(biteTimerRef.current)
    fishRef.current = []
    nextFishIdRef.current = 0
    scoreRef.current = 0
    timeRef.current = GAME_DURATION
    lastSpawnRef.current = 0
    lastSecRef.current = 0
    activeBiteRef.current = false
    bobberJiggleRef.current = 0
    aliveRef.current = true
    setScore(0)
    setTimeLeft(GAME_DURATION)
    setDisplayState('playing')
    setTimeout(() => { lastFrameRef.current = performance.now(); rafRef.current = requestAnimationFrame(loop) }, 50)
  }

  function handleCanvasTap() {
    if (!aliveRef.current) return
    if (activeBiteRef.current) {
      // Catch! Find fish near bobber
      const biting = fishRef.current.find(f => !f.caught && Math.abs(f.x - BOBBER_X) < 30)
      if (biting) {
        biting.caught = true
        biting.floatAnim = 20
        activeBiteRef.current = false
        if (biteTimerRef.current) clearTimeout(biteTimerRef.current)
        scoreRef.current++
        setScore(scoreRef.current)
      }
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current)
      if (biteTimerRef.current) clearTimeout(biteTimerRef.current)
    }
  }, [])

  if (!initialUser) return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <p className="text-zinc-400">Faça login para jogar.</p>
    </div>
  )

  const steps = [
    { emoji: '🎯', title: 'Objetivo',       desc: `Pesque o máximo de peixes em ${GAME_DURATION} segundos!` },
    { emoji: '👁️', title: 'Observe',        desc: 'Fique de olho no flutuador. Quando um peixe morder, ele vai chacoalhar!' },
    { emoji: '👆', title: 'Toque rápido',   desc: 'Quando aparecer "TAP! 🎣", toque ou clique rapidamente na tela!' },
    { emoji: '⏱', title: 'Janela de tempo', desc: `Você tem ${BITE_WINDOW_MS / 1000} segundos para reagir. Se não tocar, o peixe escapa.` },
    { emoji: '🍽️', title: 'Saciedade',      desc: 'Cada peixe capturado alimenta o seu bichinho!' },
    { emoji: '⭐', title: 'Pontos',         desc: 'Cada peixe vale 5 pontos. Seja rápido e atento!' },
  ]

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">🎣 Pesca</h1>
        <div className="flex items-center gap-3">
          {displayState === 'playing' && (
            <div className="flex gap-3 items-center text-sm">
              <span className="text-zinc-400">⏱ {timeLeft}s</span>
              <span className="text-white font-bold">{score} peixes</span>
            </div>
          )}
          <TutorialButton onClick={() => { cancelAnimationFrame(rafRef.current); aliveRef.current = false; if (biteTimerRef.current) clearTimeout(biteTimerRef.current); setDisplayState('tutorial') }} />
        </div>
      </div>

      {(displayState === 'idle' || displayState === 'tutorial') && (
        <GameTutorial
          title="Pesca"
          emoji="🎣"
          startColor="bg-cyan-500 hover:bg-cyan-400"
          startLabel={displayState === 'tutorial' ? 'Voltar ao início' : 'Começar!'}
          onStart={() => displayState === 'tutorial' ? setDisplayState('idle') : startGame()}
          steps={steps}
        />
      )}

      {displayState === 'playing' && (
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onClick={handleCanvasTap}
          className="rounded-2xl border-2 border-zinc-700 w-full cursor-pointer"
          style={{ maxWidth: W, display: 'block', margin: '0 auto', touchAction: 'none' }}
        />
      )}

      {displayState === 'over' && (
        <div className="text-center space-y-4 py-8">
          <div className="text-5xl">{score >= 5 ? '🎣' : '😅'}</div>
          <h2 className="text-white text-2xl font-bold">Fim de jogo!</h2>
          <p className="text-zinc-400">Você pescou <span className="text-white font-bold">{score}</span> peixes</p>
          <p className="text-yellow-400 font-bold">+{earned} pontos ganhos!</p>
          <button onClick={startGame}
            className="px-8 py-3 bg-cyan-500 hover:bg-cyan-400 text-white font-bold rounded-xl transition-all hover:scale-105">
            Pescar Novamente
          </button>
        </div>
      )}
    </div>
  )
}
