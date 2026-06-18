'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { loadData, saveData, addPoints, updateHighScore } from '@/lib/petStore'
import GameTutorial, { TutorialButton } from '@/components/pets/GameTutorial'

interface DiscordUser { id: string; username: string; avatar: string | null; globalName: string | null }

// Game constants
const W = 360
const H = 560
const GRAVITY = 0.4
const JUMP_FORCE = -11
const PLAYER_W = 32
const PLAYER_H = 32
const PLATFORM_H = 14
const PLATFORM_W_MIN = 60
const PLATFORM_W_MAX = 100
const INITIAL_PLATFORM_GAP = 90
const MAX_PLATFORM_GAP = 190

interface Platform { x: number; y: number; w: number; moving?: boolean; dir?: 1 | -1; speed?: number }
interface Player { x: number; y: number; vx: number; vy: number }
interface GameState { player: Player; platforms: Platform[]; cameraY: number; score: number; alive: boolean }

function makeInitialState(): GameState {
  const platforms: Platform[] = []
  // Starting platform under player
  platforms.push({ x: W / 2 - 50, y: H - 80, w: 100 })
  // Generate initial set of platforms
  for (let i = 1; i < 12; i++) {
    platforms.push({
      x: Math.random() * (W - 90),
      y: H - 80 - i * INITIAL_PLATFORM_GAP,
      w: PLATFORM_W_MIN + Math.random() * (PLATFORM_W_MAX - PLATFORM_W_MIN),
    })
  }
  return {
    player: { x: W / 2 - PLAYER_W / 2, y: H - 80 - PLAYER_H, vx: 0, vy: -2 },
    platforms,
    cameraY: 0,
    score: 0,
    alive: true,
  }
}

