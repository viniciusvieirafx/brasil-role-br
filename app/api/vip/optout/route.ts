import { NextRequest, NextResponse } from 'next/server'
import { kvGet, kvSet } from '@/lib/kv'
import { verifyOptOutToken } from '@/lib/vipToken'

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://brasil-role-br.com'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id    = searchParams.get('id') ?? ''
  const token = searchParams.get('token') ?? ''

  if (!id || !verifyOptOutToken(id, token)) {
    return NextResponse.redirect(`${SITE_URL}/vip/optout?status=invalid`)
  }

  const raw = await kvGet(`vip:${id}`)
  if (raw) {
    const entry = JSON.parse(raw)
    if (!entry.optOut) {
      entry.optOut = true
      await kvSet(`vip:${id}`, JSON.stringify(entry))
    }
  }

  return NextResponse.redirect(`${SITE_URL}/vip/optout?status=ok`)
}
