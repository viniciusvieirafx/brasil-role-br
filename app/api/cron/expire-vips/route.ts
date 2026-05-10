import { NextRequest, NextResponse } from 'next/server'
import { kvKeys, kvGet, kvDel, kvSet } from '@/lib/kv'

const BOT_TOKEN = () => process.env.DISCORD_BOT_TOKEN!
const GUILD_ID  = () => process.env.DISCORD_GUILD_ID!
const SITE_URL  = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://brasil-role-br.com'

async function removeRole(discordId: string, roleId: string) {
  await fetch(
    `https://discord.com/api/v10/guilds/${GUILD_ID()}/members/${discordId}/roles/${roleId}`,
    { method: 'DELETE', headers: { Authorization: `Bot ${BOT_TOKEN()}` } }
  )
}

async function sendDM(discordId: string, message: string) {
  // Abre canal DM
  const dmRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
    method:  'POST',
    headers: { Authorization: `Bot ${BOT_TOKEN()}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ recipient_id: discordId }),
  })
  if (!dmRes.ok) return

  const { id: channelId } = await dmRes.json()

  await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method:  'POST',
    headers: { Authorization: `Bot ${BOT_TOKEN()}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ content: message }),
  })
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export async function GET(req: NextRequest) {
  // Vercel injeta Authorization: Bearer {CRON_SECRET} nas chamadas de cron
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today    = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const keys    = await kvKeys('vip:*')
  const removed: string[] = []
  const warned:  string[] = []
  const kept:    string[] = []

  for (const key of keys) {
    const raw = await kvGet(key)
    if (!raw) { await kvDel(key); continue }

    let entry: { expiresAt: string; roleId: string; avisado?: boolean }
    try { entry = JSON.parse(raw) } catch { await kvDel(key); continue }

    const expiresAt = new Date(entry.expiresAt)
    expiresAt.setHours(0, 0, 0, 0)

    const discordId = key.replace('vip:', '')

    if (expiresAt <= today) {
      await removeRole(discordId, entry.roleId)
      await kvDel(key)
      removed.push(discordId)
      console.log(`[expire-vips] Removido: ${discordId} (venceu ${entry.expiresAt})`)
    } else {
      // Avisa 1 dia antes se ainda não avisou
      if (expiresAt.getTime() === tomorrow.getTime() && !entry.avisado) {
        const msg =
          `💛 **Olá! Obrigado por ser um apoiador do Brasil Role BR!**\n\n` +
          `Seu VIP vai expirar **amanhã** (${formatDate(entry.expiresAt)}). Caso queira continuar aproveitando todos os benefícios, basta renovar pelo site!\n\n` +
          `🔗 ${SITE_URL}\n\n` +
          `Agradecemos muito pelo seu apoio! Ele faz toda a diferença pra comunidade 🇧🇷`

        await sendDM(discordId, msg)
        entry.avisado = true
        await kvSet(key, JSON.stringify(entry))
        warned.push(discordId)
        console.log(`[expire-vips] Avisado: ${discordId} (vence ${entry.expiresAt})`)
      }

      kept.push(key)
    }
  }

  console.log(`[expire-vips] Rodou em ${today.toISOString()} — removidos: ${removed.length}, avisados: ${warned.length}, ativos: ${kept.length}`)
  return NextResponse.json({ date: today.toISOString(), removed, warned, active: kept.length })
}
