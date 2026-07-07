import { NextRequest, NextResponse } from 'next/server'
import { kvGet, kvSet } from '@/lib/kv'
import { sendDiscordDMEmbed } from '@/lib/discord-dm'

const NOTIFY_CHANNEL = '1480918950404423835'

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

/* ── Helpers ─────────────────────────────────────────── */

async function addVipRole(discordUserId: string, tier: number) {
  const roleByTier: Record<number, string | undefined> = {
    1: process.env.DISCORD_VIP_ROLE_ID,
    2: process.env.DISCORD_VIP2_ROLE_ID,
    3: process.env.DISCORD_VIP3_ROLE_ID,
  }
  const roleId = roleByTier[tier] ?? process.env.DISCORD_VIP_ROLE_ID!

  // Remove cargos de tiers inferiores (upgrade)
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

  // Adiciona cargo VIP
  const roleRes = await fetch(
    `https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/members/${discordUserId}/roles/${roleId}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
    },
  )
  if (!roleRes.ok) {
    const errBody = await roleRes.text().catch(() => '')
    console.error(`[webhook] FALHA ao adicionar cargo VIP tier ${tier} para ${discordUserId}: HTTP ${roleRes.status} ${errBody}`)
  }

  return roleId
}

async function saveVipExpiry(discordUserId: string, tier: number, roleId: string) {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 30)
  const expiresStr = expiresAt.toISOString().split('T')[0]
  const existingRaw = await kvGet(`vip:${discordUserId}`)
  const existing = existingRaw ? JSON.parse(existingRaw) : {}
  await kvSet(
    `vip:${discordUserId}`,
    JSON.stringify({
      ...existing,
      expiresAt: expiresStr,
      roleId,
      tier,
      optOut: false,
      ultimoAviso: undefined,
    }),
  )
  return expiresStr
}

async function getDisplayName(discordUserId: string): Promise<string> {
  const memberRes = await fetch(
    `https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/members/${discordUserId}`,
    { headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` } },
  )
  const member = memberRes.ok ? await memberRes.json() : null
  return member?.nick ?? member?.user?.global_name ?? member?.user?.username ?? discordUserId
}

