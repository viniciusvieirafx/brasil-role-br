import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/grupoAuth'
import {
  getGrupo, saveGrupo,
  getGrupoSorteioAtivo, saveGrupoSorteio,
  setGrupoSorteioAtivo, clearGrupoSorteioAtivo,
} from '@/lib/grupos'
import { anunciarSorteioGrupo } from '@/lib/sorteio'
import { randomUUID } from 'crypto'

async function getAuth(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) return null
  const auth = verifyToken(token)
  if (!auth.valid || !auth.slug) return null
  return auth.slug
}

export async function GET(req: NextRequest) {
  const slug = await getAuth(req)
  if (!slug) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const [grupo, sorteio] = await Promise.all([
    getGrupo(slug),
    getGrupoSorteioAtivo(slug),
  ])
  return NextResponse.json({ grupo, sorteio })
}

export async function POST(req: NextRequest) {
  const slug = await getAuth(req)
  if (!slug) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const grupo = await getGrupo(slug)
  if (!grupo) return NextResponse.json({ error: 'Grupo não encontrado' }, { status: 404 })

  if (grupo.vipsDisponiveis <= 0) {
    return NextResponse.json({ error: 'Sem VIPs disponíveis para criar sorteio' }, { status: 403 })
  }

  const existente = await getGrupoSorteioAtivo(slug)
  if (existente && !existente.sorteado) {
    return NextResponse.json({ error: 'Já existe um sorteio ativo' }, { status: 400 })
  }

  const body = await req.json()
  const { descricao, numVencedores, expiraEm } = body

  if (!descricao?.trim()) {
    return NextResponse.json({ error: 'Aviso/descrição obrigatório' }, { status: 400 })
  }

  const numV = Math.max(1, parseInt(numVencedores) || 1)
  const dias  = 30 // sempre 30 dias por vencedor

  if (numV > grupo.vipsDisponiveis) {
    return NextResponse.json(
      { error: `Você tem apenas ${grupo.vipsDisponiveis} VIP(s) disponível(is)` },
      { status: 400 }
    )
  }

  const id = randomUUID()
  const sorteio = {
    id,
    grupoSlug: slug,
    titulo: `Sorteio ${grupo.nome}`,
    descricao: descricao.trim(),
    expiraEm: expiraEm ?? null,
    numVencedores: numV,
    premioDias: dias,
    participantes: [] as string[],
    sorteado: false,
    vencedores: [] as { id: string; nome: string; colocacao: number }[],
    criadoEm: new Date().toISOString(),
  }

  await saveGrupoSorteio(sorteio)
  await setGrupoSorteioAtivo(slug, id)

  // Announce in group's Discord channel
  if (grupo.canalId) {
    try {
      await anunciarSorteioGrupo(grupo, sorteio)
    } catch (e) {
      console.error('[grupo/sorteio] Falha ao anunciar no Discord:', e)
    }
  }

  return NextResponse.json({ ok: true, id })
}

export async function PATCH(req: NextRequest) {
  const slug = await getAuth(req)
  if (!slug) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const sorteio = await getGrupoSorteioAtivo(slug)
  if (!sorteio) return NextResponse.json({ error: 'Nenhum sorteio ativo' }, { status: 404 })
  if (sorteio.sorteado) return NextResponse.json({ error: 'Sorteio já encerrado' }, { status: 400 })

  const body = await req.json()
  if (body.descricao !== undefined) sorteio.descricao = body.descricao
  if (body.numVencedores !== undefined) sorteio.numVencedores = Math.max(1, parseInt(body.numVencedores) || 1)
  if (body.expiraEm !== undefined) sorteio.expiraEm = body.expiraEm || null
  if (body.premioDias !== undefined) sorteio.premioDias = Math.max(1, parseInt(body.premioDias) || 30)

  await saveGrupoSorteio(sorteio)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const slug = await getAuth(req)
  if (!slug) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const sorteio = await getGrupoSorteioAtivo(slug)
  if (!sorteio) return NextResponse.json({ error: 'Nenhum sorteio ativo' }, { status: 404 })

  await clearGrupoSorteioAtivo(slug)
  return NextResponse.json({ ok: true })
}
