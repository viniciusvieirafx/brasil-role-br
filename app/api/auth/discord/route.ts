import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get('from') ?? 'vip'
  const clientId = process.env.DISCORD_CLIENT_ID!
  const redirectUri = encodeURIComponent(process.env.DISCORD_REDIRECT_URI!)
  const url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify`
  const res = NextResponse.redirect(url)
  res.cookies.set('auth_origin', from, { httpOnly: true, maxAge: 60 * 10, sameSite: 'lax', path: '/' })
  return res
}
