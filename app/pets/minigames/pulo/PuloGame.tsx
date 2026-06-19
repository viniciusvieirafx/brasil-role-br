'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { loadData, saveData, addPoints, updateHighScore } from '@/lib/petStore'
import GameTutorial, { TutorialButton } from '@/components/pets/GameTutorial'

interface DiscordUser { id: string; username: string; avatar: string | null; globalName: string | null }

// ── Canvas dimensions ──────────────────────────────────────────────────────────
const W = 600
const H = 240
const GROUND_Y = H - 44       // y do chão (topo)
const PLAYER_X = 70
const PLAYER_W = 52
const PLAYER_H = 52

// ── Physics ────────────────────────────────────────────────────────────────────
const GRAVITY = 0.6
const JUMP_FORCE = -13
const DOUBLE_JUMP_FORCE = -11.5

// ── Obstacle config ────────────────────────────────────────────────────────────
const OBS_MIN_W = 22
const OBS_MAX_W = 38
const OBS_MIN_H = 30
const OBS_MAX_H = 58
const OBS_MIN_GAP = 650    // min px between obstacles
const OBS_MAX_GAP = 1100

type DisplayState = 'idle' | 'playing' | 'over' | 'tutorial'

interface Obstacle { x: number; w: number; h: number }

interface GameState {
  playerY: number
  vy: number
  onGround: boolean
  jumpsLeft: number        // 2 = double jump disponível
  obstacles: Obstacle[]
  score: number            // frames vivos
  speed: number            // px/frame
  nextObstacleIn: number   // frames até próximo obstáculo
  alive: boolean
  walkFrame: number
  walkTick: number
}

function makeState(): GameState {
  return {
    playerY: GROUND_Y - PLAYER_H,
    vy: 0,
    onGround: true,
    jumpsLeft: 2,
    obstacles: [],
    score: 0,
    speed: 3.5,
    nextObstacleIn: 90,
    alive: true,
    walkFrame: 0,
    walkTick: 0,
  }
}

