import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/adminAuth'
import { kvGet, kvSet } from '@/lib/kv'
import { sendDiscordDMEmbed } from '@/lib/discord-dm'

const NOTIFY_CHANNEL = '1480918950404423835'
const ANNOUNCE_CHANNEL = '1480918969819992084'

const TIER_NAMES: Record<number, string> = {
  1: 'VIP Bronze',
  2: 'VIP Prata',
  3: 'VIP Ouro',
}

const TIER_COLORS: Record<number, number> = {
  1: 0xCD7F32,
  2: 0xC0C0C0,
  3: 0xFFD700,
}

async function getDisplayName(discordUserId: string): Promise<string> {
  const memberRes = await fetch(
    `https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/members/${discordUserId}`,
    { headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` } },
  )
  const member = memberRes.ok ? await memberRes.json() : null
  return member?.nick ?? member?.user?.global_name ?? member?.user?.username ?? discordUserId
}

async function addVipRole(discordUserId: string, tier: number) {
  const roleByTier: Record<number, string | undefined> = {
    1: process.env.DISCORD_VIP_ROLE_ID,
    2: process.env.DISCORD_VIP2_ROLE_ID,
    3: process.env.DISCORD_VIP3_ROLE_ID,
  }
  const roleId = roleByTier[tier] ?? process.env.DISCORD_VIP_ROLE_ID!

  const lowerRoles = [
    tier > 1 ? process.env.DISCORD_VIP_ROLE_ID : undefined,
    tier > 2 ? process.env.DISCORD_VIP2_ROLE_ID : undefined,
  ].filter(Boolean) as string[]

  for (const lowerRoleId of lowerRoles) {
    await fetch(
      `https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/members/${discordUserId}/roles/${lowerRoleId}`,
      { method: 'DELETE', headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` } },
    ).catch(() => {})
  }

  await fetch(
    `https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/members/${discordUserId}/roles/${roleId}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
    },
  )

  return roleId
}

async function incrementVipMonths(discordUserId: string, months: number = 1) {
  const key = `vip-months:${discordUserId}`
  const raw = await kvGet(key)
  const data = raw ? JSON.parse(raw) : { totalMonths: 0, firstPaymentAt: new Date().toISOString() }
  data.totalMonths += months
  await kvSet(key, JSON.stringify(data))
}

/* ── POST /api/controle/gift-bulk ────────────────────────
   Body: { buyerNick: string, tier: number, quantity: number }
   Distribui VIPs para membros aleatórios do servidor (admin only)
──────────────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const buyerId: string | undefined = body.buyerId?.trim()
  const tier: number = [1, 2, 3].includes(body.tier) ? body.tier : 1
  const quantity: number = Math.max(1, Math.min(50, parseInt(body.quantity) || 10))

  if (!buyerId) {
    return NextResponse.json({ error: 'buyerId é obrigatório' }, { status: 400 })
  }

  const buyerName = await getDisplayName(buyerId)

  const vipRoleIds = [
    process.env.DISCORD_VIP_ROLE_ID,
    process.env.DISCORD_VIP2_ROLE_ID,
    process.env.DISCORD_VIP3_ROLE_ID,
  ].filter(Boolean) as string[]

  const verifiedRoleId = process.env.DISCORD_VERIFIED_ROLE_ID!

  // Busca todos os membros do servidor
  const allMembers: any[] = []
  let after = '0'
  while (true) {
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/members?limit=1000&after=${after}`,
      { headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` } },
    )
    if (!res.ok) break
    const members: any[] = await res.json()
    if (!Array.isArray(members) || members.length === 0) break
    allMembers.push(...members)
    if (members.length < 1000) break
    after = members[members.length - 1].user.id
  }

  // Filtra: não-bot, sem VIP, não é o comprador
  const eligible = allMembers.filter((m) => {
    if (m.user?.bot) return false
    if (m.user?.id === buyerId) return false
    if (!Array.isArray(m.roles)) return false
    return !m.roles.some((r: string) => vipRoleIds.includes(r))
  })

  if (eligible.length === 0) {
    return NextResponse.json({ error: 'Nenhum membro elegível encontrado' }, { status: 400 })
  }

  // Shuffle Fisher-Yates
  for (let i = eligible.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[eligible[i], eligible[j]] = [eligible[j], eligible[i]]
  }

  const giftCounts = new Map<string, number>()
  for (let i = 0; i < quantity; i++) {
    const member = eligible[i % eligible.length]
    const id = member.user.id
    giftCounts.set(id, (giftCounts.get(id) || 0) + 1)
  }

  const tierName = TIER_NAMES[tier] ?? `VIP Tier ${tier}`
  let activatedCount = 0
  let pendingCount = 0
  const membersGifted = giftCounts.size

  for (const [memberId, count] of giftCounts) {
    const member = eligible.find((m: any) => m.user.id === memberId)!
    const isVerified = Array.isArray(member.roles) && member.roles.includes(verifiedRoleId)
    const totalDays = count * 30
    const daysLabel = count > 1 ? `${totalDays} dias (${count}x 30 dias)` : '30 dias'

    if (isVerified) {
      const roleId = await addVipRole(memberId, tier)

      const existingRaw = await kvGet(`vip:${memberId}`)
      const existing = existingRaw ? JSON.parse(existingRaw) : {}
      const now = new Date()
      const currentExpiry = existing.expiresAt ? new Date(existing.expiresAt) : now
      const baseDate = currentExpiry > now ? currentExpiry : now
      baseDate.setDate(baseDate.getDate() + totalDays)
      const expiresStr = baseDate.toISOString().split('T')[0]

      await kvSet(`vip:${memberId}`, JSON.stringify({
        ...existing, expiresAt: expiresStr, roleId, tier, optOut: false, ultimoAviso: undefined,
      }))
      await incrementVipMonths(memberId, count)
      activatedCount++

      await sendDiscordDMEmbed(memberId, {
        title: '🎁 Voce ganhou VIP!',
        description: `**${buyerName}** fez um presente em massa e voce foi um dos contemplados!\n\nSeu **${tierName}** ja esta ativo e vale por **${daysLabel}**.`,
        color: TIER_COLORS[tier] ?? 0xFFD700,
      })
    } else {
      const pendingKey = `pending-gifts:${memberId}`
      const existingRaw = await kvGet(pendingKey)
      const existingGifts = existingRaw ? JSON.parse(existingRaw) : []
      existingGifts.push({ tier, buyerId, buyerName, count, createdAt: new Date().toISOString() })
      await kvSet(pendingKey, JSON.stringify(existingGifts))
      pendingCount++

      await sendDiscordDMEmbed(memberId, {
        title: '🎁 Voce ganhou VIP!',
        description: `**${buyerName}** fez um presente em massa e voce foi um dos contemplados!\n\nPara receber seu **${tierName}** (**${daysLabel}**), voce precisa verificar sua conta VRChat em **brasil-role-br.com**.\n\nApos verificar, seu VIP sera ativado automaticamente!`,
        color: TIER_COLORS[tier] ?? 0xFFD700,
      })
    }
  }

  // Acumula pontos do presenteador
  const totalPoints = tier * quantity
  const gifterKey = `gifter-points:${buyerId}`
  const existingGifter = await kvGet(gifterKey)
  const gifterData = existingGifter ? JSON.parse(existingGifter) : { displayName: buyerName, points: 0, firstGiftAt: new Date().toISOString() }
  gifterData.displayName = buyerName
  gifterData.points += totalPoints
  await kvSet(gifterKey, JSON.stringify(gifterData))

  // Notificacao no canal admin
  const fields = [
    { name: '🎁 Presenteador', value: `${buyerName} (<@${buyerId}>)`, inline: true },
    { name: '🏅 Plano', value: tierName, inline: true },
    { name: '📦 Presentes', value: `${quantity}`, inline: true },
    { name: '👥 Membros contemplados', value: `${membersGifted}`, inline: true },
    { name: '✅ Ativados', value: `${activatedCount}`, inline: true },
    { name: '⏳ Pendentes (nao verificados)', value: `${pendingCount}`, inline: true },
  ]

  await fetch(`https://discord.com/api/v10/channels/${NOTIFY_CHANNEL}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      embeds: [{
        title: `🎁 Presente em Massa — ${quantity}x ${tierName}`,
        color: TIER_COLORS[tier] ?? 0xFFD700,
        fields,
        footer: { text: 'Brasil Role BR · VIP' },
        timestamp: new Date().toISOString(),
      }],
    }),
  })

  // Anuncio publico no canal de presentes
  const winnerMentions = [...giftCounts.keys()].map((id) => `<@${id}>`).join(', ')
  await fetch(`https://discord.com/api/v10/channels/${ANNOUNCE_CHANNEL}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content: `🎁 <@${buyerId}> presenteou o servidor com **${quantity}x ${tierName}**!\n\nOs ganhadores foram: ${winnerMentions}`,
      allowed_mentions: { parse: ['users'] },
    }),
  })

  return NextResponse.json({
    ok: true,
    buyerName,
    quantity,
    tier,
    tierName,
    membersGifted,
    activatedCount,
    pendingCount,
    gifterPoints: gifterData.points,
  })
}
