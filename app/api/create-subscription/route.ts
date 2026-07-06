import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { isUserVerified } from '@/lib/discord'
import { kvSet } from '@/lib/kv'

const TIER_CONFIG: Record<number, { amount: number; reason: string }> = {
  1: { amount: 5.0,  reason: 'VIP Bronze Brasil Role BR - Assinatura Mensal' },
  2: { amount: 15.0, reason: 'VIP Prata Brasil Role BR - Assinatura Mensal'  },
  3: { amount: 25.0, reason: 'VIP Ouro Brasil Role BR - Assinatura Mensal'   },
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
      { error: 'Verifique sua conta VRChat antes de assinar VIP', code: 'NOT_VERIFIED' },
      { status: 403 },
    )
  }

  const body = await req.json().catch(() => ({}))
  const tier: number = [1, 2, 3].includes(body.tier) ? body.tier : 1
  const email: string = body.email?.trim()

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Email válido é obrigatório para assinatura' }, { status: 400 })
  }

  const { amount, reason } = TIER_CONFIG[tier]

  const host = req.headers.get('host') ?? 'brasil-role-br.com'
  const baseUrl = `https://${host}`

  const externalRef = `discord-${discordUser.id}-t${tier}-sub`

  const res = await fetch('https://api.mercadopago.com/preapproval', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      reason,
      external_reference: externalRef,
      payer_email: email,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: amount,
        currency_id: 'BRL',
      },
      back_url: `${baseUrl}/api/subscription/callback`,
      notification_url: `${baseUrl}/api/webhook`,
    }),
  })

  const data = await res.json()

  if (!data.id || !data.init_point) {
    console.error('[subscription] Erro ao criar assinatura:', JSON.stringify(data))
    return NextResponse.json(
      { error: 'Erro ao criar assinatura no Mercado Pago. Tente novamente.' },
      { status: 500 },
    )
  }

  // Salva dados da assinatura pendente no KV
  await kvSet(
    `sub:${discordUser.id}`,
    JSON.stringify({
      preapprovalId: data.id,
      tier,
      status: 'pending',
      createdAt: new Date().toISOString(),
    }),
  )

  return NextResponse.json({ initPoint: data.init_point, preapprovalId: data.id })
}
