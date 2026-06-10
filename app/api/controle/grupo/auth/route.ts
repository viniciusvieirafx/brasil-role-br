import { NextRequest, NextResponse } from 'next/server'
import { signToken, verifyToken, COOKIE_NAME } from '@/lib/grupoAuth'
import { getGrupo, hashSenha } from '@/lib/grupos'

export async function POST(req: NextRequest) {
  const { slug, senha } = await req.json()
  if (!slug || !senha) {
    return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
  }

  const grupo = await getGrupo(slug)
  if (!grupo || !grupo.ativo) {
    return NextResponse.json({ error: 'Grupo não encontrado' }, { status: 401 })
  }

  if (grupo.senhaHash !== hashSenha(senha)) {
    return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 })
  }

  const token = signToken(slug)
  const res = NextResponse.json({ ok: true, slug, nome: grupo.nome })
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge:   8 * 60 * 60,
    path:     '/',
  })
  return res
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) return NextResponse.json({ authenticated: false })
  const result = verifyToken(token)
  if (!result.valid || !result.slug) return NextResponse.json({ authenticated: false })
  const grupo = await getGrupo(result.slug)
  return NextResponse.json({ authenticated: true, slug: result.slug, nome: grupo?.nome })
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete(COOKIE_NAME)
  return res
}
