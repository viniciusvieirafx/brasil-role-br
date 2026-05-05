import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(_req: NextRequest) {
  const cookieStore = await cookies()
  const discordUserCookie = cookieStore.get('discord_user')

  if (!discordUserCookie) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const discordUser = JSON.parse(discordUserCookie.value)
  const idempotencyKey = `brb-${discordUser.id}-${Date.now()}`

  const res = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      transaction_amount: 5.0,
      description: 'VIP Brasil Role BR - 30 dias',
      payment_method_id: 'pix',
      payer: { email: 'cliente@brasirole.br' },
      external_reference: `discord-${discordUser.id}`,
      notification_url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhook`,
    }),
  })

  const data = await res.json()

  if (!data.id) {
    return NextResponse.json({ error: 'Erro ao criar pagamento' }, { status: 500 })
  }

  return NextResponse.json({
    paymentId: data.id,
    qrCode: data.point_of_interaction?.transaction_data?.qr_code,
  })
}
