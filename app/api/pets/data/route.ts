import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { kvGet, kvSet } from '@/lib/kv'

export async function GET() {
  const cookieStore = await cookies()
  const raw = cookieStore.get('discord_user')?.value
  if (!raw) return NextResponse.json(null, { status: 401 })

  const user = JSON.parse(raw)
  const data = await kvGet(`pets:${user.id}`)
  if (!data) return NextResponse.json(null, { status: 404 })

  return NextResponse.json(JSON.parse(data))
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const raw = cookieStore.get('discord_user')?.value
  if (!raw) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const user = JSON.parse(raw)
  const body = await req.json()

  if (body.discordId !== user.id) {
    return NextResponse.json({ error: 'Proibido' }, { status: 403 })
  }

  await kvSet(`pets:${user.id}`, JSON.stringify(body))
  return NextResponse.json({ ok: true })
}