async function notifyChannel(
  discordUserId: string,
  tier: number,
  amount: number,
  paymentMethod: string,
  expiresStr: string,
  giftBuyerId?: string,
) {
  const displayName = await getDisplayName(discordUserId)
  const tierName = TIER_NAMES[tier] ?? `VIP Tier ${tier}`
  const methodLabel: Record<string, string> = {
    pix: 'PIX',
    credit_card: 'Cartão de crédito',
    debit_card: 'Cartão de débito',
    bank_transfer: 'Transferência',
    account_money: 'Saldo MP',
  }
  const method = methodLabel[paymentMethod] ?? paymentMethod

  const fields = [
    { name: '👤 Usuário', value: `${displayName} (<@${discordUserId}>)`, inline: true },
    { name: '🏅 Plano', value: tierName, inline: true },
    { name: '💰 Valor', value: `R$ ${amount.toFixed(2)}`, inline: true },
    { name: '💳 Pagamento', value: method, inline: true },
    { name: '📅 Vence em', value: expiresStr, inline: true },
  ]

  if (giftBuyerId) {
    const buyerName = await getDisplayName(giftBuyerId)
    fields.push({ name: '🎁 Presenteado por', value: `${buyerName} (<@${giftBuyerId}>)`, inline: true })
  }

  await fetch(`https://discord.com/api/v10/channels/${NOTIFY_CHANNEL}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      embeds: [{
        title: giftBuyerId ? `🎁 VIP Presente — ${tierName}` : `💎 Novo ${tierName} Ativado`,
        color: TIER_COLORS[tier] ?? 0xFFD700,
        fields,
        footer: { text: 'Brasil Role BR · VIP' },
        timestamp: new Date().toISOString(),
      }],
    }),
  })
}

async function incrementVipMonths(discordUserId: string, months: number = 1) {
  const key = `vip-months:${discordUserId}`
  const raw = await kvGet(key)
  const data = raw ? JSON.parse(raw) : { totalMonths: 0, firstPaymentAt: new Date().toISOString() }
  data.totalMonths += months
  await kvSet(key, JSON.stringify(data))
}

/* ── Parsers de external_reference ─────────────────── */

// Normal:       discord-{userId}-t{tier}
// Gift:         discord-{recipientId}-t{tier}-gf{buyerId}
// Bulk random:  discord-BULK-t{tier}-q{quantity}-gf{buyerId}
// Subscription: discord-{userId}-t{tier}-sub
// Legacy:       discord-{userId}
function parseRef(ref: string) {
  // Bulk random gift
  const bulkMatch = ref.match(/^discord-BULK-t(\d+)-q(\d+)-gf(\d+)$/)
  if (bulkMatch) {
    return { recipientId: undefined, tier: parseInt(bulkMatch[1]), quantity: parseInt(bulkMatch[2]), buyerId: bulkMatch[3], type: 'bulk' as const }
  }

  // Gift
  const giftMatch = ref.match(/^discord-(\d+)-t(\d+)-gf(\d+)$/)
  if (giftMatch) {
    return { recipientId: giftMatch[1], tier: parseInt(giftMatch[2]), buyerId: giftMatch[3], type: 'gift' as const }
  }

  // Subscription
  const subMatch = ref.match(/^discord-(\d+)-t(\d+)-sub$/)
  if (subMatch) {
    return { recipientId: subMatch[1], tier: parseInt(subMatch[2]), buyerId: undefined, type: 'subscription' as const }
  }

  // Normal (com tier)
  const normalMatch = ref.match(/^discord-(\d+)-t(\d+)$/)
  if (normalMatch) {
    return { recipientId: normalMatch[1], tier: parseInt(normalMatch[2]), buyerId: undefined, type: 'normal' as const }
  }

  // Legacy (sem tier)
  const legacyMatch = ref.match(/^discord-(\d+)$/)
  if (legacyMatch) {
    return { recipientId: legacyMatch[1], tier: 1, buyerId: undefined, type: 'normal' as const }
  }

  return null
}

/* ── Handler principal ─────────────────────────────── */

export async function POST(req: NextRequest) {
  const body = await req.json()

  // ── Webhook de pagamento (PIX / compra única / gift / assinatura recorrente)
  if (body?.type === 'payment') {
    return handlePayment(body.data?.id)
  }

  // ── Webhook de assinatura (status change)
  if (body?.type === 'subscription_preapproval') {
    return handleSubscriptionStatus(body.data?.id)
  }

  // ── Webhook de pagamento de assinatura
  if (body?.type === 'subscription_authorized_payment') {
    return handleSubscriptionPayment(body.data?.id)
  }

  return NextResponse.json({ ok: true })
}

/* ── Pagamento único (PIX) ─────────────────────────── */

async function handlePayment(paymentId: string | undefined) {
  if (!paymentId) return NextResponse.json({ ok: true })

  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
  })
  const payment = await res.json()

  if (payment.status !== 'approved') {
    return NextResponse.json({ ok: true })
  }

  const ref = payment.external_reference ?? ''
  const parsed = parseRef(ref)
  if (!parsed) return NextResponse.json({ ok: true })

  // Bulk random gift — distribui VIPs para membros aleatórios
  if (parsed.type === 'bulk') {
    return handleBulkRandomGift(parsed.tier, parsed.quantity!, parsed.buyerId!, payment.transaction_amount)
  }

  const { tier, buyerId } = parsed
  const recipientId = parsed.recipientId!
  const roleId = await addVipRole(recipientId, tier)
  const expiresStr = await saveVipExpiry(recipientId, tier, roleId)

  // Contabiliza +1 mês de VIP pro destinatário
  await incrementVipMonths(recipientId)

  // Notificação no canal
  await notifyChannel(recipientId, tier, payment.transaction_amount, payment.payment_method_id, expiresStr, buyerId)

  // Se for presente, DM pro destinatário + salvar pontos do presenteador
  if (buyerId) {
    const buyerName = await getDisplayName(buyerId)
    const tierName = TIER_NAMES[tier] ?? 'VIP'
    await sendDiscordDMEmbed(recipientId, {
      title: '🎁 Você recebeu um presente!',
      description: `**${buyerName}** te presenteou com **${tierName}** no Brasil Role BR!\n\nSeu cargo VIP já está ativo no Discord e vale por 30 dias.`,
      color: TIER_COLORS[tier] ?? 0xFFD700,
    })

    // Acumula pontos do presenteador para ranking
    const points = tier // Tier 1 = 1pt, Tier 2 = 2pt, Tier 3 = 3pt
    const gifterKey = `gifter-points:${buyerId}`
    const existingGifter = await kvGet(gifterKey)
    const gifterData = existingGifter ? JSON.parse(existingGifter) : { displayName: buyerName, points: 0, firstGiftAt: new Date().toISOString() }
    gifterData.displayName = buyerName // Atualiza nome caso tenha mudado
    gifterData.points += points
    await kvSet(gifterKey, JSON.stringify(gifterData))
    console.log(`[webhook] Gifter ${buyerName} (${buyerId}) +${points}pts = ${gifterData.points}pts total`)
  }

  console.log(`[webhook] VIP ativado: ${recipientId} tier ${tier} até ${expiresStr}${buyerId ? ` (presente de ${buyerId})` : ''}`)
  return NextResponse.json({ ok: true })
}

/* ── Presente aleatório em massa ──────────────────────── */

async function getAllGuildMembers(): Promise<any[]> {
  const guildId = process.env.DISCORD_GUILD_ID!
  const botToken = process.env.DISCORD_BOT_TOKEN!
  const allMembers: any[] = []
  let after = '0'

  while (true) {
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members?limit=1000&after=${after}`,
      { headers: { Authorization: `Bot ${botToken}` } },
    )
    if (!res.ok) break
    const members: any[] = await res.json()
    if (!Array.isArray(members) || members.length === 0) break
    allMembers.push(...members)
    if (members.length < 1000) break
    after = members[members.length - 1].user.id
  }

  return allMembers
}

