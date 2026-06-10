import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const baseUrl = new URL('/', req.url).toString()

  if (!code) {
    return NextResponse.redirect(`${baseUrl}#vip`)
  }

  const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID!,
      client_secret: process.env.DISCORD_CLIENT_SECRET!,
      code,
      grant_type: 'authorization_code',
      redirect_uri: process.env.DISCORD_REDIRECT_URI!,
    }),
  })

  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) {
    return NextResponse.redirect(`${baseUrl}#vip`)
  }

  const userRes = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  })
  const user = await userRes.json()

  const cookieStore = await cookies()
  // Prefer state param (survives cross-site redirects); fall back to cookie for old flows
  const stateParam = req.nextUrl.searchParams.get('state')
  const origin = stateParam ? decodeURIComponent(stateParam) : (cookieStore.get('auth_origin')?.value ?? 'vip')

  cookieStore.set('discord_user', JSON.stringify({
    id: user.id,
    username: user.username,
    avatar: user.avatar,
    globalName: user.global_name,
  }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7,
    sameSite: 'lax',
    path: '/',
  })

  cookieStore.set('auth_origin', '', { maxAge: 0, path: '/' })
  return NextResponse.redirect(`${baseUrl}#${origin}`)
}