export default function PuloGame({ initialUser }: { initialUser: DiscordUser | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<GameState>(makeInitialState())
  const keysRef = useRef<Set<string>>(new Set())
  const rafRef = useRef<number>(0)
  const [displayState, setDisplayState] = useState<'idle' | 'playing' | 'over' | 'tutorial'>('idle')
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [earned, setEarned] = useState(0)
  const touchStartX = useRef<number | null>(null)

  // Load high score
  useEffect(() => {
    if (!initialUser) return
    const d = loadData(initialUser.id)
    setHighScore(d.highScore)
  }, [initialUser])

  const petSprite = useRef<HTMLImageElement | null>(null)
  useEffect(() => {
    if (!initialUser) return
    const d = loadData(initialUser.id)
    const pid = d.ownedPets.find(p => p.instanceId === d.activePetId)?.petId ?? 1
    const img = new Image()
    img.src = `/pets/sprites/monster_${String(pid).padStart(3, '0')}_walk.png`
    img.onload = () => { petSprite.current = img }
  }, [initialUser])

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const gs = stateRef.current

    // Clear
    ctx.fillStyle = '#0A0718'
    ctx.fillRect(0, 0, W, H)

    // Stars background
    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    for (let i = 0; i < 30; i++) {
      const sx = (i * 37 + gs.cameraY * 0.05) % W
      const sy = (i * 53 + gs.cameraY * 0.1) % H
      ctx.fillRect(sx, sy, 1.5, 1.5)
    }

    // Platforms
    gs.platforms.forEach(p => {
      const drawY = p.y + gs.cameraY
      if (drawY < -PLATFORM_H || drawY > H + 10) return

      // Platform glow
      ctx.shadowColor = '#FFD700'
      ctx.shadowBlur = 8
      ctx.fillStyle = '#1a1530'
      ctx.beginPath()
      ctx.roundRect(p.x, drawY, p.w, PLATFORM_H, 6)
      ctx.fill()
      ctx.shadowBlur = 0

      ctx.fillStyle = '#FFD700'
      ctx.fillRect(p.x, drawY, p.w, 4)
      ctx.fillStyle = '#B8860B'
      ctx.fillRect(p.x, drawY + 4, p.w, PLATFORM_H - 4)
    })

    // Player
    const px = gs.player.x
    const py = gs.player.y + gs.cameraY
    if (petSprite.current) {
      ctx.drawImage(petSprite.current, px - 4, py - 4, PLAYER_W + 8, PLAYER_H + 8)
    } else {
      ctx.fillStyle = '#FFD700'
      ctx.beginPath()
      ctx.roundRect(px, py, PLAYER_W, PLAYER_H, 8)
      ctx.fill()
    }

    // Score
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.font = 'bold 16px sans-serif'
    ctx.fillText(`${Math.floor(gs.score)}m`, 12, 28)
    ctx.fillStyle = 'rgba(255,215,0,0.7)'
    ctx.font = '12px sans-serif'
    ctx.fillText(`⬆ ${Math.floor(gs.score)}`, W - 70, 28)
  }, [])

  const gameLoop = useCallback(() => {
    const gs = stateRef.current
    if (!gs.alive) return

    const keys = keysRef.current
    // Horizontal movement
    if (keys.has('ArrowLeft') || keys.has('a') || keys.has('A')) gs.player.vx = -5
    else if (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) gs.player.vx = 5
    else gs.player.vx *= 0.8

    // Wrap sides
    gs.player.x += gs.player.vx
    if (gs.player.x + PLAYER_W < 0) gs.player.x = W
    if (gs.player.x > W) gs.player.x = -PLAYER_W

    // Gravity
    gs.player.vy += GRAVITY
    gs.player.y += gs.player.vy

    // Difficulty: gap increases with score
    const gapFactor = Math.min(1, gs.score / 500)
    const platformGap = INITIAL_PLATFORM_GAP + gapFactor * (MAX_PLATFORM_GAP - INITIAL_PLATFORM_GAP)

    // Platform collision (only when falling) — tudo em coordenadas de MUNDO, sem cameraY
    if (gs.player.vy > 0) {
      for (const p of gs.platforms) {
        const px = gs.player.x, py = gs.player.y
        if (
          py + PLAYER_H >= p.y &&
          py + PLAYER_H <= p.y + PLATFORM_H + gs.player.vy + 2 &&
          px + PLAYER_W > p.x + 4 &&
          px < p.x + p.w - 4
        ) {
          gs.player.vy = JUMP_FORCE
          break
        }
      }
    }

    // Camera scroll when player rises above 40% height
    const threshold = H * 0.4
    const playerScreenY = gs.player.y + gs.cameraY
    if (playerScreenY < threshold) {
      const diff = threshold - playerScreenY
      gs.cameraY += diff
      gs.score += diff * 0.1
      setScore(Math.floor(gs.score))
    }

    // Move platforms (difficulty: some start moving at score > 200)
    gs.platforms.forEach(p => {
      if (p.moving && p.speed) {
        p.x += p.dir! * p.speed
        if (p.x <= 0 || p.x + p.w >= W) p.dir = p.dir === 1 ? -1 : 1
      }
    })

    // Remove off-screen platforms, generate new ones
    const topPlatformY = Math.min(...gs.platforms.map(p => p.y + gs.cameraY))
    if (topPlatformY > -50) {
      const newY = topPlatformY - platformGap
      const moving = gs.score > 200 && Math.random() < 0.3
      gs.platforms.push({
        x: Math.random() * (W - 90),
        y: newY - gs.cameraY,
        w: Math.max(40, PLATFORM_W_MAX - gs.score * 0.05),
        moving,
        dir: 1,
        speed: 1 + Math.random() * 1.5,
      })
    }
    gs.platforms = gs.platforms.filter(p => p.y + gs.cameraY < H + 20)

    // Death: fell below screen
    if (gs.player.y + gs.cameraY > H + 50) {
      gs.alive = false
      stateRef.current = gs
      const finalScore = Math.floor(gs.score)
      setDisplayState('over')
      setScore(finalScore)

      if (initialUser) {
        const d = loadData(initialUser.id)
        const pts = Math.floor(finalScore / 10)
        setEarned(pts)
        saveData(updateHighScore(addPoints(d, pts), finalScore))
        setHighScore(prev => Math.max(prev, finalScore))
      }
      return
    }

    stateRef.current = gs
    drawFrame()
    rafRef.current = requestAnimationFrame(gameLoop)
  }, [drawFrame, initialUser])

  function startGame() {
    cancelAnimationFrame(rafRef.current)
    stateRef.current = makeInitialState()
    setDisplayState('playing')
    setScore(0)
    // Start loop after brief delay to let state update
    setTimeout(() => {
      rafRef.current = requestAnimationFrame(gameLoop)
    }, 50)
  }

  // Keyboard handlers
  useEffect(() => {
    if (displayState !== 'playing') return
    const down = (e: KeyboardEvent) => keysRef.current.add(e.key)
    const up = (e: KeyboardEvent) => keysRef.current.delete(e.key)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [displayState])

  // Touch controls
  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }
  function handleTouchMove(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const dx = e.touches[0].clientX - touchStartX.current
    if (dx < -10) { keysRef.current.add('ArrowLeft'); keysRef.current.delete('ArrowRight') }
    else if (dx > 10) { keysRef.current.add('ArrowRight'); keysRef.current.delete('ArrowLeft') }
  }
  function handleTouchEnd() {
    keysRef.current.delete('ArrowLeft')
    keysRef.current.delete('ArrowRight')
    touchStartX.current = null
  }

  if (!initialUser) return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <p className="text-zinc-400">Faça login para jogar.</p>
    </div>
  )

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">🪂 Pulo Infinito</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-400">🏆 <span className="text-yellow-400 font-bold">{highScore}m</span></span>
          <TutorialButton onClick={() => { cancelAnimationFrame(rafRef.current); setDisplayState('tutorial') }} />
        </div>
      </div>

      {displayState === 'idle' && (
        <GameTutorial
          title="Pulo Infinito"
          emoji="🪂"
          startColor="bg-green-500 hover:bg-green-400"
          onStart={startGame}
          steps={[
            { emoji: '🎯', title: 'Objetivo',        desc: 'Suba o máximo possível pulando de plataforma em plataforma sem cair.' },
            { emoji: '⬅➡', title: 'Movimento',       desc: 'Setas do teclado ou teclas A/D para mover para os lados.' },
            { emoji: '📱', title: 'Mobile',           desc: 'No celular, arraste o dedo para a esquerda ou direita na tela.' },
            { emoji: '🔄', title: 'Wrap de tela',     desc: 'Saiu pela esquerda? Volta pela direita! Use isso a seu favor.' },
            { emoji: '⚡', title: 'Dificuldade',      desc: 'Quanto mais alto você sobe, maior o espaço entre as plataformas.' },
            { emoji: '⭐', title: 'Pontos',           desc: 'Ganhe pontos baseado na altura atingida. Bata seu recorde!' },
          ]}
        />
      )}

      {displayState === 'playing' && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-zinc-400">
            <span>Altura: <span className="text-white font-bold">{score}m</span></span>
            <span>Recorde: <span className="text-yellow-400">{highScore}m</span></span>
          </div>
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            className="rounded-2xl border-2 border-zinc-700 w-full touch-none"
            style={{ maxWidth: W, display: 'block', margin: '0 auto' }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          />
          <p className="text-center text-zinc-600 text-xs">Setas / A-D para mover · Mobile: arraste</p>
        </div>
      )}

      {displayState === 'tutorial' && (
        <GameTutorial
          title="Pulo Infinito"
          emoji="🪂"
          startLabel="Voltar ao jogo"
          startColor="bg-zinc-600 hover:bg-zinc-500"
          onStart={() => setDisplayState('idle')}
          steps={[
            { emoji: '🎯', title: 'Objetivo',        desc: 'Suba o máximo possível pulando de plataforma em plataforma sem cair.' },
            { emoji: '⬅➡', title: 'Movimento',       desc: 'Setas do teclado ou teclas A/D para mover para os lados.' },
            { emoji: '📱', title: 'Mobile',           desc: 'No celular, arraste o dedo para a esquerda ou direita na tela.' },
            { emoji: '🔄', title: 'Wrap de tela',     desc: 'Saiu pela esquerda? Volta pela direita! Use isso a seu favor.' },
            { emoji: '⚡', title: 'Dificuldade',      desc: 'Quanto mais alto você sobe, maior o espaço entre as plataformas.' },
            { emoji: '⭐', title: 'Pontos',           desc: 'Ganhe pontos baseado na altura atingida. Bata seu recorde!' },
          ]}
        />
      )}

      {displayState === 'over' && (
        <div className="text-center space-y-4 py-6">
          <div className="text-5xl">💥</div>
          <h2 className="text-white text-2xl font-bold">Você caiu!</h2>
          <p className="text-zinc-400">Altura: <span className="text-white font-bold">{score}m</span></p>
          {score >= highScore && score > 0 && (
            <p className="text-yellow-400 font-bold animate-pulse">🏆 Novo Recorde!</p>
          )}
          <p className="text-yellow-400 font-bold">+{earned} pontos ganhos!</p>
          <button onClick={startGame}
            className="px-8 py-3 bg-green-500 hover:bg-green-400 text-white font-bold rounded-xl transition-all hover:scale-105">
            Tentar Novamente
          </button>
        </div>
      )}
    </div>
  )
}
