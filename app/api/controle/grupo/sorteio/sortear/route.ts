import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/grupoAuth'
import { getGrupo, saveGrupo, getGrupoSorteioAtivo, saveGrupoSorteio } from '@/lib/grupos'
import { executarSorteio, concederVip, notificarVencedores, anunciarVencedoresGrupo } from '@/lib/sorteio'

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const auth = verifyToken(token)
  if (!auth.valid || !auth.slug) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })

  const slug = auth.slug
  const [grupo, sorteio] = await Promise.all([
    getGrupo(slug),
    getGrupoSorteioAtivo(slug),
  ])

  if (!grupo) return NextResponse.json({ error: 'Grupo não encontrado' }, { status: 404 })
  if (!sorteio) return NextResponse.json({ error: 'Nenhum sorteio ativo' }, { status: 404 })
  if (sorteio.sorteado) return NextResponse.json({ error: 'Sorteio já encerrado' }, { status: 400 })
  if (sorteio.participantes.length === 0) return NextResponse.json({ error: 'Nenhum participante' }, { status: 400 })

  const vencedores = await executarSorteio({
    participantes: sorteio.participantes,
    numVencedores: sorteio.numVencedores,
    vipBonus: false,
  })

  sorteio.sorteado = true
  sorteio.vencedores = vencedores
  await saveGrupoSorteio(sorteio)

  // Conceder VIP para os vencedores
  await Promise.all(vencedores.map(v => concederVip(v.id, sorteio.premioDias)))

  // Descontar VIPs disponíveis do grupo
  grupo.vipsDisponiveis = Math.max(0, grupo.vipsDisponiveis - vencedores.length)
  await saveGrupo(grupo)

  // Notificar vencedores por DM
  try {
    await notificarVencedores(vencedores, 'vip', sorteio.premioDias)
  } catch (e) {
    console.error('[grupo/sortear] Falha ao notificar DMs:', e)
  }

  // Anunciar no canal do grupo + main server
  try {
    await anunciarVencedoresGrupo(grupo, sorteio, vencedores)
  } catch (e) {
    console.error('[grupo/sortear] Falha ao anunciar no Discord:', e)
  }

  return NextResponse.json({ ok: true, vencedores })
}
