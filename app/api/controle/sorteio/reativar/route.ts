import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/adminAuth'
import { kvGet, kvSet } from '@/lib/kv'

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

  if (!sorteio.sorteado) {
    return NextResponse.json({ error: 'Sorteio ainda não foi sorteado' }, { status: 400 })
  }

  const { expiraEm } = await req.json()

  sorteio.sorteado = false
  sorteio.vencedores = []
  if (expiraEm) {
    const match = String(expiraEm).match(/^(\d{4}-\d{2}-\d{2})/)
    if (match) sorteio.expiraEm = match[1]
  }

  await kvSet(`sorteio:${aId}`, JSON.stringify(sorteio))

  return NextResponse.json({ ok: true, msg: 'Sorteio reativado com sucesso' })
}
