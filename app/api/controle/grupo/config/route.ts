import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/grupoAuth'
import { getGrupo, saveGrupo } from '@/lib/grupos'

export async function PATCH(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const auth = verifyToken(token)
  if (!auth.valid || !auth.slug) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })

  const grupo = await getGrupo(auth.slug)
  if (!grupo) return NextResponse.json({ error: 'Grupo não encontrado' }, { status: 404 })

  const body = await req.json()
  if (typeof body.canalId === 'string') grupo.canalId = body.canalId.trim() || null

  await saveGrupo(grupo)
  return NextResponse.json({ ok: true })
}
