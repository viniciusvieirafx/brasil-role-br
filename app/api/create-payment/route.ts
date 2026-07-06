import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { isUserVerified } from '@/lib/discord'

const TIER_CONFIG: Record<number, { amount: number; description: string }> = {
  1: { amount: 5.0,  description: 'VIP Bronze Brasil Role BR - 30 dias' },
  2: { amount: 15.0, description: 'VIP Prata Brasil Role BR - 30 dias'  },
  3: { amount: 25.0, description: 'VIP Ouro Brasil Role BR - 30 dias'   },
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const discordUserCookie = cookieStore.get('discord_user')

  if (!discordUserCookie) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const discordUser = JSON.parse(discordUserCookie.value)

  if (!(await isUserVerified(discordUser.id))) {
    return NextResponse.json(
      { error: 'Verifique sua conta VRChat antes de comprar VIP', code: 'NOT_VERIFIED' },
      { status: 403 }
    )
  }

  const body = await req.json().catch(() => ({}))
  const tier: number = [1, 2, 3].includes(body.tier) ? body.tier : 1
  const giftToId: string | undefined = body.giftToId?.trim()
  const { amount, description } = TIER_CONFIG[tier]

  // Se for presente, valida que o destinatário existe no servidor
  if (giftToId) {
    const memberRes = await fetch(
      `https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/members/${giftToId}`,
      { headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` } },
    )
    if (!memberRes.ok) {
      return NextResponse.json(
        { error: 'Usuário destinatário não encontrado no servidor Discord' },
        { status: 400 },
      )
    }
  }

  // external_reference:
  // Normal: discord-{userId}-t{tier}
  // Gift:   discord-{recipientId}-t{tier}-gf{buyerId}
  const targetId = giftToId ?? discordUser.id
  const externalRef = giftToId
    ? `discord-${targetId}-t${tier}-gf${discordUser.id}`
    : `discord-${targetId}-t${tier}`

  const idempotencyKey = `brb-${targetId}-t${tier}-${Date.now()}`

  const host = req.headers.get('host') ?? 'brasil-role-br.com'
  const baseUrl = `https://${host}`

  const giftLabel = giftToId ? ' (Presente)' : ''

  const res = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      transaction_amount: amount,
      description: description + giftLabel,
      payment_method_id: 'pix',
      payer: { email: 'pagamento@brasil-role-br.com' },
      external_reference: externalRef,
      notification_url: `${baseUrl}/api/webhook`,
    }),
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json()

  if (!data.id) {
    console.error('[create-payment] Erro:', JSON.stringify(data))
    return NextResponse.json({ error: 'Erro ao criar pagamento. Tente novamente.' }, { status: 500 })
  }

  const qrCode = data.point_of_interaction?.transaction_data?.qr_code

  if (!qrCode) {
    return NextResponse.json({ error: 'QR code não gerado pelo Mercado Pago. Tente novamente.' }, { status: 500 })
  }

  return NextResponse.json({ paymentId: data.id, qrCode })
}
