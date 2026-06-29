import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/adminAuth'

function requireAuth(req: NextRequest): boolean {
  const token = req.cookies.get(COOKIE_NAME)?.value
  return token ? verifyToken(token) : false
}

const GUILD_ID  = () => process.env.DISCORD_GUILD_ID!
const BOT_TOKEN = () => process.env.DISCORD_BOT_TOKEN!
const VERIFIED_ROLE_ID = () => process.env.DISCORD_VERIFIED_ROLE_ID!

async function fetchAllMembers() {
  const members: any[] = []
  let after = '0'

  // Discord API pagina em lotes de até 1000
  for (let i = 0; i < 10; i++) {
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID()}/members?limit=1000&after=${after}`,
      { headers: { Authorization: `Bot ${BOT_TOKEN()}` } }
    )
    if (!res.ok) break
    const batch: any[] = await res.json()
    if (batch.length === 0) break
    members.push(...batch)
    after = batch[batch.length - 1].user.id
    if (batch.length < 1000) break
  }

  return members
}

export async function GET(req: NextRequest) {
  if (!requireAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const roleId = VERIFIED_ROLE_ID()
  const allMembers = await fetchAllMembers()

  const verificados = allMembers
    .filter((m: any) => Array.isArray(m.roles) && m.roles.includes(roleId))
    .map((m: any) => ({
      discordId:  m.user.id,
      username:   m.user.username,
      globalName: m.user.global_name ?? null,
      nick:       m.nick ?? null,
      avatar:     m.user.avatar ?? null,
      joinedAt:   m.joined_at ?? null,
    }))
    .sort((a: any, b: any) => {
      const nameA = (a.nick ?? a.globalName ?? a.username ?? '').toLowerCase()
      const nameB = (b.nick ?? b.globalName ?? b.username ?? '').toLowerCase()
      return nameA.localeCompare(nameB)
    })

  return NextResponse.json(verificados)
}
