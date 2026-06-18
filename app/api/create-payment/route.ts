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
  const { amount, description } = TIER_CONFIG[tier]

  const idempotencyKey = `brb-${discordUser.id}-t${tier}-${Date.now()}`

  const host = req.headers.get('host') ?? 'brasil-role-br.com'
  const baseUrl = `https://${host}`

  const res = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      transaction_amount: amount,
      description,
      payment_method_id: 'pix',
      payer: { email: 'pagamento@brasil-role-br.com' },
      external_reference: `discord-${discordUser.id}-t${tier}`,
      notification_url: `${baseUrl}/api/webhook`,
    }),
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json()

  if (!data.id) {
    return NextResponse.json({ error: 'Erro ao criar pagamento' }, { status: 500 })
  }

  const qrCode = data.point_of_interaction?.transaction_data?.qr_code

  if (!qrCode) {
    return NextResponse.json({ error: 'QR code não gerado pelo Mercado Pago' }, { status: 500 })
  }

  return NextResponse.json({ paymentId: data.id, qrCode })
}
