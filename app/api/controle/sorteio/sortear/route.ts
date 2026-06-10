import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/adminAuth'
import { kvGet, kvSet } from '@/lib/kv'
import { executarSorteio, anunciarVencedores, concederVip, notificarVencedores } from '@/lib/sorteio'

function auth(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  return token ? verifyToken(token) : false
}

export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const aId = await kvGet('sorteio:ativo')
  if (!aId) return NextResponse.json({ error: 'Nenhum sorteio ativo' }, { status: 404 })

  const raw = await kvGet(`sorteio:${aId}`)
  if (!raw) return NextResponse.json({ error: 'Sorteio não encontrado' }, { status: 404 })

  const sorteio = JSON.parse(raw)

  if (sorteio.participantes.length === 0) {
    return NextResponse.json({ error: 'Nenhum participante no sorteio' }, { status: 400 })
  }

  if (sorteio.sorteado) {
    return NextResponse.json({ error: 'Já sorteado', vencedores: sorteio.vencedores }, { status: 400 })
  }

  const vencedores = await executarSorteio(sorteio)

  sorteio.sorteado = true
  sorteio.vencedores = vencedores
  await kvSet(`sorteio:${aId}`, JSON.stringify(sorteio))

  const modoResultado: 'igual' | 'colocacao' = sorteio.modoResultado ?? 'igual'
  const premio: string | null = sorteio.premio ?? null
  const premioDias: number = sorteio.premioDias ?? 30

  if (premio === 'vip') {
    await Promise.all(vencedores.map(v => concederVip(v.id, premioDias)))
  }

  try {
    await notificarVencedores(vencedores, premio, premioDias)
  } catch (e) {
    console.error('[sortear] Falha ao notificar vencedores por DM:', e)
  }

  try {
    await anunciarVencedores(
      sorteio.titulo,
      sorteio.descricao,
      vencedores,
      sorteio.participantes.length,
      sorteio.vipBonus,
      sorteio.vipMultiplier,
      modoResultado,
      premio,
      premioDias,
    )
  } catch (e) {
    console.error('[sortear] Falha ao enviar mensagem no Discord:', e)
  }

  return NextResponse.json({ ok: true, vencedores })
}
