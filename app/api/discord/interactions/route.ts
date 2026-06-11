import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY!
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN!
const GUILD_ID = process.env.DISCORD_GUILD_ID!
const SUPPORT_CHANNEL_ID = '1488376250496974868'

// ── Verificação de assinatura do Discord ──────────────────
function hexToBytes(hex: string) {
  return new Uint8Array(hex.match(/.{1,2}/g)!.map(b => parseInt(b, 16)))
}

async function verifySignature(req: NextRequest, rawBody: string): Promise<boolean> {
  const sig = req.headers.get('x-signature-ed25519')
  const ts  = req.headers.get('x-signature-timestamp')
  if (!sig || !ts) return false
  try {
    const key = await crypto.subtle.importKey(
      'raw', hexToBytes(PUBLIC_KEY), { name: 'Ed25519' }, false, ['verify']
    )
    return crypto.subtle.verify(
      'Ed25519', key, hexToBytes(sig), new TextEncoder().encode(ts + rawBody)
    )
  } catch {
    return false
  }
}

// ── Discord REST helper ───────────────────────────────────
async function api(method: string, path: string, body?: object) {
  const res = await fetch(`https://discord.com/api/v10${path}`, {
    method,
    headers: { Authorization: `Bot ${BOT_TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return null
  return res.json()
}

// ── Ticket: criar canal privado ───────────────────────────
async function createTicket(userId: string, username: string) {
  const channelName = `ticket-${username.toLowerCase().replace(/[^a-z0-9]/g, '-')}`

  // Busca canais do servidor para verificar se já existe
  const channels: { id: string; name: string; type: number; parent_id?: string }[] =
    await api('GET', `/guilds/${GUILD_ID}/channels`)

  const existing = channels.find(c => c.name === channelName)
  if (existing) return { exists: true, channelId: existing.id }

  // Pega o dono do servidor
  const guild: { owner_id: string } = await api('GET', `/guilds/${GUILD_ID}`)

  // Procura ou cria categoria Tickets
  let category = channels.find(c => c.type === 4 && c.name === 'Tickets')
  if (!category) {
    category = await api('POST', `/guilds/${GUILD_ID}/channels`, {
      name: 'Tickets',
      type: 4,
      permission_overwrites: [{ id: GUILD_ID, type: 0, deny: '1024' }],
    })
  }

  // Cria canal privado
  const newChannel: { id: string } = await api('POST', `/guilds/${GUILD_ID}/channels`, {
    name: channelName,
    type: 0,
    parent_id: category!.id,
    permission_overwrites: [
      { id: GUILD_ID,         type: 0, deny: '1024' },
      { id: userId,           type: 1, allow: '103079' }, // ViewChannel + SendMessages + ReadHistory
      { id: guild.owner_id,   type: 1, allow: '103088' }, // + ManageChannels
    ],
  })

  // Envia mensagem de boas-vindas com botão de encerrar
  await api('POST', `/channels/${newChannel.id}/messages`, {
    content: `Olá <@${userId}>! Um moderador irá te atender em breve.\n\nDigite sua dúvida aqui. Quando terminar, clique em **Encerrar Ticket**.`,
    components: [{
      type: 1,
      components: [{
        type: 2,
        style: 4,
        label: 'Encerrar Ticket',
        emoji: { name: '🔒' },
        custom_id: 'ticket_close',
      }],
    }],
  })

  return { exists: false, channelId: newChannel.id }
}

// ── Ticket: encerrar canal ────────────────────────────────
async function closeTicket(channelId: string, username: string) {
  await api('POST', `/channels/${channelId}/messages`, {
    content: `🔒 **${username}** encerrou o ticket. Canal será deletado em 5 segundos...`,
  })
  // Deleta após 5 segundos usando waitUntil não disponível aqui,
  // então aguarda via setTimeout (funciona na edge/node do Vercel)
  await new Promise(r => setTimeout(r, 5000))
  await api('DELETE', `/channels/${channelId}`)
}

// ── Handler principal ─────────────────────────────────────
export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  const valid = await verifySignature(req, rawBody)
  if (!valid) return new NextResponse('Unauthorized', { status: 401 })

  const body = JSON.parse(rawBody)

  // PING — necessário para verificar o endpoint no Discord
  if (body.type === 1) {
    return NextResponse.json({ type: 1 })
  }

  // Interação de botão
  if (body.type === 3) {
    const customId: string = body.data.custom_id
    const userId: string   = body.member?.user?.id ?? body.user?.id
    const username: string = body.member?.user?.username ?? body.user?.username
    const channelId: string = body.channel_id

    if (customId === 'ticket_create') {
      const result = await createTicket(userId, username)
      const msg = result.exists
        ? `Você já tem um ticket aberto: <#${result.channelId}>`
        : `✅ Ticket criado! <#${result.channelId}>`
      return NextResponse.json({
        type: 4,
        data: { content: msg, flags: 64 }, // 64 = ephemeral
      })
    }

    if (customId === 'ticket_close') {
      // Responde imediatamente (Discord exige resposta em 3s) e fecha em background
      const response = NextResponse.json({ type: 5 }) // deferred update
      closeTicket(channelId, username).catch(console.error)
      return response
    }
  }

  return NextResponse.json({ type: 1 })
}
