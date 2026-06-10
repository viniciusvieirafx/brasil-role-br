import { NextRequest, NextResponse } from 'next/server'
import { kvGet, kvSet } from '@/lib/kv'

const NOTIFY_CHANNEL = '1480918950404423835'

async function notifyVipPurchase(
  discordUserId: string,
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

  await fetch(`https://discord.com/api/v10/channels/${NOTIFY_CHANNEL}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      embeds: [{
        title: '💎 Novo VIP Ativado',
        color: 0xFFD700,
        fields: [
          { name: '👤 Usuário', value: `${displayName} (<@${discordUserId}>)`, inline: true },
          { name: '💰 Valor', value: `R$ ${amount.toFixed(2)}`, inline: true },
          { name: '💳 Pagamento', value: method, inline: true },
          { name: '📅 Vence em', value: expiresAt, inline: true },
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
  const roleId = process.env.DISCORD_VIP_ROLE_ID!

  // Adiciona cargo VIP no Discord
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
    console.error(`[webhook] FALHA ao adicionar cargo VIP para ${discordUserId}: HTTP ${roleRes.status} ${errBody}`)
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
    optOut:      false,
    ultimoAviso: undefined,
  }))

  await notifyVipPurchase(
    discordUserId,
    payment.transaction_amount,
    payment.payment_method_id,
    expiresStr,
  )

  console.log(`[webhook] VIP ativado: ${discordUserId} até ${expiresStr}`)
  return NextResponse.json({ ok: true })
}
