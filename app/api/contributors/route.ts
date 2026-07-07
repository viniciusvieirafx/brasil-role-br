import { NextResponse } from 'next/server'
import { kvKeys, kvGet } from '@/lib/kv'

// Cache em memória (5 min)
let _cache: { data: any; expiresAt: number } | null = null
const CACHE_TTL = 5 * 60 * 1000

export async function GET() {
  if (_cache && Date.now() < _cache.expiresAt) {
    return NextResponse.json(_cache.data)
  }

  try {
    // Busca todos os VIPs e gifters em paralelo
    const [vipKeys, gifterKeys] = await Promise.all([
      kvKeys('vip:*'),
      kvKeys('gifter-points:*'),
    ])

    // ── Top VIPs (assinantes com mais tempo restante / tier mais alto) ──
    const vipResults = await Promise.all(vipKeys.map((k) => kvGet(k)))
    const vipDiscordIds = vipKeys.map((k) => k.replace('vip:', ''))

    const now = new Date()
    const vips: { discordId: string; tier: number; expiresAt: string; daysLeft: number }[] = []

    for (let i = 0; i < vipKeys.length; i++) {
      const raw = vipResults[i]
      if (!raw) continue
      const data = JSON.parse(raw)
      if (!data.expiresAt) continue
      const expiry = new Date(data.expiresAt)
      const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      if (daysLeft <= 0) continue // VIP expirado
      vips.push({
        discordId: vipDiscordIds[i],
        tier: data.tier ?? 1,
        expiresAt: data.expiresAt,
        daysLeft,
      })
    }

    // Ordena: tier mais alto primeiro, depois mais dias restantes
    vips.sort((a, b) => {
      if (b.tier !== a.tier) return b.tier - a.tier
      return b.daysLeft - a.daysLeft
    })

    // Busca nomes do Discord para os top 10 VIPs
    const topVips = vips.slice(0, 10)
    const topVipsWithNames = await Promise.all(
      topVips.map(async (v) => {
        const name = await getDiscordDisplayName(v.discordId)
        return { ...v, displayName: name }
      }),
    )

    // ── Top Gifters ──
    const gifterResults = await Promise.all(gifterKeys.map((k) => kvGet(k)))
    const gifters: { displayName: string; points: number; firstGiftAt: string }[] = []

    for (const raw of gifterResults) {
      if (!raw) continue
      const data = JSON.parse(raw)
      if (data.points > 0) {
        gifters.push({
          displayName: data.displayName,
          points: data.points,
          firstGiftAt: data.firstGiftAt,
        })
      }
    }

    gifters.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      return new Date(a.firstGiftAt).getTime() - new Date(b.firstGiftAt).getTime()
    })

    const result = {
      topVips: topVipsWithNames,
      topGifters: gifters.slice(0, 10),
    }

    _cache = { data: result, expiresAt: Date.now() + CACHE_TTL }

    return NextResponse.json(result)
  } catch (e: any) {
    console.error('[contributors] Erro:', e)
    return NextResponse.json({ topVips: [], topGifters: [] })
  }
}

async function getDiscordDisplayName(userId: string): Promise<string> {
  try {
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/members/${userId}`,
      { headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` } },
    )
    if (!res.ok) return userId
    const member = await res.json()
    return member?.nick ?? member?.user?.global_name ?? member?.user?.username ?? userId
  } catch {
    return userId
  }
}
