import { NextRequest, NextResponse } from 'next/server'

// Cache 5 minutos
let _cache: { data: string; expiresAt: number } | null = null
const CACHE_TTL = 5 * 60 * 1000

async function getNamesWithRole(roleId: string): Promise<string[]> {
  if (!roleId) return []

  const guildId  = process.env.DISCORD_GUILD_ID!
  const botToken = process.env.DISCORD_BOT_TOKEN!
  const names: string[] = []
  let after = '0'

  while (true) {
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members?limit=1000&after=${after}`,
      { headers: { Authorization: `Bot ${botToken}` } }
    )

    if (!res.ok) break

    const members: any[] = await res.json()
    if (!Array.isArray(members) || members.length === 0) break

    for (const m of members) {
      if (!Array.isArray(m.roles) || !m.roles.includes(roleId)) continue

      // Prioridade: nickname do servidor (VRChat) → global name → username
      const name: string =
        m.nick ??
        m.user?.global_name ??
        m.user?.username ??
        null

      if (name) names.push(name)
    }

    if (members.length < 1000) break
    after = members[members.length - 1].user.id
  }

  return names
}

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key')
  if (!key || key !== process.env.VRC_LIST_API_KEY) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  if (_cache && Date.now() < _cache.expiresAt) {
    return new NextResponse(_cache.data, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Cache': 'HIT' },
    })
  }

  try {
    const [tier1, tier2, tier3] = await Promise.all([
      getNamesWithRole(process.env.DISCORD_VIP_ROLE_ID  ?? ''),
      getNamesWithRole(process.env.DISCORD_VIP2_ROLE_ID ?? ''),
      getNamesWithRole(process.env.DISCORD_VIP3_ROLE_ID ?? ''),
    ])

    // Mesmo formato do /api/vrc-list para reusar o parser do SupporterList
    const body = `v1\nVIP1:${tier1.join('|')}\nVIP2:${tier2.join('|')}\nVIP3:${tier3.join('|')}`

    _cache = { data: body, expiresAt: Date.now() + CACHE_TTL }

    console.log(`[vrc-names] VIP1:${tier1.length} VIP2:${tier2.length} VIP3:${tier3.length}`)

    return new NextResponse(body, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  } catch (e: any) {
    return new NextResponse('Server error: ' + e.message, { status: 500 })
  }
}