async function handleBulkRandomGift(tier: number, quantity: number, buyerId: string, amount: number) {
  const vipRoleIds = [
    process.env.DISCORD_VIP_ROLE_ID,
    process.env.DISCORD_VIP2_ROLE_ID,
    process.env.DISCORD_VIP3_ROLE_ID,
  ].filter(Boolean) as string[]

  const verifiedRoleId = process.env.DISCORD_VERIFIED_ROLE_ID!
  const buyerName = await getDisplayName(buyerId)

  // Busca todos os membros do servidor
  const allMembers = await getAllGuildMembers()

  // Filtra: não-bot, sem VIP, não é o comprador
  const eligible = allMembers.filter((m) => {
    if (m.user?.bot) return false
    if (m.user?.id === buyerId) return false
    if (!Array.isArray(m.roles)) return false
    return !m.roles.some((r: string) => vipRoleIds.includes(r))
  })

  if (eligible.length === 0) {
    console.log(`[webhook] Bulk gift: nenhum membro elegível encontrado`)
    return NextResponse.json({ ok: true })
  }

  // Shuffle Fisher-Yates
  for (let i = eligible.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[eligible[i], eligible[j]] = [eligible[j], eligible[i]]
  }

  // Distribui presentes round-robin — se quantity > eligible, membros ganham múltiplos (stacking)
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
      // Ativa VIP com dias acumulados
      const roleId = await addVipRole(memberId, tier)

      // Calcula expiração: se já tem VIP ativo, soma a partir do vencimento atual
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
        title: '🎁 Você ganhou VIP!',
        description: `**${buyerName}** fez um presente em massa e você foi um dos contemplados!\n\nSeu **${tierName}** já está ativo e vale por **${daysLabel}**.`,
        color: TIER_COLORS[tier] ?? 0xFFD700,
      })
    } else {
      // Salva presente pendente com a quantidade de meses (será contabilizado ao verificar)
      const pendingKey = `pending-gifts:${memberId}`
      const existingRaw = await kvGet(pendingKey)
      const existingGifts = existingRaw ? JSON.parse(existingRaw) : []
      existingGifts.push({ tier, buyerId, buyerName, count, createdAt: new Date().toISOString() })
      await kvSet(pendingKey, JSON.stringify(existingGifts))
      pendingCount++

      await sendDiscordDMEmbed(memberId, {
        title: '🎁 Você ganhou VIP!',
        description: `**${buyerName}** fez um presente em massa e você foi um dos contemplados!\n\nPara receber seu **${tierName}** (**${daysLabel}**), você precisa verificar sua conta VRChat em **brasil-role-br.com**.\n\nApós verificar, seu VIP será ativado automaticamente!`,
        color: TIER_COLORS[tier] ?? 0xFFD700,
      })
    }
  }

  // Acumula pontos do presenteador (sempre quantity total, pois pagou por todos)
  const totalPoints = tier * quantity
  const gifterKey = `gifter-points:${buyerId}`
  const existingGifter = await kvGet(gifterKey)
  const gifterData = existingGifter ? JSON.parse(existingGifter) : { displayName: buyerName, points: 0, firstGiftAt: new Date().toISOString() }
  gifterData.displayName = buyerName
  gifterData.points += totalPoints
  await kvSet(gifterKey, JSON.stringify(gifterData))

  // Notificação no canal
  const tierColor = TIER_COLORS[tier] ?? 0xFFD700
  const fields = [
    { name: '🎁 Presenteador', value: `${buyerName} (<@${buyerId}>)`, inline: true },
    { name: '🏅 Plano', value: tierName, inline: true },
    { name: '📦 Presentes', value: `${quantity}`, inline: true },
    { name: '👥 Membros contemplados', value: `${membersGifted}`, inline: true },
    { name: '💰 Valor total', value: `R$ ${amount.toFixed(2)}`, inline: true },
    { name: '✅ Ativados', value: `${activatedCount}`, inline: true },
    { name: '⏳ Pendentes (não verificados)', value: `${pendingCount}`, inline: true },
  ]

  if (quantity > membersGifted) {
    fields.push({ name: '🔄 Presentes acumulados', value: `${quantity - membersGifted} extras distribuídos entre os ${membersGifted} membros`, inline: false })
  }

  await fetch(`https://discord.com/api/v10/channels/${NOTIFY_CHANNEL}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      embeds: [{
        title: `🎁 Presente em Massa — ${quantity}x ${tierName}`,
        color: tierColor,
        fields,
        footer: { text: 'Brasil Role BR · VIP' },
        timestamp: new Date().toISOString(),
      }],
    }),
  })

  console.log(`[webhook] Bulk gift: ${buyerName} (${buyerId}) presenteou ${quantity}x tier ${tier} para ${membersGifted} membros (${activatedCount} ativados, ${pendingCount} pendentes)`)
  return NextResponse.json({ ok: true })
}

/* ── Status de assinatura (preapproval) ──────────────── */

async function handleSubscriptionStatus(preapprovalId: string | undefined) {
  if (!preapprovalId) return NextResponse.json({ ok: true })

  const res = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
    headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
  })
  const sub = await res.json()

  const parsed = parseRef(sub.external_reference ?? '')
  if (!parsed) return NextResponse.json({ ok: true })

  const recipientId = parsed.recipientId!
  const { tier } = parsed

  // Atualiza status no KV
  const existingRaw = await kvGet(`sub:${recipientId}`)
  const existing = existingRaw ? JSON.parse(existingRaw) : {}
  await kvSet(
    `sub:${recipientId}`,
    JSON.stringify({
      ...existing,
      preapprovalId,
      tier,
      status: sub.status,
      updatedAt: new Date().toISOString(),
    }),
  )

  // Se assinatura foi autorizada, ativa VIP
  if (sub.status === 'authorized') {
    const roleId = await addVipRole(recipientId, tier)
    await saveVipExpiry(recipientId, tier, roleId)

    const tierName = TIER_NAMES[tier] ?? 'VIP'
    await sendDiscordDMEmbed(recipientId, {
      title: '✅ Assinatura ativada!',
      description: `Sua assinatura **${tierName}** foi ativada com sucesso!\n\nA cobrança será feita automaticamente todo mês no seu cartão.`,
      color: 0x009B3A,
    })

    console.log(`[webhook] Assinatura ativada: ${recipientId} tier ${tier}`)
  }

  // Se assinatura foi cancelada/pausada
  if (sub.status === 'cancelled' || sub.status === 'paused') {
    const tierName = TIER_NAMES[tier] ?? 'VIP'
    await sendDiscordDMEmbed(recipientId, {
      title: '⚠️ Assinatura cancelada',
      description: `Sua assinatura **${tierName}** foi cancelada.\n\nSeu VIP continuará ativo até a data de vencimento atual. Após isso, os benefícios serão removidos.\n\nVocê pode assinar novamente a qualquer momento em brasil-role-br.com`,
      color: 0xFF6B6B,
    })

    console.log(`[webhook] Assinatura ${sub.status}: ${recipientId}`)
  }

  return NextResponse.json({ ok: true })
}

/* ── Pagamento recorrente de assinatura ──────────────── */

async function handleSubscriptionPayment(authorizedPaymentId: string | undefined) {
  if (!authorizedPaymentId) return NextResponse.json({ ok: true })

  const res = await fetch(`https://api.mercadopago.com/authorized_payments/${authorizedPaymentId}`, {
    headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
  })
  const authPayment = await res.json()

  // Busca dados da assinatura para pegar o external_reference
  const subRes = await fetch(`https://api.mercadopago.com/preapproval/${authPayment.preapproval_id}`, {
    headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
  })
  const sub = await subRes.json()

  const parsed = parseRef(sub.external_reference ?? '')
  if (!parsed) return NextResponse.json({ ok: true })

  const recipientId = parsed.recipientId!
  const { tier } = parsed
  const tierName = TIER_NAMES[tier] ?? 'VIP'

  // Pagamento aprovado — renova VIP
  if (authPayment.status === 'approved') {
    const roleId = await addVipRole(recipientId, tier)
    const expiresStr = await saveVipExpiry(recipientId, tier, roleId)
    await incrementVipMonths(recipientId)

    await sendDiscordDMEmbed(recipientId, {
      title: '💳 Assinatura renovada!',
      description: `Sua assinatura **${tierName}** foi renovada com sucesso!\n\nPróximo vencimento: **${expiresStr}**`,
      color: 0x009B3A,
    })

    console.log(`[webhook] Assinatura renovada: ${recipientId} tier ${tier} até ${expiresStr}`)
    return NextResponse.json({ ok: true })
  }

  // Pagamento falhou — DM de erro
  if (authPayment.status === 'rejected' || authPayment.status === 'cancelled') {
    const statusDetail = authPayment.status_detail ?? 'unknown'
    const errorMessages: Record<string, string> = {
      cc_rejected_insufficient_amount: 'Saldo insuficiente no cartão.',
      cc_rejected_bad_filled_card_number: 'Número do cartão incorreto.',
      cc_rejected_bad_filled_date: 'Data de validade do cartão incorreta.',
      cc_rejected_bad_filled_security_code: 'Código de segurança incorreto.',
      cc_rejected_card_disabled: 'Cartão desativado. Contate seu banco.',
      cc_rejected_max_attempts: 'Limite de tentativas excedido. Tente outro cartão.',
      cc_rejected_high_risk: 'Pagamento recusado por risco. Tente outro cartão.',
      cc_rejected_call_for_authorize: 'Pagamento precisa de autorização. Contate seu banco.',
    }
    const errorMsg = errorMessages[statusDetail] ?? 'Erro no processamento do pagamento.'

    await sendDiscordDMEmbed(recipientId, {
      title: '❌ Erro na cobrança da assinatura',
      description: `Houve um problema ao cobrar sua assinatura **${tierName}**.\n\n**Motivo:** ${errorMsg}\n\nSeu VIP pode ser desativado se o pagamento não for regularizado. Acesse brasil-role-br.com para atualizar seus dados de pagamento ou assinar novamente.`,
      color: 0xFF0000,
      fields: [
        { name: 'Valor', value: `R$ ${authPayment.transaction_amount?.toFixed(2) ?? '?'}`, inline: true },
        { name: 'Status', value: statusDetail, inline: true },
      ],
    })

    console.error(`[webhook] Cobrança falhou: ${recipientId} tier ${tier} - ${statusDetail}`)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: true })
}
