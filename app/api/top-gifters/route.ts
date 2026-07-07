import { NextRequest, NextResponse } from 'next/server'
import { kvGet, kvKeys } from '@/lib/kv'

// ─── Cache em memória (5 min) ─────────────────────────────────────────────────
let _cache: { data: string; expiresAt: number } | null = null
const CACHE_TTL = 5 * 60 * 1000

// ─── Checksum (deve ser idêntico ao VipManager.cs) ───────────────────────────
function computeChecksum(data: string): number {
  let sum = 0
  for (let i = 0; i < data.length; i++) {
    sum = (sum + data.charCodeAt(i)) % 1_000_000_007
  }
  return sum
}

// ─── Handler ─────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  // Valida chave secreta na query string
  const key = req.nextUrl.searchParams.get('key')
  if (!key || key !== process.env.VRC_LIST_API_KEY) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  // Cache ainda válido?
  if (_cache && Date.now() < _cache.expiresAt) {
    return new NextResponse(_cache.data, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Cache': 'HIT' },
    })
  }

  try {
    // Busca todas as chaves de presenteadores
    const gifterKeys = await kvKeys('gifter-points:*')

    // Busca dados de cada presenteador em paralelo
    const gifters: { displayName: string; points: number; firstGiftAt: string }[] = []
    if (gifterKeys.length > 0) {
      const results = await Promise.all(gifterKeys.map((k) => kvGet(k)))
      for (const raw of results) {
        if (!raw) continue
        const data = JSON.parse(raw)
        if (data.points > 0) {
          gifters.push({
            displayName: data.displayName,
            points: data.points,
            firstGiftAt: data.firstGiftAt,
          })
        }
      }
    }

    // Ordena: maior pontuação primeiro, empate por quem presenteou primeiro
    gifters.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      return new Date(a.firstGiftAt).getTime() - new Date(b.firstGiftAt).getTime()
    })

    // Top 10
    const top10 = gifters.slice(0, 10)

    // Monta linha GIFTERS
    const giftersLine = `GIFTERS:${top10.map((g) => `${g.displayName}:${g.points}`).join('|')}`
    const checksum = computeChecksum(giftersLine)
    const body = `v1\nCHECKSUM:${checksum}\n${giftersLine}`

    _cache = { data: body, expiresAt: Date.now() + CACHE_TTL }

    console.log(`[top-gifters] Gerado — ${top10.length} gifters, checksum:${checksum}`)

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Cache': 'MISS',
      },
    })
  } catch (e: any) {
    console.error('[top-gifters] Erro:', e)
    return new NextResponse('Server error: ' + e.message, { status: 500 })
  }
}
