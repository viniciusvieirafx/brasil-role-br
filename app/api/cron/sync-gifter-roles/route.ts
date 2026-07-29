import { NextRequest, NextResponse } from 'next/server'
import { kvKeys, kvGet, kvSet } from '@/lib/kv'

const BOT_TOKEN = () => process.env.DISCORD_BOT_TOKEN!
const GUILD_ID  = () => process.env.DISCORD_GUILD_ID!
const KV_KEY    = 'gifter-role-ids' // armazena os 10 role IDs no KV

// Cores gradientes: 1º = ouro brilhante → 10º = cinza
const ROLE_CONFIGS = [
  { name: '🥇 Top 1 Presenteador', color: 0xFFD700 }, // Ouro
  { name: '🥈 Top 2 Presenteador', color: 0xC0C0C0 }, // Prata
  { name: '🥉 Top 3 Presenteador', color: 0xCD7F32 }, // Bronze
  { name: '🎁 Top 4 Presenteador', color: 0xE91E63 }, // Rosa
  { name: '🎁 Top 5 Presenteador', color: 0x9C27B0 }, // Roxo
  { name: '🎁 Top 6 Presenteador', color: 0x3F51B5 }, // Índigo
  { name: '🎁 Top 7 Presenteador', color: 0x2196F3 }, // Azul
  { name: '🎁 Top 8 Presenteador', color: 0x00BCD4 }, // Ciano
  { name: '🎁 Top 9 Presenteador', color: 0x4CAF50 }, // Verde
  { name: '🎁 Top 10 Presenteador', color: 0x78909C }, // Cinza azulado
]

// ── Discord API helpers ──

async function discordApi(path: string, options?: RequestInit) {
  const res = await fetch(`https://discord.com/api/v10${path}`, {
    ...options,
    headers: {
      Authorization: `Bot ${BOT_TOKEN()}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Discord API ${res.status}: ${text}`)
  }
  return res.json()
}

async function createRole(name: string, color: number): Promise<string> {
  const role = await discordApi(`/guilds/${GUILD_ID()}/roles`, {
    method: 'POST',
    body: JSON.stringify({ name, color, hoist: true, mentionable: false }),
  })
  return role.id
}

async function deleteRole(roleId: string) {
  try {
    await fetch(`https://discord.com/api/v10/guilds/${GUILD_ID()}/roles/${roleId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bot ${BOT_TOKEN()}` },
    })
  } catch { /* role may already be deleted */ }
}

async function addRole(userId: string, roleId: string) {
  await fetch(
    `https://discord.com/api/v10/guilds/${GUILD_ID()}/members/${userId}/roles/${roleId}`,
    { method: 'PUT', headers: { Authorization: `Bot ${BOT_TOKEN()}` } }
  )
}

async function removeRole(userId: string, roleId: string) {
  await fetch(
    `https://discord.com/api/v10/guilds/${GUILD_ID()}/members/${userId}/roles/${roleId}`,
    { method: 'DELETE', headers: { Authorization: `Bot ${BOT_TOKEN()}` } }
  )
}

async function getGuildMembers(): Promise<{ user: { id: string }; roles: string[] }[]> {
  const allMembers: any[] = []
  let after = '0'

  while (true) {
    const batch = await discordApi(
      `/guilds/${GUILD_ID()}/members?limit=1000&after=${after}`
    )
    if (!batch.length) break
    allMembers.push(...batch)
    if (batch.length < 1000) break
    after = batch[batch.length - 1].user.id
  }

  return allMembers
}

// ── Garantir que os 10 cargos existam ──

