import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { getGrupo, getGrupoSorteioAtivo } from '@/lib/grupos'
import { isUserVerified } from '@/lib/discord'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import SorteioGrupo from '@/components/SorteioGrupo'
import { getUpdates } from '@/lib/get-updates'

export default async function SorteioGrupoPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const [grupo, cookieStore, updates] = await Promise.all([
    getGrupo(slug),
    cookies(),
    getUpdates(),
  ])

  if (!grupo || !grupo.ativo) notFound()

  const sorteioFull = await getGrupoSorteioAtivo(slug)

  const userCookie = cookieStore.get('discord_user')
  const discordUser = userCookie ? JSON.parse(userCookie.value) : null

  const [isVerified] = await Promise.all([
    discordUser ? isUserVerified(discordUser.id) : Promise.resolve(false),
  ])

  const participando = sorteioFull && discordUser
    ? sorteioFull.participantes.includes(discordUser.id)
    : false

  const publicSorteio = sorteioFull ? {
    id: sorteioFull.id,
    titulo: sorteioFull.titulo,
    descricao: sorteioFull.descricao,
    expiraEm: sorteioFull.expiraEm,
    numVencedores: sorteioFull.numVencedores,
    premioDias: sorteioFull.premioDias,
    totalParticipantes: sorteioFull.participantes.length,
    sorteado: sorteioFull.sorteado,
    vencedores: sorteioFull.vencedores,
    criadoEm: sorteioFull.criadoEm,
  } : null

  const latestVersion = updates[0]?.version ?? '1.0.0'

  return (
    <main>
      <Navbar latestVersion={latestVersion} />
      <SorteioGrupo
        grupo={{ slug: grupo.slug, nome: grupo.nome }}
        initialSorteio={publicSorteio}
        initialParticipando={participando}
        initialUser={discordUser}
        initialVerified={isVerified}
      />
      <Footer />
    </main>
  )
}
