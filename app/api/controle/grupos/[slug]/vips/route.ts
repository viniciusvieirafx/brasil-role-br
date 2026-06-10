import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/adminAuth'
import { getGrupo, saveGrupo } from '@/lib/grupos'

function isAdmin(req: NextRequest): boolean {
  const token = req.cookies.get(COOKIE_NAME)?.value
  return !!token && verifyToken(token)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { slug } = await params
  const grupo = await getGrupo(slug)
  if (!grupo) return NextResponse.json({ error: 'Grupo não encontrado' }, { status: 404 })

  const { quantidade } = await req.json()
  const qtd = Math.max(1, parseInt(quantidade) || 1)
  grupo.vipsDisponiveis += qtd
  await saveGrupo(grupo)

  return NextResponse.json({ ok: true, vipsDisponiveis: grupo.vipsDisponiveis })
}
