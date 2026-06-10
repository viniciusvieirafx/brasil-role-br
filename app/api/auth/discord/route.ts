import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get('from') ?? 'vip'
  const clientId = process.env.DISCORD_CLIENT_ID!
  const redirectUri = encodeURIComponent(process.env.DISCORD_REDIRECT_URI!)
  // state param survives the cross-site redirect reliably (cookie SameSite=Lax can be dropped)
  const state = encodeURIComponent(from)
  const url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify&state=${state}`
  return NextResponse.redirect(url)
}
