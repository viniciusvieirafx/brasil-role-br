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
    // Busca vip-months e gifters em paralelo
    const [monthsKeys, gifterKeys] = await Promise.all([
      kvKeys('vip-months:*'),
      kvKeys('gifter-points:*'),
    ])

    // ── Top VIPs (quem acumulou mais meses de assinatura) ──
    const monthsResults = await Promise.all(monthsKeys.map((k) => kvGet(k)))
    const monthsDiscordIds = monthsKeys.map((k) => k.replace('vip-months:', ''))

    const vips: { discordId: string; totalMonths: number; firstPaymentAt: string }[] = []

    for (let i = 0; i < monthsKeys.length; i++) {
      const raw = monthsResults[i]
      if (!raw) continue
      const data = JSON.parse(raw)
      if (data.totalMonths > 0) {
        vips.push({
          discordId: monthsDiscordIds[i],
          totalMonths: data.totalMonths,
          firstPaymentAt: data.firstPaymentAt,
        })
      }
    }

    // Ordena: mais meses primeiro, empate por quem assinou primeiro
    vips.sort((a, b) => {
      if (b.totalMonths !== a.totalMonths) return b.totalMonths - a.totalMonths
      return new Date(a.firstPaymentAt).getTime() - new Date(b.firstPaymentAt).getTime()
    })

    // Busca nomes do Discord para os top 10
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