async function ensureRolesExist(): Promise<string[]> {
  // Tenta carregar IDs salvos no KV
  const saved = await kvGet(KV_KEY)
  let roleIds: string[] = saved ? JSON.parse(saved) : []

  if (roleIds.length === 10) {
    // Verifica se os cargos ainda existem no Discord
    const guildRoles: { id: string }[] = await discordApi(`/guilds/${GUILD_ID()}/roles`)
    const existingIds = new Set(guildRoles.map(r => r.id))
    const allExist = roleIds.every(id => existingIds.has(id))

    if (allExist) return roleIds

    // Algum cargo foi deletado — recria todos
    console.log('[sync-gifter-roles] Alguns cargos foram deletados, recriando...')
    for (const id of roleIds) {
      if (existingIds.has(id)) await deleteRole(id)
    }
    roleIds = []
  }

  // Cria os 10 cargos
  console.log('[sync-gifter-roles] Criando 10 cargos de Top Presenteador...')
  roleIds = []
  for (const cfg of ROLE_CONFIGS) {
    const id = await createRole(cfg.name, cfg.color)
    roleIds.push(id)
    // Rate limit: Discord permite ~5 req/seg
    await new Promise(r => setTimeout(r, 300))
  }

  await kvSet(KV_KEY, JSON.stringify(roleIds))
  console.log('[sync-gifter-roles] Cargos criados:', roleIds)
  return roleIds
}

// ── Handler ──

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 1. Garantir que os cargos existam
    const roleIds = await ensureRolesExist()

    // 2. Buscar ranking de presenteadores
    const gifterKeys = await kvKeys('gifter-points:*')

    const gifters: { discordId: string; points: number; firstGiftAt: string }[] = []
    if (gifterKeys.length > 0) {
      const results = await Promise.all(gifterKeys.map(k => kvGet(k)))
      for (let i = 0; i < gifterKeys.length; i++) {
        const raw = results[i]
        if (!raw) continue
        const data = JSON.parse(raw)
        if (data.points > 0) {
          gifters.push({
            discordId: gifterKeys[i].replace('gifter-points:', ''),
            points: data.points,
            firstGiftAt: data.firstGiftAt,
          })
        }
      }
    }

    // Ordena: maior pontuação primeiro, empate por quem presenteou primeiro
    gifters.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      return new Date(a.firstGiftAt).getTime() - new Date(b.firstGiftAt).getTime()
    })

    const top10 = gifters.slice(0, 10)

    // 3. Buscar todos os membros para saber quem tem os cargos atualmente
    const members = await getGuildMembers()
    const roleIdSet = new Set(roleIds)

    // Mapa: roleId → userId atual que tem esse cargo
    const currentHolders = new Map<string, string>()
    for (const member of members) {
      for (const roleId of member.roles) {
        if (roleIdSet.has(roleId)) {
          currentHolders.set(roleId, member.user.id)
        }
      }
    }

    // 4. Atualizar cargos
    let added = 0
    let removed = 0

    for (let i = 0; i < 10; i++) {
      const roleId = roleIds[i]
      const newHolder = top10[i]?.discordId ?? null
      const currentHolder = currentHolders.get(roleId) ?? null

      // Se o holder correto já tem o cargo, nada a fazer
      if (newHolder && newHolder === currentHolder) continue

      // Remove do holder anterior (se houver)
      if (currentHolder) {
        await removeRole(currentHolder, roleId)
        removed++
        await new Promise(r => setTimeout(r, 300))
      }

      // Adiciona ao novo holder (se houver)
      if (newHolder) {
        // Verifica se o membro está no servidor
        const isMember = members.some(m => m.user.id === newHolder)
        if (isMember) {
          await addRole(newHolder, roleId)
          added++
          await new Promise(r => setTimeout(r, 300))
        }
      }
    }

    // 5. Remove cargos de presenteador de quem não está mais no top 10
    // (caso alguém tenha um cargo de posição que não é mais a dele)
    const top10Ids = new Set(top10.map(g => g.discordId))
    for (const member of members) {
      if (top10Ids.has(member.user.id)) continue
      for (const roleId of member.roles) {
        if (roleIdSet.has(roleId)) {
          await removeRole(member.user.id, roleId)
          removed++
          await new Promise(r => setTimeout(r, 300))
        }
      }
    }

    const result = {
      date: new Date().toISOString(),
      top10: top10.map((g, i) => ({ position: i + 1, discordId: g.discordId, points: g.points })),
      rolesAdded: added,
      rolesRemoved: removed,
    }

    console.log(`[sync-gifter-roles] Sincronizado — ${added} adicionados, ${removed} removidos`)
    return NextResponse.json(result)
  } catch (e: any) {
    console.error('[sync-gifter-roles] Erro:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
