import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/adminAuth'
import { kvSet } from '@/lib/kv'

function requireAuth(req: NextRequest): boolean {
  const token = req.cookies.get(COOKIE_NAME)?.value
  return token ? verifyToken(token) : false
}

const GUILD_ID  = () => process.env.DISCORD_GUILD_ID!
const BOT_TOKEN = () => process.env.DISCORD_BOT_TOKEN!

export async function POST(req: NextRequest) {
  if (!requireAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const roleId = process.env.DISCORD_VIP_ROLE_ID!
  const body: { id: string; vence: string; nick?: string }[] = await req.json()

  if (!Array.isArray(body)) {
    return NextResponse.json({ error: 'Body deve ser um array' }, { status: 400 })
  }

  const results: { id: string; nick?: string; status: string }[] = []

  for (const entry of body) {
    if (!entry.id || !entry.vence) {
      results.push({ id: entry.id ?? '?', status: 'ignorado (sem id ou vence)' })
      continue
    }

    await kvSet(`vip:${entry.id}`, JSON.stringify({ expiresAt: entry.vence, roleId }))

    // Atribui cargo VIP no Discord
    const discordRes = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID()}/members/${entry.id}/roles/${roleId}`,
      {
        method:  'PUT',
        headers: { Authorization: `Bot ${BOT_TOKEN()}`, 'Content-Type': 'application/json' },
      }
    )

    results.push({
      id:     entry.id,
      nick:   entry.nick,
      status: discordRes.ok ? 'importado' : `redis ok, discord ${discordRes.status}`,
    })
  }

  return NextResponse.json({ total: results.length, results })
}
