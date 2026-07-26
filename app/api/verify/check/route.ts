import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { kvGet, kvSet, kvDel } from '@/lib/kv'
import { sendDiscordDMEmbed } from '@/lib/discord-dm'

const NOTIFY_CHANNEL = '1480918950404423835'

async function getVRChatUser(username: string): Promise<{ bio: string; displayName: string } | null> {
  const proxyUrl = process.env.VRCHAT_PROXY_URL
  const proxyKey = process.env.VRCHAT_PROXY_KEY

  if (!proxyUrl || !proxyKey) throw new Error('Proxy VRChat não configurado')

  const res = await fetch(`${proxyUrl}/user?name=${encodeURIComponent(username)}`, {
    headers: { 'x-api-key': proxyKey },
    cache: 'no-store',
  })

  if (res.status === 401) throw new Error('API key inválida')
  if (res.status === 503) throw new Error('Sessão VRChat expirada, tente em instantes')
  if (!res.ok) throw new Error(`Erro no proxy: ${res.status}`)

  const data = await res.json()
  if (!data.found) return null
  return { bio: data.bio ?? '', displayName: data.displayName }
}

async function addDiscordRole(userId: string) {
  const res = await fetch(
    `https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/members/${userId}/roles/${process.env.DISCORD_VERIFIED_ROLE_ID}`,
    { method: 'PUT', headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' } }
  )
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error(`[verify] FALHA ao adicionar cargo para ${userId}: HTTP ${res.status} ${body}`)
    throw new Error(`Erro ao ativar cargo no Discord (${res.status}). Tente novamente ou contate o suporte.`)
  }
}

async function changeDiscordNickname(userId: string, nickname: string) {
  const res = await fetch(
    `https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/members/${userId}`,
    { method: 'PATCH', headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ nick: nickname }) }
  )
  if (!res.ok) {
    console.error(`[verify] Falha ao mudar nick de ${userId}: HTTP ${res.status}`)
    // Não bloqueia a verificação por causa do nick
  }
}

