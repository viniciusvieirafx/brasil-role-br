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
    // Busca vip-months, vip (ativos) e gifters em paralelo
    const [monthsKeys, vipKeys, gifterKeys] = await Promise.all([
      kvKeys('vip-months:*'),
      kvKeys('vip:*'),
      kvKeys('gifter-points:*'),
    ])

    // ── Top VIPs (quem acumulou mais meses de assinatura) ──
    const [monthsResults, vipResults] = await Promise.all([
      Promise.all(monthsKeys.map((k) => kvGet(k))),
      Promise.all(vipKeys.map((k) => kvGet(k))),
    ])

    // Mapa de meses acumulados por ID (do vip-months)
    const monthsMap = new Map<string, { totalMonths: number; firstPaymentAt: string }>()
    for (let i = 0; i < monthsKeys.length; i++) {
      const raw = monthsResults[i]
      if (!raw) continue
      const data = JSON.parse(raw)
      if (data.totalMonths > 0) {
        const id = monthsKeys[i].replace('vip-months:', '')
        monthsMap.set(id, { totalMonths: data.totalMonths, firstPaymentAt: data.firstPaymentAt })
      }
    }

    // Merge com VIPs ativos que ainda não têm vip-months (baseline de 1 mês)
    const now = new Date()
    for (let i = 0; i < vipKeys.length; i++) {
      const raw = vipResults[i]
      if (!raw) continue
      const data = JSON.parse(raw)
      if (data.vitalicio) continue // VIP vitalício não entra
      if (!data.expiresAt) continue
      const expiry = new Date(data.expiresAt)
      if (expiry <= now) continue // VIP expirado

      const id = vipKeys[i].replace('vip:', '')
      if (!monthsMap.has(id)) {
        monthsMap.set(id, { totalMonths: 1, firstPaymentAt: now.toISOString() })
      }
    }

    const vips = Array.from(monthsMap.entries()).map(([discordId, data]) => ({
      discordId,
      totalMonths: data.totalMonths,
      firstPaymentAt: data.firstPaymentAt,
    }))

    // Ordena: mais meses primeiro, empate por quem assinou primeiro
    vips.sort((a, b) => {
      if (b.totalMonths !== a.totalMonths) return b.totalMonths - a.totalMonths
      return new Date(a.firstPaymentAt).getTime() - new Date(b.firstPaymentAt).getTime()
    })

    // Busca nomes do Discord — pega mais que 10 caso alguns tenham saído do servidor
    const topVipCandidates = vips.slice(0, 20)
    const topVipsWithNames: (typeof vips[0] & { displayName: string })[] = []
    for (const v of topVipCandidates) {
      if (topVipsWithNames.length >= 10) break
      const name = await getDiscordDisplayName(v.discordId)
      if (!name) continue // Membro saiu do servidor — não exibir
      topVipsWithNames.push({ ...v, displayName: name })
    }

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

async function getDiscordDisplayName(userId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/members/${userId}`,
      { headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` } },
    )
    if (!res.ok) return null // Membro não está mais no servidor
    const member = await res.json()
    return member?.nick ?? member?.user?.global_name ?? member?.user?.username ?? null
  } catch {
    return null
  }
}
