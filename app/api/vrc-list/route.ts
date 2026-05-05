import { NextRequest, NextResponse } from 'next/server'

// ─── Cache em memória (5 min) ─────────────────────────────────────────────────
let _cache: { data: string; expiresAt: number } | null = null
const CACHE_TTL = 5 * 60 * 1000

// ─── Checksum (deve ser idêntico ao VipManager.cs) ───────────────────────────
// Soma simples dos char codes módulo 1_000_000_007
function computeChecksum(data: string): number {
  let sum = 0
  for (let i = 0; i < data.length; i++) {
    sum = (sum + data.charCodeAt(i)) % 1_000_000_007
  }
  return sum
}

// ─── Paginação de membros do guild ───────────────────────────────────────────
async function getMembersWithRole(roleId: string): Promise<string[]> {
  if (!roleId) return []

  const guildId = process.env.DISCORD_GUILD_ID!
  const botToken = process.env.DISCORD_BOT_TOKEN!
  const names: string[] = []
  let after = '0'

  while (true) {
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members?limit=1000&after=${after}`,
      { headers: { Authorization: `Bot ${botToken}` } }
    )

    if (!res.ok) {
      console.error('[vrc-list] Discord API erro:', res.status, await res.text())
      break
    }

    const members: any[] = await res.json()
    if (!Array.isArray(members) || members.length === 0) break

    for (const m of members) {
      if (!Array.isArray(m.roles) || !m.roles.includes(roleId)) continue
      // nick = VRChat displayName (definido pelo bot na verificação)
      const vrcName: string | null = m.nick ?? null
      if (vrcName) names.push(vrcName)
    }

    if (members.length < 1000) break
    after = members[members.length - 1].user.id
  }

  return names
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
    // Busca membros por tier em paralelo
    // VIP1 = DISCORD_VIP_ROLE_ID   (apoiadores R$5)
    // VIP2 = DISCORD_VIP2_ROLE_ID  (futuro — opcional)
    // VIP3 = DISCORD_VIP3_ROLE_ID  (futuro — opcional)
    const [tier1, tier2, tier3] = await Promise.all([
      getMembersWithRole(process.env.DISCORD_VIP_ROLE_ID ?? ''),
      getMembersWithRole(process.env.DISCORD_VIP2_ROLE_ID ?? ''),
      getMembersWithRole(process.env.DISCORD_VIP3_ROLE_ID ?? ''),
    ])

    const vip1Line = `VIP1:${tier1.join('|')}`
    const vip2Line = `VIP2:${tier2.join('|')}`
    const vip3Line = `VIP3:${tier3.join('|')}`
    const namesSection = `${vip1Line}\n${vip2Line}\n${vip3Line}`

    const checksum = computeChecksum(namesSection)
    const body = `v1\nCHECKSUM:${checksum}\n${namesSection}`

    _cache = { data: body, expiresAt: Date.now() + CACHE_TTL }

    console.log(`[vrc-list] Gerado — VIP1:${tier1.length} VIP2:${tier2.length} VIP3:${tier3.length} checksum:${checksum}`)

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Cache': 'MISS',
      },
    })
  } catch (e: any) {
    console.error('[vrc-list] Erro:', e)
    return new NextResponse('Server error: ' + e.message, { status: 500 })
  }
}
