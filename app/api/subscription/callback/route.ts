import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? searchParams.get('preapproval_status') ?? 'unknown'

  const host = req.headers.get('host') ?? 'brasil-role-br.com'
  const baseUrl = `https://${host}`

  // Redireciona de volta pro site com o status da assinatura
  if (status === 'authorized' || status === 'approved') {
    return NextResponse.redirect(`${baseUrl}/?sub=success#vip`)
  }

  if (status === 'pending') {
    return NextResponse.redirect(`${baseUrl}/?sub=pending#vip`)
  }

  // cancelled, paused, ou erro
  return NextResponse.redirect(`${baseUrl}/?sub=error#vip`)
}
