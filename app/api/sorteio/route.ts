import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { kvGet } from '@/lib/kv'

export async function GET(_req: NextRequest) {
  const aId = await kvGet('sorteio:ativo')
  if (!aId) return NextResponse.json({ sorteio: null, participando: false })

  const raw = await kvGet(`sorteio:${aId}`)
  if (!raw) return NextResponse.json({ sorteio: null, participando: false })

  const sorteio = JSON.parse(raw)

  const cookieStore = await cookies()
  const userCookie = cookieStore.get('discord_user')
  const user = userCookie ? JSON.parse(userCookie.value) : null
  const participando = user ? sorteio.participantes.includes(user.id) : false

  return NextResponse.json({
    sorteio: {
      id: sorteio.id,
      titulo: sorteio.titulo,
      descricao: sorteio.descricao,
      expiraEm: sorteio.expiraEm,
      vipBonus: sorteio.vipBonus,
      vipMultiplier: sorteio.vipMultiplier,
      numVencedores: sorteio.numVencedores ?? 1,
      modoResultado: sorteio.modoResultado ?? 'igual',
      totalParticipantes: sorteio.participantes.length,
      sorteado: sorteio.sorteado,
      vencedores: sorteio.vencedores ?? [],
      criadoEm: sorteio.criadoEm,
    },
    participando,
  })
}
