import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/grupoAuth'

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const auth = verifyToken(token)
  if (!auth.valid) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })

  const clientId = process.env.DISCORD_CLIENT_ID
  if (!clientId) return NextResponse.json({ url: null })

  const url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=84992&scope=bot`
  return NextResponse.json({ url })
}
