import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/adminAuth'
import { kvKeys, kvGet, kvSet } from '@/lib/kv'

export type Propaganda = {
  id: string
  comprador: string
  compradoEm: string
  expiraEm: string
  contatoVia: 'discord' | 'instagram' | 'tiktok'
  imagemThumb: string | null
  notificado: boolean
}

function isAuthed(req: NextRequest): boolean {
  const token = req.cookies.get(COOKIE_NAME)?.value
  return !!token && verifyToken(token)
}

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const keys = await kvKeys('propaganda:*')
  const items: Propaganda[] = []

  for (const key of keys) {
    const raw = await kvGet(key)
    if (!raw) continue
    try { items.push(JSON.parse(raw)) } catch {}
  }

  items.sort((a, b) => a.expiraEm.localeCompare(b.expiraEm))
  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { comprador, compradoEm, expiraEm, contatoVia, imagemThumb } = body

  if (!comprador?.trim() || !compradoEm || !expiraEm || !contatoVia) {
    return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
  }

  const id = crypto.randomUUID()
  const propaganda: Propaganda = {
    id,
    comprador: comprador.trim(),
    compradoEm,
    expiraEm,
    contatoVia,
    imagemThumb: imagemThumb ?? null,
    notificado: false,
  }

  await kvSet(`propaganda:${id}`, JSON.stringify(propaganda))
  return NextResponse.json(propaganda, { status: 201 })
}
