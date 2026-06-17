import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@vercel/kv'

export interface ArenaEntry {
  discordId: string
  username: string
  globalName: string | null
  avatar: string | null
  pet: {
    instanceId: string
    petId: number
    name: string
    level: number
    element: string
  }
  registeredAt: number
}

// GET /api/pets/arena?exclude=discordId
// Retorna os jogadores registrados na arena (excluindo o solicitante)
export async function GET(req: NextRequest) {
  const exclude = req.nextUrl.searchParams.get('exclude') ?? ''

  try {
    // Pega os 50 jogadores mais recentes do sorted set
    const ids = await kv.zrange('arena:index', 0, 49, { rev: true }) as string[]
    if (!ids.length) return NextResponse.json([])

    const entries = await Promise.all(
      ids.filter(id => id !== exclude).map(id => kv.get<ArenaEntry>(`arena:${id}`))
    )

    const valid = entries.filter((e): e is ArenaEntry => {
      if (!e) return false
      // Remove entradas sem pet ou muito antigas (>48h)
      if (Date.now() - e.registeredAt > 48 * 60 * 60 * 1000) return false
      return true
    })

    return NextResponse.json(valid)
  } catch (err) {
    console.error('[arena GET]', err)
    return NextResponse.json([])
  }
}

// POST /api/pets/arena
// Registra (ou atualiza) o jogador na arena com o pet ativo
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as ArenaEntry
    if (!body.discordId || !body.pet?.petId) {
      return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 })
    }

    const entry: ArenaEntry = { ...body, registeredAt: Date.now() }

    // Salva entrada individual com TTL de 48h
    await kv.set(`arena:${body.discordId}`, entry, { ex: 48 * 3600 })

    // Atualiza o índice global (score = timestamp para ordenar por recência)
    await kv.zadd('arena:index', { score: Date.now(), member: body.discordId })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[arena POST]', err)
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
  }
}
