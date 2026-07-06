/** Envia uma DM (direct message) para um usuário no Discord via bot */
export async function sendDiscordDM(userId: string, content: string): Promise<boolean> {
  try {
    // 1. Criar canal DM
    const channelRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
      method: 'POST',
      headers: {
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ recipient_id: userId }),
    })

    if (!channelRes.ok) {
      console.error(`[dm] Falha ao criar canal DM para ${userId}: ${channelRes.status}`)
      return false
    }

    const channel = await channelRes.json()

    // 2. Enviar mensagem
    const msgRes = await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content }),
    })

    if (!msgRes.ok) {
      console.error(`[dm] Falha ao enviar DM para ${userId}: ${msgRes.status}`)
      return false
    }

    return true
  } catch (e) {
    console.error(`[dm] Erro ao enviar DM para ${userId}:`, e)
    return false
  }
}

/** Envia uma DM com embed formatado */
export async function sendDiscordDMEmbed(
  userId: string,
  embed: { title: string; description: string; color: number; fields?: { name: string; value: string; inline?: boolean }[] },
): Promise<boolean> {
  try {
    const channelRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
      method: 'POST',
      headers: {
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ recipient_id: userId }),
    })

    if (!channelRes.ok) return false

    const channel = await channelRes.json()

    const msgRes = await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        embeds: [{ ...embed, timestamp: new Date().toISOString() }],
      }),
    })

    return msgRes.ok
  } catch {
    return false
  }
}
