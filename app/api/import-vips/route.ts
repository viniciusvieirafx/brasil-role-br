import { NextRequest, NextResponse } from 'next/server'
import { kvSet } from '@/lib/kv'

// Importa o backup dos VIPs para o Redis
// Body: array de { id, vence, nick? }
// Exemplo: [{ "id": "385405521215094787", "vence": "2026-06-14" }, ...]

export async function POST(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key')
  if (!key || key !== process.env.VRC_LIST_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const roleId = process.env.DISCORD_VIP_ROLE_ID!
  const body: { id: string; vence: string; nick?: string }[] = await req.json()

  if (!Array.isArray(body)) {
    return NextResponse.json({ error: 'Body deve ser um array' }, { status: 400 })
  }

  const results: { id: string; status: string }[] = []

  for (const entry of body) {
    if (!entry.id || !entry.vence) {
      results.push({ id: entry.id ?? '?', status: 'ignorado (sem id ou vence)' })
      continue
    }

    await kvSet(`vip:${entry.id}`, JSON.stringify({
      expiresAt: entry.vence,
      roleId,
    }))

    results.push({ id: entry.id, status: 'importado' })
  }

  console.log(`[import-vips] ${results.length} entradas processadas`)
  return NextResponse.json({ imported: results.length, results })
}
