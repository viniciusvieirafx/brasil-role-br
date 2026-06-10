import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/adminAuth'
import { kvGet, kvSet, kvDel } from '@/lib/kv'
import { randomUUID } from 'crypto'

const SORTEIO_CHANNEL = '1480918957937397760'

function auth(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  return token ? verifyToken(token) : false
}

async function anunciarCriacao(
  titulo: string,
  descricao: string,
  expiraEm: string | null,
  vipBonus: boolean,
  vipMultiplier: number,
  numVencedores: number,
  modoResultado: 'igual' | 'colocacao',
) {
  const fields: { name: string; value: string; inline: boolean }[] = []

  if (descricao) fields.push({ name: '📋 Descrição', value: descricao, inline: false })
  if (numVencedores > 1) {
    const modoLabel = modoResultado === 'colocacao' ? ' (com colocação)' : ''
    fields.push({ name: '🏆 Ganhadores', value: `**${numVencedores}** pessoas vão ganhar${modoLabel}!`, inline: true })
  }
  if (vipBonus) fields.push({ name: '👑 Bônus VIP', value: `VIPs têm **${vipMultiplier}×** mais chances de ganhar!`, inline: true })
  if (expiraEm) {
    const [y, m, d] = expiraEm.split('-')
    fields.push({ name: '📅 Encerra em', value: `${d}/${m}/${y}`, inline: true })
  }
  fields.push({ name: '🌐 Como participar', value: 'Acesse **[brasil-role-br.com](https://brasil-role-br.com/#sorteio)** e clique em Participar!', inline: false })

  await fetch(`https://discord.com/api/v10/channels/${SORTEIO_CHANNEL}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content: '🎲 **Novo sorteio aberto! Corre lá para participar!** 🎲',
      embeds: [{
        title: `🎁 ${titulo}`,
        color: 0x1A8F1A,
        fields,
        footer: { text: 'Brasil Role BR · Sorteio da Comunidade' },
        timestamp: new Date().toISOString(),
      }],
    }),
  })
}

export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const aId = await kvGet('sorteio:ativo')
  if (!aId) return NextResponse.json({ sorteio: null })

  const raw = await kvGet(`sorteio:${aId}`)
  if (!raw) return NextResponse.json({ sorteio: null })

  const sorteio = JSON.parse(raw)
  const today = new Date().toISOString().split('T')[0]

  const participantesInfo = await Promise.all(
    sorteio.participantes.map(async (id: string) => {
      const vipRaw = await kvGet(`vip:${id}`)
      const isVip = vipRaw ? JSON.parse(vipRaw).expiresAt >= today : false
      return { id, isVip }
    })
  )

  return NextResponse.json({ sorteio: { ...sorteio, participantesInfo } })
}

export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const existing = await kvGet('sorteio:ativo')
  if (existing) return NextResponse.json({ error: 'Já existe um sorteio ativo. Encerre-o antes de criar um novo.' }, { status: 400 })

  const { titulo, descricao, expiraEm, vipBonus, vipMultiplier, numVencedores, modoResultado, premio, premioDias } = await req.json()
  if (!titulo?.trim()) return NextResponse.json({ error: 'Título obrigatório' }, { status: 400 })

  const id = randomUUID()
  const sorteio = {
    id,
    titulo: titulo.trim(),
    descricao: descricao?.trim() ?? '',
    expiraEm: expiraEm || null,
    vipBonus: vipBonus ?? false,
    vipMultiplier: vipMultiplier ?? 3,
    numVencedores: Math.max(1, numVencedores ?? 1),
    modoResultado: (modoResultado === 'colocacao' ? 'colocacao' : 'igual') as 'igual' | 'colocacao',
    premio: (premio === 'vip' ? 'vip' : null) as 'vip' | null,
    premioDias: Math.max(1, premioDias ?? 30),
    participantes: [] as string[],
    criadoEm: new Date().toISOString(),
    sorteado: false,
    vencedores: [] as { id: string; nome: string; colocacao: number }[],
  }

  await kvSet(`sorteio:${id}`, JSON.stringify(sorteio))
  await kvSet('sorteio:ativo', id)

  try {
    await anunciarCriacao(sorteio.titulo, sorteio.descricao, sorteio.expiraEm, sorteio.vipBonus, sorteio.vipMultiplier, sorteio.numVencedores, sorteio.modoResultado)
  } catch (e) {
    console.error('[sorteio] Falha ao anunciar criação no Discord:', e)
  }

  return NextResponse.json({ ok: true, id })
}

export async function PATCH(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const aId = await kvGet('sorteio:ativo')
  if (!aId) return NextResponse.json({ error: 'Nenhum sorteio ativo' }, { status: 404 })

  const raw = await kvGet(`sorteio:${aId}`)
  if (!raw) return NextResponse.json({ error: 'Sorteio não encontrado' }, { status: 404 })

  const sorteio = JSON.parse(raw)
  if (sorteio.sorteado) return NextResponse.json({ error: 'Não é possível editar um sorteio já sorteado' }, { status: 400 })

  const { titulo, descricao, expiraEm, vipBonus, vipMultiplier, numVencedores, modoResultado, premio, premioDias } = await req.json()
  if (titulo !== undefined) sorteio.titulo = titulo.trim()
  if (descricao !== undefined) sorteio.descricao = descricao.trim()
  if (expiraEm !== undefined) sorteio.expiraEm = expiraEm || null
  if (vipBonus !== undefined) sorteio.vipBonus = vipBonus
  if (vipMultiplier !== undefined) sorteio.vipMultiplier = vipMultiplier
  if (numVencedores !== undefined) sorteio.numVencedores = Math.max(1, numVencedores)
  if (modoResultado !== undefined) sorteio.modoResultado = modoResultado
  if (premio !== undefined) sorteio.premio = premio === 'vip' ? 'vip' : null
  if (premioDias !== undefined) sorteio.premioDias = Math.max(1, premioDias)

  await kvSet(`sorteio:${aId}`, JSON.stringify(sorteio))
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const aId = await kvGet('sorteio:ativo')
  if (!aId) return NextResponse.json({ ok: true })

  await kvDel(`sorteio:${aId}`)
  await kvDel('sorteio:ativo')

  return NextResponse.json({ ok: true })
}
