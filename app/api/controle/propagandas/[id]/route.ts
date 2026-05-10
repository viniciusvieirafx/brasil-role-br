import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/adminAuth'
import { kvDel } from '@/lib/kv'

function isAuthed(req: NextRequest): boolean {
  const token = req.cookies.get(COOKIE_NAME)?.value
  return !!token && verifyToken(token)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await kvDel(`propaganda:${id}`)
  return NextResponse.json({ ok: true })
}
