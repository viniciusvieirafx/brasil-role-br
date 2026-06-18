'use client'

import { useEffect, useRef } from 'react'

export type AnimType = 'walk' | 'attack' | 'hit' | 'idle' | 'dead'

interface Props {
  petId: number
  anim?: AnimType
  width?: number
  height?: number
  fps?: number
  flipX?: boolean
  smooth?: boolean   // true = bilinear (melhor qualidade em tamanhos grandes)
  className?: string
}

// Frame counts reais por monstro — cada grupo de 5 tem contagens diferentes
// Extraído dos metadados Unity dos sprite sheets originais
const GROUP_FRAMES: { ids: [number,number]; walk:number; attack:number; hit:number; idle:number; dead:number }[] = [
  { ids:[1,5],    walk:20, attack:24, hit:17, idle:27, dead:28 },
  { ids:[6,10],   walk:40, attack:34, hit:17, idle:27, dead:43 },
  { ids:[11,15],  walk:40, attack:34, hit:17, idle:28, dead:43 },
  { ids:[16,20],  walk:41, attack:27, hit:17, idle:40, dead:21 },
  { ids:[21,25],  walk:20, attack:24, hit:17, idle:27, dead:28 },
  { ids:[26,30],  walk:40, attack:34, hit:17, idle:28, dead:43 },
  { ids:[31,35],  walk:20, attack:24, hit:18, idle:34, dead:37 },
  { ids:[36,40],  walk:20, attack:17, hit:17, idle:27, dead:21 },
  { ids:[41,45],  walk:27, attack:27, hit:17, idle:54, dead:25 },
  { ids:[46,50],  walk:40, attack:34, hit:17, idle:28, dead:43 },
  { ids:[51,55],  walk:40, attack:34, hit:17, idle:28, dead:43 },
  { ids:[56,60],  walk:15, attack:30, hit:17, idle:20, dead:31 },
  { ids:[61,65],  walk:27, attack:23, hit:14, idle:27, dead:33 },
  { ids:[66,70],  walk:20, attack:20, hit:17, idle:27, dead:21 },
  { ids:[71,75],  walk:15, attack:30, hit:17, idle:20, dead:31 },
  { ids:[76,80],  walk:20, attack:27, hit:27, idle:27, dead:37 },
  { ids:[81,85],  walk:40, attack:34, hit:17, idle:28, dead:43 },
  { ids:[86,90],  walk:40, attack:32, hit:17, idle:34, dead:47 },
  { ids:[91,95],  walk:23, attack:21, hit:17, idle:40, dead:22 },
  { ids:[96,100], walk:20, attack:24, hit:17, idle:27, dead:28 },
]

function getFrameCount(petId: number, anim: AnimType): number {
  const g = GROUP_FRAMES.find(g => petId >= g.ids[0] && petId <= g.ids[1])
  return g ? g[anim] : 20
}

const STRIP_SIZE = 358  // px por frame nos strips (resolução original)

export default function PetAnimator({
  petId, anim = 'walk', width = 96, height = 96, fps = 10, flipX = false, smooth = false, className = ''
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Armazena imagem + anim que a originou — evita usar imagem errada com lógica errada
  const imgRef = useRef<{ img: HTMLImageElement; anim: AnimType } | null>(null)
  const rafRef = useRef(0)
  const frameRef = useRef(0)
  const lastTimeRef = useRef(0)

  // Carrega o strip correto sempre que petId ou anim mudam
  useEffect(() => {
    let active = true
    imgRef.current = null  // limpa imediatamente — sem imagem stale

    const img = new Image()
    img.src = `/pets/strips/monster_${String(petId).padStart(3, '0')}_${anim}.png`
    img.onload = () => {
      if (active) imgRef.current = { img, anim }
    }
    img.onerror = () => {
      // Fallback: draw a colored placeholder emoji on canvas
      if (!active) return
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = 'rgba(255,215,0,0.15)'
      ctx.beginPath()
      ctx.roundRect(0, 0, width, height, width * 0.2)
      ctx.fill()
      ctx.font = `${Math.floor(width * 0.55)}px serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('🐾', width / 2, height / 2)
    }
    return () => { active = false }
  }, [petId, anim])

  // Loop de animação
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = smooth
    if (smooth) ctx.imageSmoothingQuality = 'high'
    const interval = 1000 / fps
    const frames = getFrameCount(petId, anim)
    frameRef.current = 0
    lastTimeRef.current = 0

    function draw(now: number) {
      if (now - lastTimeRef.current >= interval) {
        lastTimeRef.current = now
        frameRef.current = (frameRef.current + 1) % frames

        ctx.clearRect(0, 0, width, height)

        const loaded = imgRef.current
        // Só desenha se a imagem pertence à anim atual
        if (!loaded || loaded.anim !== anim) {
          rafRef.current = requestAnimationFrame(draw)
          return
        }

        ctx.save()
        if (flipX) {
          ctx.translate(width, 0)
          ctx.scale(-1, 1)
        }

        const f = frameRef.current
        ctx.drawImage(loaded.img, f * STRIP_SIZE, 0, STRIP_SIZE, STRIP_SIZE, 0, 0, width, height)

        ctx.restore()
      }
      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [petId, anim, width, height, fps, flipX, smooth])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={className}
      style={{ imageRendering: smooth ? 'auto' : 'pixelated' }}
    />
  )
}