async function sendDiscordNotification(discordUser: { id: string; username: string; globalName: string | null }, vrchatName: string) {
  const name = discordUser.globalName ?? discordUser.username
  await fetch(`https://discord.com/api/v10/channels/${NOTIFY_CHANNEL}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embeds: [{
        title: '✅ Usuário Verificado',
        color: 0x009B3A,
        fields: [
          { name: 'Discord', value: `${name} (<@${discordUser.id}>)`, inline: true },
          { name: 'VRChat', value: vrchatName, inline: true },
        ],
        timestamp: new Date().toISOString(),
      }],
    }),
  })
}

export async function POST(_req: NextRequest) {
  const cookieStore = await cookies()
  const discordUserCookie = cookieStore.get('discord_user')
  const verifyDataCookie = cookieStore.get('verify_data')

  if (!discordUserCookie || !verifyDataCookie) {
    return NextResponse.json({ error: 'Sessão expirada, clique em "Trocar usuário" e tente novamente' }, { status: 401 })
  }

  const discordUser = JSON.parse(discordUserCookie.value)
  const { vrchatUsername, code } = JSON.parse(verifyDataCookie.value)

  let vrchatUser
  try {
    vrchatUser = await getVRChatUser(vrchatUsername)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }

  if (!vrchatUser) {
    return NextResponse.json({ verified: false, error: `Usuário "${vrchatUsername}" não encontrado. Confira o nome exato no VRChat.` })
  }

  if (!vrchatUser.bio.includes(code)) {
    return NextResponse.json({ verified: false, error: 'Código não encontrado na bio. Certifique-se que salvou o perfil no VRChat.' })
  }

  try {
    await addDiscordRole(discordUser.id)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }

  // Nick e notificação são best-effort — não bloqueiam
  await Promise.allSettled([
    changeDiscordNickname(discordUser.id, vrchatUser.displayName),
    sendDiscordNotification(discordUser, vrchatUser.displayName),
  ])

  // Processa presentes pendentes (de presente em massa)
  activatePendingGifts(discordUser.id).catch((e) =>
    console.error(`[verify] Erro ao ativar presentes pendentes para ${discordUser.id}:`, e),
  )

  // Processa presentes pendentes por nome VRChat (de grupos verificados)
  activatePendingVrcGifts(discordUser.id, vrchatUser.displayName).catch((e) =>
    console.error(`[verify] Erro ao ativar presentes VRC pendentes para ${discordUser.id}:`, e),
  )

  // Limpa código de verificação do KV e cookie
  kvDel(`verify-code:${discordUser.id}:${vrchatUsername.toLowerCase()}`).catch(() => {})
  cookieStore.set('verify_data', '', { maxAge: 0, path: '/' })
  return NextResponse.json({ verified: true })
}

/* ── Ativar presentes pendentes de presente em massa ── */

const TIER_ROLES: Record<number, string | undefined> = {
  1: process.env.DISCORD_VIP_ROLE_ID,
  2: process.env.DISCORD_VIP2_ROLE_ID,
  3: process.env.DISCORD_VIP3_ROLE_ID,
}

const TIER_NAMES: Record<number, string> = { 1: 'VIP Bronze', 2: 'VIP Prata', 3: 'VIP Ouro' }
const TIER_COLORS: Record<number, number> = { 1: 0xCD7F32, 2: 0xC0C0C0, 3: 0xFFD700 }

async function activatePendingGifts(userId: string) {
  const pendingKey = `pending-gifts:${userId}`
  const raw = await kvGet(pendingKey)
  if (!raw) return

  const gifts: { tier: number; buyerId: string; buyerName: string; count?: number; createdAt: string }[] = JSON.parse(raw)
  if (gifts.length === 0) return

  for (const gift of gifts) {
    const giftCount = gift.count ?? 1
    const totalDays = giftCount * 30
    const roleId = TIER_ROLES[gift.tier] ?? process.env.DISCORD_VIP_ROLE_ID!

    // Adiciona cargo VIP
    await fetch(
      `https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/members/${userId}/roles/${roleId}`,
      { method: 'PUT', headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' } },
    )

    // Salva expiração com stacking — soma a partir do vencimento atual se ainda ativo
    const existingVipRaw = await kvGet(`vip:${userId}`)
    const existingVip = existingVipRaw ? JSON.parse(existingVipRaw) : {}
    const now = new Date()
    const currentExpiry = existingVip.expiresAt ? new Date(existingVip.expiresAt) : now
    const baseDate = currentExpiry > now ? currentExpiry : now
    baseDate.setDate(baseDate.getDate() + totalDays)
    const expiresStr = baseDate.toISOString().split('T')[0]

    await kvSet(`vip:${userId}`, JSON.stringify({ ...existingVip, expiresAt: expiresStr, roleId, tier: gift.tier, optOut: false, ultimoAviso: undefined }))

    // Contabiliza meses de VIP
    const monthsKey = `vip-months:${userId}`
    const monthsRaw = await kvGet(monthsKey)
    const monthsData = monthsRaw ? JSON.parse(monthsRaw) : { totalMonths: 0, firstPaymentAt: new Date().toISOString() }
    monthsData.totalMonths += giftCount
    await kvSet(monthsKey, JSON.stringify(monthsData))

    const tierName = TIER_NAMES[gift.tier] ?? 'VIP'
    const daysLabel = giftCount > 1 ? `${totalDays} dias (${giftCount}x 30 dias)` : '30 dias'
    await sendDiscordDMEmbed(userId, {
      title: '🎁 Presente ativado!',
      description: `Você verificou sua conta e seu **${tierName}** (presente de **${gift.buyerName}**) foi ativado!\n\nVálido por **${daysLabel}**.`,
      color: TIER_COLORS[gift.tier] ?? 0xFFD700,
    })

    console.log(`[verify] Presente pendente ativado: ${userId} tier ${gift.tier} x${giftCount} (de ${gift.buyerId})`)
  }

  // Remove presentes pendentes
  await kvDel(pendingKey)
}

/* ── Ativar presentes pendentes por nome VRChat (de grupos verificados) ── */

async function activatePendingVrcGifts(userId: string, vrchatDisplayName: string) {
  const pendingKey = `pending-vrc-gift:${vrchatDisplayName.toLowerCase()}`
  const raw = await kvGet(pendingKey)
  if (!raw) return

  const gifts: { tier: number; grupoSlug: string; grupoNome: string; createdAt: string }[] = JSON.parse(raw)
  if (gifts.length === 0) return

  for (const gift of gifts) {
    const roleId = TIER_ROLES[gift.tier] ?? process.env.DISCORD_VIP_ROLE_ID!

    // Adiciona cargo VIP
    await fetch(
      `https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/members/${userId}/roles/${roleId}`,
      { method: 'PUT', headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' } },
    )

    // Salva expiração
    const existingVipRaw = await kvGet(`vip:${userId}`)
    const existingVip = existingVipRaw ? JSON.parse(existingVipRaw) : {}
    const now = new Date()
    const currentExpiry = existingVip.expiresAt ? new Date(existingVip.expiresAt) : now
    const baseDate = currentExpiry > now ? currentExpiry : now
    baseDate.setDate(baseDate.getDate() + 30)
    const expiresStr = baseDate.toISOString().split('T')[0]

    await kvSet(`vip:${userId}`, JSON.stringify({ ...existingVip, expiresAt: expiresStr, roleId, tier: gift.tier, optOut: false, ultimoAviso: undefined }))

    // Contabiliza meses
    const monthsKey = `vip-months:${userId}`
    const monthsRaw = await kvGet(monthsKey)
    const monthsData = monthsRaw ? JSON.parse(monthsRaw) : { totalMonths: 0, firstPaymentAt: new Date().toISOString() }
    monthsData.totalMonths += 1
    await kvSet(monthsKey, JSON.stringify(monthsData))

    const tierName = TIER_NAMES[gift.tier] ?? 'VIP'
    await sendDiscordDMEmbed(userId, {
      title: '🎁 Presente ativado!',
      description: `Você verificou sua conta e seu **${tierName}** (presente do grupo **${gift.grupoNome}**) foi ativado!\n\nVálido por **30 dias**.`,
      color: TIER_COLORS[gift.tier] ?? 0xFFD700,
    })

    console.log(`[verify] Presente VRC pendente ativado: ${userId} tier ${gift.tier} (grupo ${gift.grupoSlug})`)
  }

  await kvDel(pendingKey)
}
