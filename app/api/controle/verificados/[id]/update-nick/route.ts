import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/adminAuth'

function requireAuth(req: NextRequest): boolean {
  const token = req.cookies.get(COOKIE_NAME)?.value
  return token ? verifyToken(token) : false
}

const GUILD_ID  = () => process.env.DISCORD_GUILD_ID!
const BOT_TOKEN = () => process.env.DISCORD_BOT_TOKEN!

async function getVRChatDisplayName(vrchatUsername: string): Promise<string | null> {
  const proxyUrl = process.env.VRCHAT_PROXY_URL
  const proxyKey = process.env.VRCHAT_PROXY_KEY
  if (!proxyUrl || !proxyKey) throw new Error('Proxy VRChat não configurado')

  const res = await fetch(`${proxyUrl}/user?name=${encodeURIComponent(vrchatUsername)}`, {
    headers: { 'x-api-key': proxyKey },
  })

  if (res.status === 401) throw new Error('API key inválida')
  if (res.status === 503) throw new Error('Sessão VRChat expirada, tente em instantes')
  if (!res.ok) throw new Error(`Erro no proxy VRChat: ${res.status}`)

  const data = await res.json()
  if (!data.found) return null
  return data.displayName ?? null
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!requireAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: discordId } = await params
  const body = await req.json()
  const vrchatUsername: string = body.vrchatUsername?.trim()

  if (!vrchatUsername) {
    return NextResponse.json({ error: 'Informe o username do VRChat' }, { status: 400 })
  }

  let displayName: string | null
  try {
    displayName = await getVRChatDisplayName(vrchatUsername)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }

  if (!displayName) {
    return NextResponse.json({ error: `Usuário "${vrchatUsername}" não encontrado no VRChat` }, { status: 404 })
  }

  const discordRes = await fetch(
    `https://discord.com/api/v10/guilds/${GUILD_ID()}/members/${discordId}`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bot ${BOT_TOKEN()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ nick: displayName }),
    }
  )

  if (!discordRes.ok && discordRes.status !== 204) {
    const err = await discordRes.text().catch(() => '')
    return NextResponse.json({ error: `Erro ao atualizar Discord: ${discordRes.status} ${err}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true, displayName })
}
