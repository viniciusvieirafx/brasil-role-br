import { kvGet, kvSet } from '@/lib/kv'
import type { Grupo, GrupoSorteio } from '@/lib/grupos'

export type Vencedor = { id: string; nome: string; colocacao: number }

const SORTEIO_CHANNEL = '1480918957937397760'
const MEDALS = ['🥇', '🥈', '🥉']

function medal(n: number) {
  return MEDALS[n - 1] ?? `${n}º`
}

export async function fetchNome(userId: string): Promise<string> {
  try {
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/members/${userId}`,
      { headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` } }
    )
    if (res.ok) {
      const m = await res.json()
      return m.nick ?? m.user?.global_name ?? m.user?.username ?? userId
    }
  } catch {}
  return userId
}

export async function executarSorteio(sorteio: {
  participantes: string[]
  numVencedores?: number
  vipBonus?: boolean
  vipMultiplier?: number
}): Promise<Vencedor[]> {
  const numVencedores = Math.max(1, sorteio.numVencedores ?? 1)
  const today = new Date().toISOString().split('T')[0]
  const pool: string[] = []

  for (const id of sorteio.participantes) {
    let entries = 1
    if (sorteio.vipBonus) {
      const vipRaw = await kvGet(`vip:${id}`)
      if (vipRaw) {
        const v = JSON.parse(vipRaw)
        if (v.expiresAt >= today) entries = sorteio.vipMultiplier ?? 3
      }
    }
    for (let i = 0; i < entries; i++) pool.push(id)
  }

  const pickedIds: string[] = []
  let remainingPool = [...pool]

  for (let i = 0; i < numVencedores && remainingPool.length > 0; i++) {
    const idx = Math.floor(Math.random() * remainingPool.length)
    const winnerId = remainingPool[idx]
    pickedIds.push(winnerId)
    remainingPool = remainingPool.filter(id => id !== winnerId)
  }

  const nomes = await Promise.all(pickedIds.map(fetchNome))
  return pickedIds.map((id, i) => ({ id, nome: nomes[i], colocacao: i + 1 }))
}

