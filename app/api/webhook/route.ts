import { NextRequest, NextResponse } from 'next/server'
import { kvGet, kvSet } from '@/lib/kv'

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

async function notifyVipPurchase(
  discordUserId: string,
  tier: number,
  amount: number,
  paymentMethod: string,
  expiresAt: string,
) {
  const memberRes = await fetch(
    `https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/members/${discordUserId}`,
    { headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` } },
  )
  const member = memberRes.ok ? await memberRes.json() : null
  const displayName = member?.nick ?? member?.user?.global_name ?? member?.user?.username ?? discordUserId

  const methodLabel: Record<string, string> = {
    pix: 'PIX',
    credit_card: 'Cartão de crédito',
    debit_card: 'Cartão de débito',
    bank_transfer: 'Transferência',
  }
  const method = methodLabel[paymentMethod] ?? paymentMethod
  const tierName = TIER_NAMES[tier] ?? `VIP Tier ${tier}`

  await fetch(`https://discord.com/api/v10/channels/${NOTIFY_CHANNEL}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      embeds: [{
        title: `💎 Novo ${tierName} Ativado`,
        color: TIER_COLORS[tier] ?? 0xFFD700,
        fields: [
          { name: '👤 Usuário',   value: `${displayName} (<@${discordUserId}>)`, inline: true },
          { name: '🏅 Plano',     value: tierName,                               inline: true },
          { name: '💰 Valor',     value: `R$ ${amount.toFixed(2)}`,              inline: true },
          { name: '💳 Pagamento', value: method,                                 inline: true },
          { name: '📅 Vence em',  value: expiresAt,                              inline: true },
        ],
        footer: { text: 'Brasil Role BR · VIP' },
        timestamp: new Date().toISOString(),
      }],
    }),
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  // MercadoPago envia o ID do pagamento
  const paymentId = body?.data?.id
  if (!paymentId || body?.type !== 'payment') {
    return NextResponse.json({ ok: true })
  }

  // Busca detalhes do pagamento
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
  })
  const payment = await res.json()

  if (payment.status !== 'approved') {
    return NextResponse.json({ ok: true })
  }

  // external_reference = "discord-{userId}"
  const ref: string = payment.external_reference ?? ''
  const match = ref.match(/^discord-(\d+)$/)
  if (!match) {
    return NextResponse.json({ ok: true })
  }

  const discordUserId = match[1]

  // Detecta tier pelo external_reference (novo: discord-{id}-t{tier}, legado: discord-{id})
  const tierMatch = ref.match(/-t(\d+)$/)
  const tier = tierMatch ? parseInt(tierMatch[1]) : 1

  const roleByTier: Record<number, string | undefined> = {
    1: process.env.DISCORD_VIP_ROLE_ID,
    2: process.env.DISCORD_VIP2_ROLE_ID,
    3: process.env.DISCORD_VIP3_ROLE_ID,
  }
  const roleId = roleByTier[tier] ?? process.env.DISCORD_VIP_ROLE_ID!

  // Remove cargos de tiers inferiores (se estiver fazendo upgrade)
  const lowerRoles = [
    tier > 1 ? process.env.DISCORD_VIP_ROLE_ID  : undefined,
    tier > 2 ? process.env.DISCORD_VIP2_ROLE_ID : undefined,
  ].filter(Boolean) as string[]

  for (const lowerRoleId of lowerRoles) {
    await fetch(
      `https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/members/${discordUserId}/roles/${lowerRoleId}`,
      { method: 'DELETE', headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` } }
    ).catch(() => {})
  }

  // Adiciona cargo VIP do tier correto
  const roleRes = await fetch(
    `https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/members/${discordUserId}/roles/${roleId}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }
  )
  if (!roleRes.ok) {
    const errBody = await roleRes.text().catch(() => '')
    console.error(`[webhook] FALHA ao adicionar cargo VIP tier ${tier} para ${discordUserId}: HTTP ${roleRes.status} ${errBody}`)
  }

  // Salva vencimento (30 dias) no Redis — limpa optOut para reativar lembretes
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 30)
  const expiresStr = expiresAt.toISOString().split('T')[0]
  const existingRaw = await kvGet(`vip:${discordUserId}`)
  const existing    = existingRaw ? JSON.parse(existingRaw) : {}
  await kvSet(`vip:${discordUserId}`, JSON.stringify({
    ...existing,
    expiresAt:   expiresStr,
    roleId,
    tier,
    optOut:      false,
    ultimoAviso: undefined,
  }))

  await notifyVipPurchase(
    discordUserId,
    tier,
    payment.transaction_amount,
    payment.payment_method_id,
    expiresStr,
  )

  console.log(`[webhook] VIP ativado: ${discordUserId} até ${expiresStr}`)
  return NextResponse.json({ ok: true })
}
