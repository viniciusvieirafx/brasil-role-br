import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/grupoAuth'
import { getGrupo, saveGrupo } from '@/lib/grupos'
import { kvGet, kvSet } from '@/lib/kv'
import { concederVip } from '@/lib/sorteio'
import { sendDiscordDMEmbed } from '@/lib/discord-dm'

const NOTIFY_CHANNEL = '1480918950404423835'
const TIER_NAMES: Record<number, string> = { 1: 'VIP Bronze', 2: 'VIP Prata', 3: 'VIP Ouro' }
const TIER_COLORS: Record<number, number> = { 1: 0xCD7F32, 2: 0xC0C0C0, 3: 0xFFD700 }

async function searchMemberByNick(nick: string): Promise<{ id: string; nick: string } | null> {
  const guildId = process.env.DISCORD_GUILD_ID!
  const botToken = process.env.DISCORD_BOT_TOKEN!
  const verifiedRoleId = process.env.DISCORD_VERIFIED_ROLE_ID!

  const res = await fetch(
    `https://discord.com/api/v10/guilds/${guildId}/members/search?query=${encodeURIComponent(nick)}&limit=100`,
    { headers: { Authorization: `Bot ${botToken}` } },
  )
  if (!res.ok) return null

  const members: any[] = await res.json()
  // Busca match exato pelo nick (case-insensitive)
  const match = members.find((m: any) => {
    if (!Array.isArray(m.roles) || !m.roles.includes(verifiedRoleId)) return false
    const memberNick = (m.nick ?? '').toLowerCase()
    return memberNick === nick.toLowerCase()
  })

  if (!match) return null
  return { id: match.user.id, nick: match.nick ?? match.user.global_name ?? match.user.username }
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const auth = verifyToken(token)
  if (!auth.valid || !auth.slug) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })

  const grupo = await getGrupo(auth.slug)
  if (!grupo) return NextResponse.json({ error: 'Grupo não encontrado' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const vrchatName: string = (body.vrchatName ?? '').trim()
  const tier: number = [1, 2, 3].includes(body.tier) ? body.tier : 1

  if (!vrchatName) {
    return NextResponse.json({ error: 'Nome do VRChat é obrigatório' }, { status: 400 })
  }

  // Validar estoque
  const estoque = grupo.vipsPorTier[tier as 1 | 2 | 3] ?? 0
  if (estoque <= 0) {
    return NextResponse.json({ error: `Sem VIPs ${TIER_NAMES[tier]} disponíveis` }, { status: 400 })
  }

  // Buscar membro verificado pelo nick
  const member = await searchMemberByNick(vrchatName)
  const tierName = TIER_NAMES[tier] ?? `VIP Tier ${tier}`

  if (member) {
    // Membro encontrado — dar VIP direto
    await concederVip(member.id, 30, tier)

    // DM para o recebedor
    await sendDiscordDMEmbed(member.id, {
      title: '🎁 Você recebeu um presente!',
      description: `O grupo **${grupo.nome}** te presenteou com **${tierName}**!\n\nSeu cargo VIP já está ativo no Discord e vale por 30 dias.`,
      color: TIER_COLORS[tier] ?? 0xFFD700,
    })

    // Notificação no canal admin
    await fetch(`https://discord.com/api/v10/channels/${NOTIFY_CHANNEL}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        embeds: [{
          title: `🎁 VIP Presente — ${tierName}`,
          color: TIER_COLORS[tier] ?? 0xFFD700,
          fields: [
            { name: '👤 Recebedor', value: `${member.nick} (<@${member.id}>)`, inline: true },
            { name: '🏅 Plano', value: tierName, inline: true },
            { name: '🎁 Grupo', value: grupo.nome, inline: true },
          ],
          footer: { text: 'Brasil Role BR · VIP' },
          timestamp: new Date().toISOString(),
        }],
      }),
    })

    // Descontar estoque
    grupo.vipsPorTier[tier as 1 | 2 | 3] -= 1
    grupo.vipsDisponiveis = grupo.vipsPorTier[1] + grupo.vipsPorTier[2] + grupo.vipsPorTier[3]
    await saveGrupo(grupo)

    return NextResponse.json({
      ok: true,
      status: 'activated',
      message: `VIP ${tierName} ativado para ${member.nick}!`,
      vipsPorTier: grupo.vipsPorTier,
    })
  } else {
    // Membro não encontrado — salvar como pendente
    const pendingKey = `pending-vrc-gift:${vrchatName.toLowerCase()}`
    const existingRaw = await kvGet(pendingKey)
    const existing = existingRaw ? JSON.parse(existingRaw) : []
    existing.push({
      tier,
      grupoSlug: auth.slug,
      grupoNome: grupo.nome,
      createdAt: new Date().toISOString(),
    })
    await kvSet(pendingKey, JSON.stringify(existing))

    // Descontar estoque
    grupo.vipsPorTier[tier as 1 | 2 | 3] -= 1
    grupo.vipsDisponiveis = grupo.vipsPorTier[1] + grupo.vipsPorTier[2] + grupo.vipsPorTier[3]
    await saveGrupo(grupo)

    return NextResponse.json({
      ok: true,
      status: 'pending',
      message: `${vrchatName} não está verificado. O ${tierName} será ativado automaticamente quando verificar a conta VRChat.`,
      vipsPorTier: grupo.vipsPorTier,
    })
  }
}
