import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/adminAuth'
import { listGrupos, getGrupo, saveGrupo, addGrupoToList, hashSenha } from '@/lib/grupos'

function isAdmin(req: NextRequest): boolean {
  const token = req.cookies.get(COOKIE_NAME)?.value
  return !!token && verifyToken(token)
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const grupos = await listGrupos()
  return NextResponse.json(grupos)
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { nome, slug, senha } = await req.json()
  if (!nome?.trim() || !slug?.trim() || !senha?.trim()) {
    return NextResponse.json({ error: 'Nome, slug e senha são obrigatórios' }, { status: 400 })
  }

  const slugClean = slug.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const existing = await getGrupo(slugClean)
  if (existing) return NextResponse.json({ error: 'Slug já em uso' }, { status: 400 })

  const grupo = {
    slug: slugClean,
    nome: nome.trim(),
    senhaHash: hashSenha(senha),
    canalId: null,
    ativo: true,
    vipsDisponiveis: 0,
  }

  await saveGrupo(grupo)
  await addGrupoToList(slugClean)

  return NextResponse.json({ ok: true, slug: slugClean })
}