export async function anunciarVencedores(
  titulo: string,
  descricao: string,
  vencedores: Vencedor[],
  totalParticipantes: number,
  vipBonus: boolean,
  vipMultiplier: number,
  modoResultado: 'igual' | 'colocacao',
  premio: string | null = null,
  premioDias = 0,
) {
  const fields: { name: string; value: string; inline: boolean }[] = []

  if (descricao) {
    fields.push({ name: '📋 Sobre o sorteio', value: descricao, inline: false })
  }

  if (modoResultado === 'colocacao') {
    for (const v of vencedores) {
      fields.push({
        name: `${medal(v.colocacao)} ${v.colocacao}º lugar`,
        value: `<@${v.id}> **(${v.nome})**`,
        inline: true,
      })
    }
  } else if (vencedores.length === 1) {
    fields.push({
      name: '🏆 Vencedor',
      value: `<@${vencedores[0].id}> **(${vencedores[0].nome})**`,
      inline: false,
    })
  } else {
    fields.push({
      name: `🏆 ${vencedores.length} Ganhadores`,
      value: vencedores.map(v => `<@${v.id}> **(${v.nome})**`).join('\n'),
      inline: false,
    })
  }

  if (premio === 'vip') {
    fields.push({ name: '🎁 Prêmio', value: `**${premioDias} dias de VIP** já ativados!`, inline: true })
  }

  fields.push({ name: '👥 Participantes', value: `${totalParticipantes} pessoas participaram`, inline: true })

  if (vipBonus) {
    fields.push({ name: '👑 Bônus VIP', value: `VIPs tiveram ${vipMultiplier}× mais chances`, inline: true })
  }

  const content = vencedores.length === 1
    ? `🎉 **Sorteio encerrado!** Parabéns <@${vencedores[0].id}>!`
    : `🎉 **Sorteio encerrado!** Parabéns aos ${vencedores.length} ganhadores! ${vencedores.map(v => `<@${v.id}>`).join(' ')}`

  await fetch(`https://discord.com/api/v10/channels/${SORTEIO_CHANNEL}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content,
      embeds: [{
        title: `🎲 ${titulo}`,
        color: 0xFFD700,
        fields,
        footer: { text: 'Brasil Role BR · Sorteio da Comunidade' },
        timestamp: new Date().toISOString(),
      }],
    }),
  })
}

export async function concederVip(discordId: string, dias: number): Promise<void> {
  const roleId = process.env.DISCORD_VIP_ROLE_ID!
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + dias)
  const expiresAtStr = expiresAt.toISOString().split('T')[0]

  await kvSet(`vip:${discordId}`, JSON.stringify({ expiresAt: expiresAtStr, roleId }))

  await fetch(
    `https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/members/${discordId}/roles/${roleId}`,
    {
      method: 'PUT',
      headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' },
    }
  )
}

async function sendDM(discordId: string, message: string): Promise<void> {
  const dmRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
    method: 'POST',
    headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient_id: discordId }),
  })
  if (!dmRes.ok) return
  const { id: channelId } = await dmRes.json()
  await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: message }),
  })
}

export async function notificarVencedores(
  vencedores: Vencedor[],
  premio: string | null,
  premioDias: number,
): Promise<void> {
  const siteUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://brasil-role-br.com'
  for (const v of vencedores) {
    const msg = premio === 'vip'
      ? `🎉 **Parabéns ${v.nome}! Você ganhou o sorteio do Brasil Role BR!**\n\n` +
        `Seu prêmio de **${premioDias} dias de VIP** já foi ativado automaticamente na sua conta! Aproveite todos os benefícios!\n\n` +
        `🔗 ${siteUrl}\n\n` +
        `Obrigado por participar! 🇧🇷`
      : `🎉 **Parabéns ${v.nome}! Você ganhou o sorteio do Brasil Role BR!**\n\n` +
        `Entre em contato com a equipe para resgatar seu prêmio.\n\n` +
        `🔗 ${siteUrl}\n\n` +
        `Obrigado por participar! 🇧🇷`
    try {
      await sendDM(v.id, msg)
    } catch {}
  }
}

// ── Funções de grupo ──────────────────────────────────────────────────────────

async function postChannel(channelId: string, body: object) {
  await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

/** Anúncio inicial do sorteio no canal do grupo (com botão para o site) */
export async function anunciarSorteioGrupo(grupo: Grupo, sorteio: GrupoSorteio): Promise<void> {
  if (!grupo.canalId) return
  const siteUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://brasil-role-br.com'
  const url = `${siteUrl}/sorteio/${grupo.slug}`

  const expiraStr = sorteio.expiraEm
    ? `<t:${Math.floor(new Date(sorteio.expiraEm).getTime() / 1000)}:F>`
    : 'Sem data definida'

  await postChannel(grupo.canalId, {
    embeds: [{
      title: `🎲 Sorteio ${grupo.nome}`,
      description: sorteio.descricao,
      color: 0x5865F2,
      fields: [
        { name: '🏆 Vencedores', value: `${sorteio.numVencedores}`, inline: true },
        { name: '🎁 Prêmio', value: `${sorteio.premioDias} dias de VIP`, inline: true },
        { name: '📅 Encerra', value: expiraStr, inline: false },
        { name: '✅ Requisito', value: 'Conta VRChat verificada em brasil-role-br.com', inline: false },
      ],
      footer: { text: 'Clique no botão abaixo para participar!' },
      timestamp: new Date().toISOString(),
    }],
    components: [{
      type: 1,
      components: [{
        type: 2,
        style: 5,
        label: '🎲 Participar do Sorteio',
        url,
      }],
    }],
  })
}

/** Notifica quando alguém entra no sorteio do grupo */
export async function notificarParticipanteGrupo(
  grupo: Grupo,
  nomeParticipante: string,
  totalParticipantes: number,
): Promise<void> {
  // Notificar canal do grupo (azul Discord)
  if (grupo.canalId) {
    await postChannel(grupo.canalId, {
      embeds: [{
        description: `✅ **${nomeParticipante}** entrou no sorteio! (${totalParticipantes} participantes)`,
        color: 0x57F287,
      }],
    })
  }

  // Notificar canal principal (laranja — identifica o grupo de origem)
  await postChannel(SORTEIO_CHANNEL, {
    embeds: [{
      description: `✅ **${nomeParticipante}** entrou no sorteio de **${grupo.nome}** (${totalParticipantes} participantes)`,
      color: 0xFF6B00,
      footer: { text: `Sorteio do grupo parceiro · ${grupo.nome}` },
    }],
  })
}

/** Anuncia vencedores no canal do grupo e no canal principal */
export async function anunciarVencedoresGrupo(
  grupo: Grupo,
  sorteio: GrupoSorteio,
  vencedores: Vencedor[],
): Promise<void> {
  const fields: { name: string; value: string; inline: boolean }[] = []

  if (vencedores.length === 1) {
    fields.push({
      name: '🏆 Vencedor',
      value: `<@${vencedores[0].id}> **(${vencedores[0].nome})**`,
      inline: false,
    })
  } else {
    for (const v of vencedores) {
      fields.push({
        name: `${MEDALS[v.colocacao - 1] ?? `${v.colocacao}º`} ${v.colocacao}º lugar`,
        value: `<@${v.id}> **(${v.nome})**`,
        inline: true,
      })
    }
  }

  fields.push({ name: '🎁 Prêmio', value: `**${sorteio.premioDias} dias de VIP** já ativados!`, inline: true })
  fields.push({ name: '👥 Participantes', value: `${sorteio.participantes.length} pessoas participaram`, inline: true })

  const content = vencedores.length === 1
    ? `🎉 **Sorteio encerrado!** Parabéns <@${vencedores[0].id}>!`
    : `🎉 **Sorteio encerrado!** Parabéns! ${vencedores.map(v => `<@${v.id}>`).join(' ')}`

  const baseEmbed = {
    title: `🎲 ${sorteio.titulo}`,
    fields,
    timestamp: new Date().toISOString(),
  }

  // Postar no canal do grupo (azul)
  if (grupo.canalId) {
    await postChannel(grupo.canalId, {
      content,
      embeds: [{ ...baseEmbed, color: 0x5865F2, footer: { text: `Sorteio ${grupo.nome}` } }],
    })
  }

  // Postar no canal principal (laranja — identifica grupo)
  await postChannel(SORTEIO_CHANNEL, {
    content,
    embeds: [{
      ...baseEmbed,
      color: 0xFF6B00,
      footer: { text: `Sorteio do grupo parceiro · ${grupo.nome}` },
    }],
  })
}
