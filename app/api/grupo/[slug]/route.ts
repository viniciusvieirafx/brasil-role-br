import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getGrupo, getGrupoSorteioAtivo } from '@/lib/grupos'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const [grupo, sorteio] = await Promise.all([
    getGrupo(slug),
    getGrupoSorteioAtivo(slug),
  ])

  if (!grupo || !grupo.ativo) {
    return NextResponse.json({ error: 'Grupo não encontrado' }, { status: 404 })
  }

  if (!sorteio) {
    return NextResponse.json({ grupo: { slug: grupo.slug, nome: grupo.nome }, sorteio: null })
  }

  const cookieStore = await cookies()
  const userCookie = cookieStore.get('discord_user')
  const user = userCookie ? JSON.parse(userCookie.value) : null
  const participando = user ? sorteio.participantes.includes(user.id) : false

  const publicSorteio = {
    id: sorteio.id,
    titulo: sorteio.titulo,
    descricao: sorteio.descricao,
    expiraEm: sorteio.expiraEm,
    numVencedores: sorteio.numVencedores,
    premioDias: sorteio.premioDias,
    totalParticipantes: sorteio.participantes.length,
    sorteado: sorteio.sorteado,
    vencedores: sorteio.vencedores,
    criadoEm: sorteio.criadoEm,
  }

  return NextResponse.json({
    grupo: { slug: grupo.slug, nome: grupo.nome },
    sorteio: publicSorteio,
    participando,
  })
}