export default function PuloGame({ initialUser }: { initialUser: DiscordUser | null }) {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gsRef = useRef<GameState>(makeState())
  const rafRef = useRef(0)
  const lastFrameRef = useRef(0)
  const petImgRef = useRef<HTMLImageElement | null>(null)
  const petImgWalkRef = useRef<HTMLImageElement | null>(null)
  const jumpPressedRef = useRef(false)   // evita repeat de keydown

  const [displayState, setDisplayState] = useState<DisplayState>('idle')
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [earned, setEarned] = useState(0)

  // Load high score + sprites
  useEffect(() => {
    if (!initialUser) return
    const d = loadData(initialUser.id)
    setHighScore(d.highScore)
    const pid = d.ownedPets.find(p => p.instanceId === d.activePetId)?.petId ?? 1
    const pad = String(pid).padStart(3, '0')

    const idle = new Image()
    idle.src = `/pets/sprites/monster_${pad}_idle.png`
    idle.onload = () => { petImgRef.current = idle }

    const walk = new Image()
    walk.src = `/pets/sprites/monster_${pad}_walk.png`
    walk.onload = () => { petImgWalkRef.current = walk }
  }, [initialUser])

  function doJump() {
    const gs = gsRef.current
    if (!gs.alive) return
    if (gs.jumpsLeft > 0) {
      gs.vy = gs.jumpsLeft === 2 ? JUMP_FORCE : DOUBLE_JUMP_FORCE
      gs.onGround = false
      gs.jumpsLeft--
    }
  }

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const gs = gsRef.current

    // ── Background ──────────────────────────────────────────────────────────
    ctx.fillStyle = '#0A0718'
    ctx.fillRect(0, 0, W, H)

    // Stars
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    for (let i = 0; i < 25; i++) {
      ctx.fillRect((i * 43 + gs.score * 0.3) % W, (i * 31) % (GROUND_Y - 20), 1.5, 1.5)
    }

    // Ground
    ctx.fillStyle = '#FFD700'
    ctx.fillRect(0, GROUND_Y, W, 3)
    ctx.fillStyle = '#3a2e00'
    ctx.fillRect(0, GROUND_Y + 3, W, H - GROUND_Y - 3)

    // Ground detail (dashed line moving)
    ctx.fillStyle = 'rgba(255,215,0,0.2)'
    for (let i = 0; i < 6; i++) {
      const x = ((i * 70) - (gs.score * gs.speed * 0.5) % 70 + 700) % W
      ctx.fillRect(x, GROUND_Y + 8, 40, 2)
    }

    // ── Obstacles ───────────────────────────────────────────────────────────
    for (const obs of gs.obstacles) {
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)'
      ctx.fillRect(obs.x + 3, GROUND_Y + 2, obs.w, 4)
      // Body gradient-ish
      ctx.fillStyle = '#ef4444'
      ctx.beginPath()
      ctx.roundRect(obs.x, GROUND_Y - obs.h, obs.w, obs.h, 4)
      ctx.fill()
      ctx.fillStyle = '#fca5a5'
      ctx.fillRect(obs.x + 3, GROUND_Y - obs.h + 3, obs.w - 6, 5)
    }

    // ── Player ──────────────────────────────────────────────────────────────
    const py = gs.playerY
    const img = gs.onGround ? (petImgWalkRef.current ?? petImgRef.current) : petImgRef.current
    if (img) {
      ctx.drawImage(img, PLAYER_X, py, PLAYER_W, PLAYER_H)
    } else {
      ctx.fillStyle = '#FFD700'
      ctx.beginPath()
      ctx.roundRect(PLAYER_X, py, PLAYER_W, PLAYER_H, 8)
      ctx.fill()
      ctx.font = '28px serif'
      ctx.textAlign = 'center'
      ctx.fillText('🐾', PLAYER_X + PLAYER_W / 2, py + PLAYER_H - 6)
    }

    // Double-jump indicator (small dot above player when 1 jump used)
    if (!gs.onGround && gs.jumpsLeft > 0) {
      ctx.fillStyle = 'rgba(255,215,0,0.7)'
      ctx.beginPath()
      ctx.arc(PLAYER_X + PLAYER_W / 2, py - 8, 4, 0, Math.PI * 2)
      ctx.fill()
    }

    // ── HUD ─────────────────────────────────────────────────────────────────
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.font = 'bold 15px sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(`${Math.floor(gs.score / 6)}m`, 10, 10)

    ctx.fillStyle = 'rgba(255,215,0,0.6)'
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(`REC ${highScore}m`, W - 10, 10)
  }, [highScore])

  const gameLoop = useCallback((now: number) => {
    const gs = gsRef.current
    if (!gs.alive) return

    const delta = Math.min(now - lastFrameRef.current, 50)
    lastFrameRef.current = now
    const dt = delta / (1000 / 60)

    // ── Physics ──────────────────────────────────────────────────────────────
    gs.vy += GRAVITY * dt
    gs.playerY += gs.vy * dt

    if (gs.playerY >= GROUND_Y - PLAYER_H) {
      gs.playerY = GROUND_Y - PLAYER_H
      gs.vy = 0
      gs.onGround = true
      gs.jumpsLeft = 2
    } else {
      gs.onGround = false
    }

    // ── Speed ramp ───────────────────────────────────────────────────────────
    gs.score += dt
    gs.speed = 3.5 + Math.min(6, gs.score / 900)

    // ── Spawn obstacle ───────────────────────────────────────────────────────
    gs.nextObstacleIn -= dt
    if (gs.nextObstacleIn <= 0) {
      const h = OBS_MIN_H + Math.random() * (OBS_MAX_H - OBS_MIN_H)
      const w = OBS_MIN_W + Math.random() * (OBS_MAX_W - OBS_MIN_W)
      gs.obstacles.push({ x: W + 10, w, h })
      const gap = OBS_MIN_GAP + Math.random() * (OBS_MAX_GAP - OBS_MIN_GAP)
      gs.nextObstacleIn = gap / gs.speed
    }

    // ── Move + prune obstacles ────────────────────────────────────────────────
    gs.obstacles = gs.obstacles
      .map(o => ({ ...o, x: o.x - gs.speed * dt }))
      .filter(o => o.x + o.w > -10)

    // ── Collision ────────────────────────────────────────────────────────────
    const margin = 6
    for (const obs of gs.obstacles) {
      const px1 = PLAYER_X + margin, px2 = PLAYER_X + PLAYER_W - margin
      const py1 = gs.playerY + margin, py2 = gs.playerY + PLAYER_H - margin
      const ox1 = obs.x, ox2 = obs.x + obs.w
      const oy1 = GROUND_Y - obs.h, oy2 = GROUND_Y
      if (px1 < ox2 && px2 > ox1 && py1 < oy2 && py2 > oy1) {
        gs.alive = false
        const finalScore = Math.floor(gs.score / 6)
        setScore(finalScore)
        setDisplayState('over')
        if (initialUser) {
          const d = loadData(initialUser.id)
          const pts = Math.floor(finalScore / 5)
          setEarned(pts)
          saveData(updateHighScore(addPoints(d, pts), finalScore))
          setHighScore(prev => Math.max(prev, finalScore))
        }
        drawFrame()
        return
      }
    }

    setScore(Math.floor(gs.score / 6))
    drawFrame()
    rafRef.current = requestAnimationFrame(gameLoop)
  }, [drawFrame, initialUser])

  function startGame() {
    cancelAnimationFrame(rafRef.current)
    gsRef.current = makeState()
    jumpPressedRef.current = false
    lastFrameRef.current = 0
    setScore(0)
    setDisplayState('playing')
    setTimeout(() => {
      lastFrameRef.current = performance.now()
      rafRef.current = requestAnimationFrame(gameLoop)
    }, 50)
  }

  // Keyboard
  useEffect(() => {
    if (displayState !== 'playing') return
    function onDown(e: KeyboardEvent) {
      if ((e.code === 'Space' || e.code === 'ArrowUp' || e.key === 'w' || e.key === 'W') && !jumpPressedRef.current) {
        jumpPressedRef.current = true
        e.preventDefault()
        doJump()
      }
    }
    function onUp(e: KeyboardEvent) {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        jumpPressedRef.current = false
      }
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp) }
  }, [displayState])

  function handleCanvasTap() {
    if (displayState === 'playing') doJump()
  }

  if (!initialUser) return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <p className="text-zinc-400">Faça login para jogar.</p>
    </div>
  )

  const steps = [
    { emoji: '🎯', title: 'Objetivo',       desc: 'Corra o máximo possível sem bater nos obstáculos vermelhos!' },
    { emoji: '⬆️', title: 'Pular',           desc: 'Pressione Espaço, ↑ ou toque na tela para pular.' },
    { emoji: '✌️', title: 'Pulo duplo',      desc: 'Você pode pular duas vezes no ar! Use para obstáculos altos.' },
    { emoji: '⚡', title: 'Velocidade',      desc: 'O jogo acelera com o tempo — fique ligado!' },
    { emoji: '📏', title: 'Pontuação',       desc: 'Quanto mais longe você chegar, mais metros e mais pontos!' },
    { emoji: '⭐', title: 'Recompensa',      desc: 'Ganhe pontos de pet a cada 5 metros percorridos.' },
  ]

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">🦕 Corrida Infinita</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-400">🏆 <span className="text-yellow-400 font-bold">{highScore}m</span></span>
          <TutorialButton onClick={() => { cancelAnimationFrame(rafRef.current); gsRef.current.alive = false; setDisplayState('tutorial') }} />
        </div>
      </div>

      {displayState === 'idle' && (
        <GameTutorial
          title="Corrida Infinita"
          emoji="🦕"
          startColor="bg-green-500 hover:bg-green-400"
          onStart={startGame}
          steps={steps}
        />
      )}

      {displayState === 'tutorial' && (
        <GameTutorial
          title="Corrida Infinita"
          emoji="🦕"
          startLabel="Voltar"
          startColor="bg-zinc-600 hover:bg-zinc-500"
          onStart={() => setDisplayState('idle')}
          steps={steps}
        />
      )}

      {displayState === 'playing' && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-zinc-400">
            <span>Distância: <span className="text-white font-bold">{score}m</span></span>
            <span>Recorde: <span className="text-yellow-400">{highScore}m</span></span>
          </div>
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            onClick={handleCanvasTap}
            className="rounded-2xl border-2 border-zinc-700 w-full cursor-pointer touch-none"
            style={{ maxWidth: W, display: 'block', margin: '0 auto' }}
          />
          <p className="text-center text-zinc-600 text-xs">Espaço / ↑ / Toque para pular · Pulo duplo disponível!</p>
        </div>
      )}

      {displayState === 'over' && (
        <div className="text-center space-y-4 py-6">
          <div className="text-5xl">💥</div>
          <h2 className="text-white text-2xl font-bold">Bateu!</h2>
          <p className="text-zinc-400">Distância: <span className="text-white font-bold">{score}m</span></p>
          {score >= highScore && score > 0 && (
            <p className="text-yellow-400 font-bold animate-pulse">🏆 Novo Recorde!</p>
          )}
          <p className="text-yellow-400 font-bold">+{earned} pontos ganhos!</p>
          <button onClick={startGame}
            className="px-8 py-3 bg-green-500 hover:bg-green-400 text-white font-bold rounded-xl transition-all hover:scale-105">
            Tentar Novamente
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
