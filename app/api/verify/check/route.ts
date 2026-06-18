import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const NOTIFY_CHANNEL = '1480918950404423835'

async function getVRChatUser(username: string): Promise<{ bio: string; displayName: string } | null> {
  const proxyUrl = process.env.VRCHAT_PROXY_URL
  const proxyKey = process.env.VRCHAT_PROXY_KEY

  if (!proxyUrl || !proxyKey) throw new Error('Proxy VRChat não configurado')

  const res = await fetch(`${proxyUrl}/user?name=${encodeURIComponent(username)}`, {
    headers: { 'x-api-key': proxyKey },
  })

  if (res.status === 401) throw new Error('API key inválida')
  if (res.status === 503) throw new Error('Sessão VRChat expirada, tente em instantes')
  if (!res.ok) throw new Error(`Erro no proxy: ${res.status}`)

  const data = await res.json()
  if (!data.found) return null
  return { bio: data.bio ?? '', displayName: data.displayName }
}

async function addDiscordRole(userId: string) {
  const res = await fetch(
    `https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/members/${userId}/roles/${process.env.DISCORD_VERIFIED_ROLE_ID}`,
    { method: 'PUT', headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' } }
  )
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error(`[verify] FALHA ao adicionar cargo para ${userId}: HTTP ${res.status} ${body}`)
    throw new Error(`Erro ao ativar cargo no Discord (${res.status}). Tente novamente ou contate o suporte.`)
  }
}

async function changeDiscordNickname(userId: string, nickname: string) {
  const res = await fetch(
    `https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/members/${userId}`,
    { method: 'PATCH', headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ nick: nickname }) }
  )
  if (!res.ok) {
    console.error(`[verify] Falha ao mudar nick de ${userId}: HTTP ${res.status}`)
    // Não bloqueia a verificação por causa do nick
  }
}

async function sendDiscordNotification(discordUser: { id: string; username: string; globalName: string | null }, vrchatName: string) {
  const name = discordUser.globalName ?? discordUser.username
  await fetch(`https://discord.com/api/v10/channels/${NOTIFY_CHANNEL}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embeds: [{
        title: '✅ Usuário Verificado',
        color: 0x009B3A,
        fields: [
          { name: 'Discord', value: `${name} (<@${discordUser.id}>)`, inline: true },
          { name: 'VRChat', value: vrchatName, inline: true },
        ],
        timestamp: new Date().toISOString(),
      }],
    }),
  })
}

export async function POST(_req: NextRequest) {
  const cookieStore = await cookies()
  const discordUserCookie = cookieStore.get('discord_user')
  const verifyDataCookie = cookieStore.get('verify_data')

  if (!discordUserCookie || !verifyDataCookie) {
    return NextResponse.json({ error: 'Sessão expirada, clique em "Trocar usuário" e tente novamente' }, { status: 401 })
  }

  const discordUser = JSON.parse(discordUserCookie.value)
  const { vrchatUsername, code } = JSON.parse(verifyDataCookie.value)

  let vrchatUser
  try {
    vrchatUser = await getVRChatUser(vrchatUsername)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }

  if (!vrchatUser) {
    return NextResponse.json({ verified: false, error: `Usuário "${vrchatUsername}" não encontrado. Confira o nome exato no VRChat.` })
  }

  if (!vrchatUser.bio.includes(code)) {
    return NextResponse.json({ verified: false, error: 'Código não encontrado na bio. Certifique-se que salvou o perfil no VRChat.' })
  }

  try {
    await addDiscordRole(discordUser.id)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }

  // Nick e notificação são best-effort — não bloqueiam
  await Promise.allSettled([
    changeDiscordNickname(discordUser.id, vrchatUser.displayName),
    sendDiscordNotification(discordUser, vrchatUser.displayName),
  ])

  cookieStore.set('verify_data', '', { maxAge: 0, path: '/' })
  return NextResponse.json({ verified: true })
}
