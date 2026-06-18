import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/adminAuth'
import { kvGet, kvSet, kvDel } from '@/lib/kv'

function requireAuth(req: NextRequest): boolean {
  const token = req.cookies.get(COOKIE_NAME)?.value
  return token ? verifyToken(token) : false
}

const GUILD_ID  = () => process.env.DISCORD_GUILD_ID!
const BOT_TOKEN = () => process.env.DISCORD_BOT_TOKEN!

function roleForTier(tier?: number): string {
  if (tier === 3) return process.env.DISCORD_VIP3_ROLE_ID ?? process.env.DISCORD_VIP_ROLE_ID!
  if (tier === 2) return process.env.DISCORD_VIP2_ROLE_ID ?? process.env.DISCORD_VIP_ROLE_ID!
  return process.env.DISCORD_VIP_ROLE_ID!
}

// PATCH: atualiza expiresAt / tier / vitalicio
// Body: { addDays: 30 }  |  { expiresAt: "YYYY-MM-DD" }  |  { tier: 1|2|3, vitalicio: bool, expiresAt: ... }
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
  const existing = raw ? JSON.parse(raw) : {}

  // Tier e vitalício vindos do body ou mantém o que já existe
  const tier      = body.tier      ?? existing.tier      ?? 1
  const vitalicio = body.vitalicio ?? existing.vitalicio ?? false
  const roleId    = roleForTier(tier)

  let newDate: Date
  if (body.addDays) {
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
    roleId,
    tier,
    vitalicio,
  }))

  // Remove roles de outros tiers para evitar duplicidade
  const allRoles = [
    process.env.DISCORD_VIP_ROLE_ID,
    process.env.DISCORD_VIP2_ROLE_ID,
    process.env.DISCORD_VIP3_ROLE_ID,
  ].filter(Boolean) as string[]

  for (const r of allRoles) {
    if (r === roleId) continue
    await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID()}/members/${discordId}/roles/${r}`,
      { method: 'DELETE', headers: { Authorization: `Bot ${BOT_TOKEN()}` } }
    ).catch(() => {})
  }

  // Garante que o cargo correto está atribuído
  await fetch(
    `https://discord.com/api/v10/guilds/${GUILD_ID()}/members/${discordId}/roles/${roleId}`,
    { method: 'PUT', headers: { Authorization: `Bot ${BOT_TOKEN()}`, 'Content-Type': 'application/json' } }
  )

  return NextResponse.json({ ok: true, expiresAt: expiresAtStr, tier, vitalicio })
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
