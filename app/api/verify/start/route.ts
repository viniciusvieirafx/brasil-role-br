import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

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

  const { vrchatUsername } = await req.json()
  if (!vrchatUsername?.trim()) {
    return NextResponse.json({ error: 'Username obrigatório' }, { status: 400 })
  }

  const code = generateCode()

  cookieStore.set('verify_data', JSON.stringify({ vrchatUsername: vrchatUsername.trim(), code }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 30,
    sameSite: 'lax',
    path: '/',
  })

  return NextResponse.json({ code })
}
