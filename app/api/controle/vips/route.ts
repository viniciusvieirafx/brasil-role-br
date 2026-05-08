import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/adminAuth'
import { kvKeys, kvGet } from '@/lib/kv'

function requireAuth(req: NextRequest): boolean {
  const token = req.cookies.get(COOKIE_NAME)?.value
  return token ? verifyToken(token) : false
}

export async function GET(req: NextRequest) {
  if (!requireAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const keys = await kvKeys('vip:*')

  // Busca membros do Discord para resolver nomes
  let memberMap = new Map<string, { username: string; globalName: string | null; nick: string | null }>()
  try {
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/members?limit=1000`,
      { headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` } }
    )
    if (res.ok) {
      const members: any[] = await res.json()
      for (const m of members) {
        if (m.user?.id) {
          memberMap.set(m.user.id, {
            username:   m.user.username,
            globalName: m.user.global_name ?? null,
            nick:       m.nick ?? null,
          })
        }
      }
    }
  } catch {}

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const vips = (
    await Promise.all(
      keys.map(async (key) => {
        const discordId = key.replace('vip:', '')
        const raw = await kvGet(key)
        if (!raw) return null
        let entry: { expiresAt: string; roleId: string }
        try { entry = JSON.parse(raw) } catch { return null }

        const exp = new Date(entry.expiresAt)
        exp.setHours(0, 0, 0, 0)
        const diasRestantes = Math.ceil((exp.getTime() - today.getTime()) / 86_400_000)
        const member = memberMap.get(discordId)

        return {
          discordId,
          username:       member?.username   ?? null,
          globalName:     member?.globalName ?? null,
          nick:           member?.nick       ?? null,
          expiresAt:      entry.expiresAt,
          diasRestantes,
          ativo:          diasRestantes > 0,
        }
      })
    )
  )
    .filter(Boolean)
    .sort((a, b) => a!.diasRestantes - b!.diasRestantes)

  return NextResponse.json(vips)
}
