import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { kvGet, kvSet, kvDel } from '@/lib/kv'

export interface ServerNotification {
  id: string
  type: 'battle_defended'
  message: string
  timestamp: number
  points?: number
}

const KEY = (discordId: string) => `pet_notifs:${discordId}`
const MAX_NOTIFS = 30

// GET /api/pets/notifications
// Retorna e limpa as notificações server-side do usuário autenticado
export async function GET() {
  const cookieStore = await cookies()
  const raw = cookieStore.get('discord_user')?.value
  if (!raw) return NextResponse.json([], { status: 401 })

  const user = JSON.parse(raw)
  try {
    const raw_data = await kvGet(KEY(user.id))
    if (!raw_data) return NextResponse.json([])
    const data: ServerNotification[] = JSON.parse(raw_data)
    if (!data || data.length === 0) return NextResponse.json([])

    // Limpa após leitura
    await kvDel(KEY(user.id))
    return NextResponse.json(data)
  } catch {
    return NextResponse.json([])
  }
}

// DELETE /api/pets/notifications
// Limpa as notificações server-side do usuário (chamado pelo botão Limpar)
export async function DELETE() {
  const cookieStore = await cookies()
  const raw = cookieStore.get('discord_user')?.value
  if (!raw) return NextResponse.json({ ok: false }, { status: 401 })

  const user = JSON.parse(raw)
  try {
    await kvDel(KEY(user.id))
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false })
  }
}

// POST /api/pets/notifications
// Adiciona uma notificação server-side para um usuário (chamado pelo browser de quem batalhou)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      targetDiscordId: string
      type: 'battle_defended'
      message: string
      points?: number
    }

    if (!body.targetDiscordId || !body.type || !body.message) {
      return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 })
    }

    const notif: ServerNotification = {
      id: crypto.randomUUID(),
      type: body.type,
      message: body.message,
      timestamp: Date.now(),
      points: body.points,
    }

    const raw_data = await kvGet(KEY(body.targetDiscordId))
    const existing: ServerNotification[] = raw_data ? JSON.parse(raw_data) : []
    const updated = [notif, ...existing].slice(0, MAX_NOTIFS)
    await kvSet(KEY(body.targetDiscordId), JSON.stringify(updated))

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[notifications POST]', err)
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
  }
}

// GET /api/pets/notifications/count — não usado via este arquivo
// Implementado como rota separada se necessário
