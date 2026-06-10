import { NextRequest, NextResponse } from 'next/server'
import { kvKeys, kvGet, kvDel, kvSet } from '@/lib/kv'
import { signOptOutToken } from '@/lib/vipToken'

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

type VipEntry = {
  expiresAt:    string
  roleId:       string
  ultimoAviso?: string   // YYYY-MM-DD do último lembrete enviado
  optOut?:      boolean  // usuário pediu para não receber mais lembretes
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today    = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]

  const keys    = await kvKeys('vip:*')
  const removed: string[] = []
  const warned:  string[] = []
  const kept:    string[] = []

  for (const key of keys) {
    const raw = await kvGet(key)
    if (!raw) { await kvDel(key); continue }

    let entry: VipEntry
    try { entry = JSON.parse(raw) } catch { await kvDel(key); continue }

    const expiresAt = new Date(entry.expiresAt)
    expiresAt.setHours(0, 0, 0, 0)

    const discordId = key.replace('vip:', '')

    if (expiresAt <= today) {
      // VIP expirado — remove cargo e avisa
      await removeRole(discordId, entry.roleId)
      const expiredMsg =
        `❌ **Seu VIP no Brasil Role BR expirou!**\n\n` +
        `Seu VIP venceu em **${formatDate(entry.expiresAt)}**. Caso queira renovar e continuar aproveitando todos os benefícios, é só falar com a gente aqui no Discord ou acessar o site!\n\n` +
        `🔗 ${SITE_URL}\n\n` +
        `Agradecemos muito pelo seu apoio! 🇧🇷`
      await sendDM(discordId, expiredMsg)
      await kvDel(key)
      removed.push(discordId)
      console.log(`[expire-vips] Removido: ${discordId} (venceu ${entry.expiresAt})`)
    } else {
      // VIP ainda ativo — verifica se deve enviar lembrete
      const diasRestantes = Math.ceil((expiresAt.getTime() - today.getTime()) / 86_400_000)

      if (diasRestantes <= 1 && !entry.optOut) {
        const diasDesdeUltimoAviso = entry.ultimoAviso
          ? Math.floor((today.getTime() - new Date(entry.ultimoAviso).getTime()) / 86_400_000)
          : Infinity

        if (diasDesdeUltimoAviso >= 5) {
          const optOutUrl =
            `${SITE_URL}/api/vip/optout?id=${discordId}&token=${signOptOutToken(discordId)}`

          const msg =
            `💛 **Olá! Obrigado por ser um apoiador do Brasil Role BR!**\n\n` +
            `Seu VIP vai expirar **amanhã** (${formatDate(entry.expiresAt)}). Caso queira continuar aproveitando todos os benefícios, basta renovar pelo site!\n\n` +
            `🔗 ${SITE_URL}\n\n` +
            `Agradecemos muito pelo seu apoio! Ele faz toda a diferença pra comunidade 🇧🇷\n\n` +
            `-# Não quer mais receber esses lembretes? ${optOutUrl}`

          await sendDM(discordId, msg)
          entry.ultimoAviso = todayStr
          await kvSet(key, JSON.stringify(entry))
          warned.push(discordId)
          console.log(`[expire-vips] Avisado: ${discordId} (vence ${entry.expiresAt})`)
        }
      }

      kept.push(key)
    }
  }

  console.log(`[expire-vips] Rodou em ${today.toISOString()} — removidos: ${removed.length}, avisados: ${warned.length}, ativos: ${kept.length}`)
  return NextResponse.json({ date: today.toISOString(), removed, warned, active: kept.length })
}
