import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key')
  if (!key || key !== process.env.VRC_LIST_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const guildId  = process.env.DISCORD_GUILD_ID!
  const botToken = process.env.DISCORD_BOT_TOKEN!
  const vip1     = process.env.DISCORD_VIP_ROLE_ID  ?? '(nao definido)'
  const vip2     = process.env.DISCORD_VIP2_ROLE_ID ?? '(nao definido)'
  const vip3     = process.env.DISCORD_VIP3_ROLE_ID ?? '(nao definido)'

  // Busca membros
  const res = await fetch(
    `https://discord.com/api/v10/guilds/${guildId}/members?limit=100`,
    { headers: { Authorization: `Bot ${botToken}` } }
  )

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: `Discord API ${res.status}: ${err}` }, { status: 500 })
  }

  const members: any[] = await res.json()

  // Filtra só quem tem algum cargo VIP
  const vipRoles = [vip1, vip2, vip3].filter(r => r !== '(nao definido)')
  const vipMembers = members.filter(m =>
    Array.isArray(m.roles) && m.roles.some((r: string) => vipRoles.includes(r))
  )

  const result = {
    env: { vip1_role: vip1, vip2_role: vip2, vip3_role: vip3 },
    total_members_fetched: members.length,
    vip_members_found: vipMembers.length,
    members: vipMembers.map(m => ({
      discord_id:   m.user?.id,
      username:     m.user?.username,
      global_name:  m.user?.global_name,
      server_nick:  m.nick,
      roles:        m.roles,
      has_vip1:     m.roles?.includes(vip1),
      has_vip2:     m.roles?.includes(vip2),
      has_vip3:     m.roles?.includes(vip3),
    }))
  }

  return NextResponse.json(result, { status: 200 })
}
