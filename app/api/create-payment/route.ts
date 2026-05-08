import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(_req: NextRequest) {
  console.log('[create-payment] função chamada')
  const cookieStore = await cookies()
  const discordUserCookie = cookieStore.get('discord_user')

  if (!discordUserCookie) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const discordUser = JSON.parse(discordUserCookie.value)
  const idempotencyKey = `brb-${discordUser.id}-${Date.now()}`

  const host = _req.headers.get('host') ?? 'brasil-role-br.com'
  const baseUrl = `https://${host}`

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
      payer: { email: 'pagamento@brasil-role-br.com' },
      external_reference: `discord-${discordUser.id}`,
      notification_url: `${baseUrl}/api/webhook`,
    }),
  })

  const raw = await res.text()
  console.log('[create-payment] MP status:', res.status, 'body:', raw)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any
  try { data = JSON.parse(raw) } catch { data = {} }

  if (!data.id) {
    return NextResponse.json({ error: 'Erro ao criar pagamento', mpStatus: res.status, mpBody: raw }, { status: 500 })
  }

  const qrCode = data.point_of_interaction?.transaction_data?.qr_code

  if (!qrCode) {
    console.error('[create-payment] qr_code ausente na resposta do MP:', data.point_of_interaction)
    return NextResponse.json({ error: 'QR code não gerado pelo Mercado Pago' }, { status: 500 })
  }

  return NextResponse.json({
    paymentId: data.id,
    qrCode,
  })
}
