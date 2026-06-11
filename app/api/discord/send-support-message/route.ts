import { NextRequest, NextResponse } from 'next/server'

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN!
const SUPPORT_CHANNEL_ID = '1488376250496974868'

export async function POST(req: NextRequest) {
  const { password } = await req.json()
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const res = await fetch(`https://discord.com/api/v10/channels/${SUPPORT_CHANNEL_ID}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      embeds: [{
        title: '🎫 Suporte',
        description: 'Se tiver dúvida ou precisar de ajuda, clique no botão abaixo e abra um ticket para iniciar o atendimento.',
        color: 0x5865f2,
      }],
      components: [{
        type: 1,
        components: [{
          type: 2,
          style: 1,
          label: 'Iniciar',
          emoji: { name: '🎫' },
          custom_id: 'ticket_create',
        }],
      }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: err }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
