import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get('from') ?? 'vip'
  const clientId = process.env.DISCORD_CLIENT_ID!
  // Use current origin so funciona tanto em localhost quanto em produção
  const origin = new URL(req.url).origin
  const redirectUri = encodeURIComponent(`${origin}/api/auth/callback`)
  const state = encodeURIComponent(from)
  const url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify&state=${state}`
  return NextResponse.redirect(url)
}
