import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getVipTier } from '@/lib/getVipTier'

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
      redirect_uri: `${new URL(req.url).origin}/api/auth/callback`,
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

  const vipTier = await getVipTier(user.id)

  const cookieStore = await cookies()
  const stateParam = req.nextUrl.searchParams.get('state')
  const origin = stateParam ? decodeURIComponent(stateParam) : (cookieStore.get('auth_origin')?.value ?? 'vip')

  cookieStore.set('discord_user', JSON.stringify({
    id: user.id,
    username: user.username,
    avatar: user.avatar,
    globalName: user.global_name,
    vipTier,
  }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7,
    sameSite: 'lax',
    path: '/',
  })

  cookieStore.set('auth_origin', '', { maxAge: 0, path: '/' })
  if (origin.startsWith('/')) {
    return NextResponse.redirect(`${baseUrl.replace(/\/$/, '')}${origin}`)
  }
  return NextResponse.redirect(`${baseUrl}#${origin}`)
}
