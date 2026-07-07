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

  const { quantidade, tier } = await req.json()
  const qtd = Math.max(1, parseInt(quantidade) || 1)
  const t = [1, 2, 3].includes(tier) ? tier : 1

  grupo.vipsPorTier[t as 1 | 2 | 3] += qtd
  grupo.vipsDisponiveis = grupo.vipsPorTier[1] + grupo.vipsPorTier[2] + grupo.vipsPorTier[3]
  await saveGrupo(grupo)

  return NextResponse.json({ ok: true, vipsPorTier: grupo.vipsPorTier, vipsDisponiveis: grupo.vipsDisponiveis })
}
