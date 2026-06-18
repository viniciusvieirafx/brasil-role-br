/**
 * Consulta os cargos do membro no Discord e retorna o tier VIP atual (0–3).
 * Chamado a cada carregamento de página para nunca usar dado stale do cookie.
 */
export async function getVipTier(userId: string): Promise<number> {
  const guildId  = process.env.DISCORD_GUILD_ID!
  const botToken = process.env.DISCORD_BOT_TOKEN!
  const vip1     = process.env.DISCORD_VIP_ROLE_ID!
  const vip2     = process.env.DISCORD_VIP2_ROLE_ID!
  const vip3     = process.env.DISCORD_VIP3_ROLE_ID!

  try {
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${userId}`,
      { headers: { Authorization: `Bot ${botToken}` }, next: { revalidate: 0 } }
    )
    if (!res.ok) return 0
    const member = await res.json()
    const roles: string[] = member.roles ?? []
    if (vip3 && roles.includes(vip3)) return 3
    if (vip2 && roles.includes(vip2)) return 2
    if (vip1 && roles.includes(vip1)) return 1
    return 0
  } catch {
    return 0
  }
}
