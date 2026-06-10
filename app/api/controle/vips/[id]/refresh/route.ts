import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/adminAuth'

function requireAuth(req: NextRequest): boolean {
  const token = req.cookies.get(COOKIE_NAME)?.value
  return token ? verifyToken(token) : false
}

const GUILD_ID  = () => process.env.DISCORD_GUILD_ID!
const BOT_TOKEN = () => process.env.DISCORD_BOT_TOKEN!

// GET: busca nome/nick atualizado do membro direto no Discord
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!requireAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: discordId } = await params

  const res = await fetch(
    `https://discord.com/api/v10/guilds/${GUILD_ID()}/members/${discordId}`,
    { headers: { Authorization: `Bot ${BOT_TOKEN()}` } }
  )

  if (!res.ok) {
    return NextResponse.json({ error: 'Membro não encontrado no servidor' }, { status: 404 })
  }

  const member = await res.json()
  return NextResponse.json({
    username:   member.user?.username   ?? null,
    globalName: member.user?.global_name ?? null,
    nick:       member.nick             ?? null,
  })
}
