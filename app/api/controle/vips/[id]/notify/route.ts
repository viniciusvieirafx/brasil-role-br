import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/adminAuth'
import { kvGet } from '@/lib/kv'
import { signOptOutToken } from '@/lib/vipToken'

const BOT_TOKEN = () => process.env.DISCORD_BOT_TOKEN!
const SITE_URL  = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://brasil-role-br.com'

function requireAuth(req: NextRequest): boolean {
  const token = req.cookies.get(COOKIE_NAME)?.value
  return token ? verifyToken(token) : false
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

async function sendDM(discordId: string, message: string): Promise<boolean> {
  const dmRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
    method:  'POST',
    headers: { Authorization: `Bot ${BOT_TOKEN()}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ recipient_id: discordId }),
  })
  if (!dmRes.ok) return false

  const { id: channelId } = await dmRes.json()
  const msgRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method:  'POST',
    headers: { Authorization: `Bot ${BOT_TOKEN()}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ content: message }),
  })
  return msgRes.ok
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!requireAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: discordId } = await params
  const raw = await kvGet(`vip:${discordId}`)
  if (!raw) {
    return NextResponse.json({ error: 'VIP não encontrado' }, { status: 404 })
  }

  const entry: { expiresAt: string; roleId: string; optOut?: boolean } = JSON.parse(raw)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiresAt = new Date(entry.expiresAt)
  expiresAt.setHours(0, 0, 0, 0)
  const expired = expiresAt <= today

  const optOutUrl =
    `${SITE_URL}/api/vip/optout?id=${discordId}&token=${signOptOutToken(discordId)}`

  const msg = expired
    ? `❌ **Seu VIP no Brasil Role BR expirou!**\n\n` +
      `Seu VIP venceu em **${formatDate(entry.expiresAt)}**. Caso queira continuar aproveitando todos os benefícios, basta renovar pelo site!\n\n` +
      `🔗 ${SITE_URL}\n\n` +
      `Agradecemos muito pelo seu apoio! 🇧🇷`
    : `💛 **Olá! Obrigado por ser um apoiador do Brasil Role BR!**\n\n` +
      `Seu VIP vai expirar em **${formatDate(entry.expiresAt)}**. Caso queira continuar aproveitando todos os benefícios, basta renovar pelo site!\n\n` +
      `🔗 ${SITE_URL}\n\n` +
      `Agradecemos muito pelo seu apoio! Ele faz toda a diferença pra comunidade 🇧🇷\n\n` +
      `-# Não quer mais receber esses lembretes? ${optOutUrl}`

  const ok = await sendDM(discordId, msg)
  if (!ok) {
    return NextResponse.json({ error: 'Falha ao enviar DM' }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}
