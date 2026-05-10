import { NextRequest, NextResponse } from 'next/server'
import { kvKeys, kvGet, kvSet } from '@/lib/kv'
import type { Propaganda } from '@/app/api/controle/propagandas/route'

const BOT_TOKEN      = () => process.env.DISCORD_BOT_TOKEN!
const NOTIFY_CHANNEL = '1480918950404423835'

const CONTATO_LABEL: Record<string, string> = {
  discord:   '🎮 Discord',
  instagram: '📷 Instagram',
  tiktok:    '🎵 TikTok',
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

async function sendDiscordMessage(content: string) {
  await fetch(`https://discord.com/api/v10/channels/${NOTIFY_CHANNEL}/messages`, {
    method:  'POST',
    headers: {
      Authorization:  `Bot ${BOT_TOKEN()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content }),
  })
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]

  const keys = await kvKeys('propaganda:*')
  const notified: string[] = []

  for (const key of keys) {
    const raw = await kvGet(key)
    if (!raw) continue

    let p: Propaganda
    try { p = JSON.parse(raw) } catch { continue }

    if (p.notificado) continue

    const expira = new Date(p.expiraEm)
    expira.setHours(0, 0, 0, 0)

    if (expira > today) continue

    const diasAtraso = Math.round((today.getTime() - expira.getTime()) / 86400000)
    const atrasoTxt  = diasAtraso === 0
      ? 'expirou **hoje**'
      : `expirou há **${diasAtraso} dia${diasAtraso > 1 ? 's' : ''}**`

    const msg =
      `⚠️ **Propaganda expirada!**\n\n` +
      `📢 O anúncio de **${p.comprador}** ${atrasoTxt}.\n\n` +
      `📅 Comprado em: **${formatDate(p.compradoEm)}**\n` +
      `📅 Expirou em: **${formatDate(p.expiraEm)}**\n` +
      `${CONTATO_LABEL[p.contatoVia] ?? p.contatoVia}\n\n` +
      `Renova ou remove o anúncio no painel /controle.`

    await sendDiscordMessage(msg)

    p.notificado = true
    await kvSet(key, JSON.stringify(p))
    notified.push(p.comprador)
    console.log(`[expire-propagandas] Notificado: ${p.comprador} (${p.expiraEm})`)
  }

  console.log(`[expire-propagandas] ${todayStr} — notificados: ${notified.length}`)
  return NextResponse.json({ date: todayStr, notified })
}
