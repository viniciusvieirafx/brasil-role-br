import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { kvGet, kvSet } from '@/lib/kv'
import { isUserVerified } from '@/lib/discord'

export async function POST(_req: NextRequest) {
  const cookieStore = await cookies()
  const userCookie = cookieStore.get('discord_user')
  if (!userCookie) return NextResponse.json({ error: 'Login necessário' }, { status: 401 })

  const user = JSON.parse(userCookie.value)

  const verified = await isUserVerified(user.id)
  if (!verified) return NextResponse.json({ error: 'Verificação VRChat necessária' }, { status: 403 })

  const aId = await kvGet('sorteio:ativo')
  if (!aId) return NextResponse.json({ error: 'Nenhum sorteio ativo' }, { status: 404 })

  const raw = await kvGet(`sorteio:${aId}`)
  if (!raw) return NextResponse.json({ error: 'Sorteio não encontrado' }, { status: 404 })

  const sorteio = JSON.parse(raw)

  if (sorteio.sorteado) return NextResponse.json({ error: 'Sorteio já encerrado' }, { status: 400 })

  if (sorteio.participantes.includes(user.id)) {
    return NextResponse.json({ error: 'Você já está participando' }, { status: 400 })
  }

  sorteio.participantes.push(user.id)
  await kvSet(`sorteio:${aId}`, JSON.stringify(sorteio))

  return NextResponse.json({ ok: true, total: sorteio.participantes.length })
}
