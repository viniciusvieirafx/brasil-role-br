import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/adminAuth'
import { kvKeys, kvGet, kvDel } from '@/lib/kv'

function requireAuth(req: NextRequest): boolean {
  const token = req.cookies.get(COOKIE_NAME)?.value
  return token ? verifyToken(token) : false
}

const GUILD_ID  = () => process.env.DISCORD_GUILD_ID!
const BOT_TOKEN = () => process.env.DISCORD_BOT_TOKEN!
const SITE_URL  = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://brasil-role-br.com'

async function removeRole(discordId: string, roleId: string) {
  await fetch(
    `https://discord.com/api/v10/guilds/${GUILD_ID()}/members/${discordId}/roles/${roleId}`,
    { method: 'DELETE', headers: { Authorization: `Bot ${BOT_TOKEN()}` } }
  )
}

async function sendExpiredDM(discordId: string, expiresAt: string) {
  const [y, m, d] = expiresAt.split('-')
  const dateStr = `${d}/${m}/${y}`

  const dmRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
    method:  'POST',
    headers: { Authorization: `Bot ${BOT_TOKEN()}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ recipient_id: discordId }),
  })
  if (!dmRes.ok) return
  const { id: channelId } = await dmRes.json()

  const msg =
    `❌ **Seu VIP no Brasil Role BR expirou!**\n\n` +
    `Seu VIP venceu em **${dateStr}**. Caso queira renovar e continuar aproveitando todos os benefícios, é só falar com a gente aqui no Discord ou acessar o site!\n\n` +
    `🔗 ${SITE_URL}\n\n` +
    `Agradecemos muito pelo seu apoio! 🇧🇷`

  await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method:  'POST',
    headers: { Authorization: `Bot ${BOT_TOKEN()}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ content: msg }),
  })
}

export async function GET(req: NextRequest) {
  if (!requireAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const keys = await kvKeys('vip:*')

  // Busca membros do Discord para resolver nomes
  let memberMap = new Map<string, { username: string; globalName: string | null; nick: string | null }>()
  try {
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID()}/members?limit=1000`,
      { headers: { Authorization: `Bot ${BOT_TOKEN()}` } }
    )
    if (res.ok) {
      const members: any[] = await res.json()
      for (const m of members) {
        if (m.user?.id) {
          memberMap.set(m.user.id, {
            username:   m.user.username,
            globalName: m.user.global_name ?? null,
            nick:       m.nick ?? null,
          })
        }
      }
    }
  } catch {}

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const vips = (
    await Promise.all(
      keys.map(async (key) => {
        const discordId = key.replace('vip:', '')
        const raw = await kvGet(key)
        if (!raw) return null
        let entry: { expiresAt: string; roleId: string; tier?: number; vitalicio?: boolean }
        try { entry = JSON.parse(raw) } catch { return null }

        // Verifica se é assinante automático
        let assinante = false
        try {
          const subRaw = await kvGet(`sub:${discordId}`)
          if (subRaw) {
            const sub = JSON.parse(subRaw)
            assinante = sub.status === 'authorized' || sub.status === 'pending'
          }
        } catch {}

        // Vitalícios não expiram nunca
        if (entry.vitalicio) {
          const member = memberMap.get(discordId)
          return {
            discordId,
            username:     member?.username   ?? null,
            globalName:   member?.globalName ?? null,
            nick:         member?.nick       ?? null,
            expiresAt:    entry.expiresAt,
            diasRestantes: 99999,
            ativo:        true,
            tier:         entry.tier ?? 1,
            vitalicio:    true,
            assinante,
          }
        }

        const exp = new Date(entry.expiresAt)
        exp.setHours(0, 0, 0, 0)
        const diasRestantes = Math.ceil((exp.getTime() - today.getTime()) / 86_400_000)

        // VIP vencido: remove cargo, avisa e limpa do KV
        if (diasRestantes <= 0) {
          await removeRole(discordId, entry.roleId)
          await sendExpiredDM(discordId, entry.expiresAt)
          await kvDel(key)
          return null
        }

        const member = memberMap.get(discordId)
        return {
          discordId,
          username:       member?.username   ?? null,
          globalName:     member?.globalName ?? null,
          nick:           member?.nick       ?? null,
          expiresAt:      entry.expiresAt,
          diasRestantes,
          ativo:          true,
          tier:           entry.tier ?? 1,
          vitalicio:      false,
          assinante,
        }
      })
    )
  )
    .filter(Boolean)
    .sort((a, b) => a!.diasRestantes - b!.diasRestantes)

  return NextResponse.json(vips)
}
