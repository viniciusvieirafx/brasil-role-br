export async function isUserVerified(userId: string): Promise<boolean> {
  const token = process.env.DISCORD_BOT_TOKEN
  const guildId = process.env.DISCORD_GUILD_ID
  const roleId = process.env.DISCORD_VERIFIED_ROLE_ID
  if (!token || !guildId || !roleId) return false

  const res = await fetch(
    `https://discord.com/api/v10/guilds/${guildId}/members/${userId}`,
    { headers: { Authorization: `Bot ${token}` }, cache: 'no-store' }
  )
  if (!res.ok) return false
  const member = await res.json()
  return Array.isArray(member.roles) && member.roles.includes(roleId)
}
