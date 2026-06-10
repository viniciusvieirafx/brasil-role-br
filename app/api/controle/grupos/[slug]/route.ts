import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/adminAuth'
import { getGrupo, saveGrupo, removeGrupoFromList } from '@/lib/grupos'
import { kvDel } from '@/lib/kv'

function isAdmin(req: NextRequest): boolean {
  const token = req.cookies.get(COOKIE_NAME)?.value
  return !!token && verifyToken(token)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { slug } = await params
  const grupo = await getGrupo(slug)
  if (!grupo) return NextResponse.json({ error: 'Grupo não encontrado' }, { status: 404 })

  const body = await req.json()
  if (typeof body.ativo === 'boolean') grupo.ativo = body.ativo
  if (typeof body.canalId === 'string') grupo.canalId = body.canalId || null

  await saveGrupo(grupo)
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { slug } = await params
  await kvDel(`grupo:${slug}`)
  await removeGrupoFromList(slug)
  return NextResponse.json({ ok: true })
}
