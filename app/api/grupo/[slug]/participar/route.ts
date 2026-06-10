import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getGrupo, getGrupoSorteioAtivo, saveGrupoSorteio } from '@/lib/grupos'
import { isUserVerified } from '@/lib/discord'
import { notificarParticipanteGrupo } from '@/lib/sorteio'
import { fetchNome } from '@/lib/sorteio'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const cookieStore = await cookies()
  const userCookie = cookieStore.get('discord_user')
  if (!userCookie) return NextResponse.json({ error: 'Login necessário' }, { status: 401 })

  const user = JSON.parse(userCookie.value)

  const verified = await isUserVerified(user.id)
  if (!verified) return NextResponse.json({ error: 'Verificação VRChat necessária' }, { status: 403 })

  const [grupo, sorteio] = await Promise.all([
    getGrupo(slug),
    getGrupoSorteioAtivo(slug),
  ])

  if (!grupo || !grupo.ativo) return NextResponse.json({ error: 'Grupo não encontrado' }, { status: 404 })
  if (!sorteio) return NextResponse.json({ error: 'Nenhum sorteio ativo' }, { status: 404 })
  if (sorteio.sorteado) return NextResponse.json({ error: 'Sorteio já encerrado' }, { status: 400 })
  if (sorteio.participantes.includes(user.id)) {
    return NextResponse.json({ error: 'Você já está participando' }, { status: 400 })
  }

  sorteio.participantes.push(user.id)
  await saveGrupoSorteio(sorteio)

  // Notificar no Discord (canal do grupo + main server)
  try {
    const nome = await fetchNome(user.id)
    await notificarParticipanteGrupo(grupo, nome, sorteio.participantes.length)
  } catch (e) {
    console.error('[grupo/participar] Falha ao notificar Discord:', e)
  }

  return NextResponse.json({ ok: true, total: sorteio.participantes.length })
}
