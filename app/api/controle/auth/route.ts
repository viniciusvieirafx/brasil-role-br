import { NextRequest, NextResponse } from 'next/server'
import { signToken, verifyToken, checkRateLimit, clearRateLimit, COOKIE_NAME } from '@/lib/adminAuth'

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  const rate = checkRateLimit(ip)
  if (!rate.allowed) {
    return NextResponse.json(
      { error: `Muitas tentativas. Tente de novo em ${rate.retryAfter}s.` },
      { status: 429 }
    )
  }

  const { password } = await req.json()
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 })
  }

  clearRateLimit(ip)
  const token = signToken()

  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge:   8 * 60 * 60,
    path:     '/',
  })
  return res
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  return NextResponse.json({ authenticated: token ? verifyToken(token) : false })
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete(COOKIE_NAME)
  return res
}
