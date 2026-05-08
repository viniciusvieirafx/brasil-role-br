import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/adminAuth'
import { kvGet, kvSet, kvDel } from '@/lib/kv'

function requireAuth(req: NextRequest): boolean {
  const token = req.cookies.get(COOKIE_NAME)?.value
  return token ? verifyToken(token) : false
}

const GUILD_ID  = () => process.env.DISCORD_GUILD_ID!
const BOT_TOKEN = () => process.env.DISCORD_BOT_TOKEN!

// PATCH: atualiza expiresAt
// Body: { addDays: 30 }  ou  { expiresAt: "YYYY-MM-DD" }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!requireAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: discordId } = await params
  const body = await req.json()

  const raw      = await kvGet(`vip:${discordId}`)
  const existing = raw ? JSON.parse(raw) : { roleId: process.env.DISCORD_VIP_ROLE_ID! }

  let newDate: Date
  if (body.addDays) {
    // Adiciona a partir do vencimento atual (se ainda válido) ou de hoje
    const base  = existing.expiresAt ? new Date(existing.expiresAt) : new Date()
    const today = new Date()
    newDate = base > today ? base : today
    newDate.setDate(newDate.getDate() + Number(body.addDays))
  } else if (body.expiresAt) {
    newDate = new Date(body.expiresAt)
  } else {
    return NextResponse.json({ error: 'Forneça addDays ou expiresAt' }, { status: 400 })
  }

  const expiresAtStr = newDate.toISOString().split('T')[0]

  await kvSet(`vip:${discordId}`, JSON.stringify({
    expiresAt: expiresAtStr,
    roleId:    existing.roleId,
  }))

  // Garante que o cargo VIP está atribuído no Discord
  await fetch(
    `https://discord.com/api/v10/guilds/${GUILD_ID()}/members/${discordId}/roles/${existing.roleId}`,
    {
      method:  'PUT',
      headers: { Authorization: `Bot ${BOT_TOKEN()}`, 'Content-Type': 'application/json' },
    }
  )

  return NextResponse.json({ ok: true, expiresAt: expiresAtStr })
}

// DELETE: remove o VIP
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!requireAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: discordId } = await params
  const raw = await kvGet(`vip:${discordId}`)

  if (raw) {
    const entry = JSON.parse(raw)
    await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID()}/members/${discordId}/roles/${entry.roleId}`,
      { method: 'DELETE', headers: { Authorization: `Bot ${BOT_TOKEN()}` } }
    )
    await kvDel(`vip:${discordId}`)
  }

  return NextResponse.json({ ok: true })
}
