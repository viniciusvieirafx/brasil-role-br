import { NextResponse } from 'next/server'

const WORLD_ID = 'wrld_7206c98b-68bd-4468-8b2c-55c9d874d844'
const GROUP_ID = 'grp_275fe686-68b0-4de1-851f-fa2b9297c77e'

const CACHE_TTL = 10 * 60 * 1000 // 10 minutos
let cached: { data: Record<string, number>; ts: number } | null = null

async function fetchProxy(path: string) {
  const proxyUrl = process.env.VRCHAT_PROXY_URL
  const proxyKey = process.env.VRCHAT_PROXY_KEY
  if (!proxyUrl || !proxyKey) return null

  const res = await fetch(`${proxyUrl}${path}`, {
    headers: { 'x-api-key': proxyKey },
  })
  if (!res.ok) return null
  return res.json()
}

async function fetchDiscordMemberCount() {
  const guildId = process.env.DISCORD_GUILD_ID
  const botToken = process.env.DISCORD_BOT_TOKEN
  if (!guildId || !botToken) return null

  const res = await fetch(
    `https://discord.com/api/v10/guilds/${guildId}?with_counts=true`,
    { headers: { Authorization: `Bot ${botToken}` } }
  )
  if (!res.ok) return null
  const guild = await res.json()
  return guild.approximate_member_count ?? null
}

// Fallback values caso alguma API falhe
const FALLBACK = { visits: 18000, favorites: 50, groupMembers: 400, discordMembers: 250 }

export async function GET() {
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data, {
      headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=300' },
    })
  }

  const [world, group, discordMembers] = await Promise.all([
    fetchProxy(`/world/${WORLD_ID}`).catch(() => null),
    fetchProxy(`/group/${GROUP_ID}`).catch(() => null),
    fetchDiscordMemberCount().catch(() => null),
  ])

  const data = {
    visits: world?.visits ?? FALLBACK.visits,
    favorites: world?.favorites ?? FALLBACK.favorites,
    groupMembers: group?.memberCount ?? FALLBACK.groupMembers,
    discordMembers: discordMembers ?? FALLBACK.discordMembers,
  }

  cached = { data, ts: Date.now() }

  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=300' },
  })
}
