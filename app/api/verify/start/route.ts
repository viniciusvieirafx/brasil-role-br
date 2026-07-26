import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { kvGet, kvSet } from '@/lib/kv'

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'BRB-'
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const discordUserCookie = cookieStore.get('discord_user')

  if (!discordUserCookie) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const discordUser = JSON.parse(discordUserCookie.value)
  const { vrchatUsername } = await req.json()
  if (!vrchatUsername?.trim()) {
    return NextResponse.json({ error: 'Username obrigatório' }, { status: 400 })
  }

  const trimmed = vrchatUsername.trim()
  const kvKey = `verify-code:${discordUser.id}:${trimmed.toLowerCase()}`

  // Reutiliza código existente no KV (persiste mesmo se cookie/sessão for perdida)
  const existingCode = await kvGet(kvKey)
  if (existingCode) {
    // Atualiza o cookie com o código existente
    cookieStore.set('verify_data', JSON.stringify({ vrchatUsername: trimmed, code: existingCode }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24,
      sameSite: 'lax',
      path: '/',
    })
    return NextResponse.json({ code: existingCode })
  }

  const code = generateCode()

  // Salva no KV (expira em 24h) e no cookie
  await kvSet(kvKey, code, 60 * 60 * 24)

  cookieStore.set('verify_data', JSON.stringify({ vrchatUsername: trimmed, code }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24,
    sameSite: 'lax',
    path: '/',
  })

  return NextResponse.json({ code })
}
