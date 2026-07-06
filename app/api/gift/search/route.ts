import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const discordUserCookie = cookieStore.get('discord_user')

  if (!discordUserCookie) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const query = req.nextUrl.searchParams.get('q')?.trim()
  if (!query || query.length < 2) {
    return NextResponse.json({ error: 'Digite pelo menos 2 caracteres' }, { status: 400 })
  }

  const res = await fetch(
    `https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/members/search?query=${encodeURIComponent(query)}&limit=5`,
    { headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` } },
  )

  if (!res.ok) {
    return NextResponse.json({ error: 'Erro ao buscar membros' }, { status: 500 })
  }

  const members = await res.json()

  const currentUser = JSON.parse(discordUserCookie.value)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results = members
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((m: any) => m.user && !m.user.bot && m.user.id !== currentUser.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((m: any) => ({
      id: m.user.id,
      username: m.user.username,
      globalName: m.user.global_name ?? null,
      avatar: m.user.avatar,
      nick: m.nick ?? null,
    }))

  return NextResponse.json({ members: results })
}
