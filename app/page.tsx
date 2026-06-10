import { cookies } from 'next/headers'
import { getUpdates } from '@/lib/get-updates'
import { isUserVerified } from '@/lib/discord'
import { kvGet } from '@/lib/kv'
import Navbar from '@/components/Navbar'
import Hero from '@/components/Hero'
import About from '@/components/About'
import Team from '@/components/Team'
import VerifiedGroups from '@/components/VerifiedGroups'
import VerifyVRChat from '@/components/VerifyVRChat'
import VIP from '@/components/VIP'
import Sorteio from '@/components/Sorteio'
import Gallery from '@/components/Gallery'
import PatchNotes from '@/components/PatchNotes'
import Contact from '@/components/Contact'
import Footer from '@/components/Footer'

export default async function Home() {
  const [cookieStore, updates] = await Promise.all([
    cookies(),
    getUpdates(),
  ])

  const discordUserCookie = cookieStore.get('discord_user')
  const discordUser = discordUserCookie
    ? JSON.parse(discordUserCookie.value)
    : null

  const [isVerified, aId] = await Promise.all([
    discordUser ? isUserVerified(discordUser.id) : Promise.resolve(false),
    kvGet('sorteio:ativo'),
  ])

  // Fetch sorteio data in parallel with nothing blocking it — only if an active sorteio exists
  const sorteioRaw = aId ? await kvGet(`sorteio:${aId}`) : null
  const sorteioFull = sorteioRaw ? JSON.parse(sorteioRaw) : null
  const publicSorteio = sorteioFull ? {
    id: sorteioFull.id,
    titulo: sorteioFull.titulo,
    descricao: sorteioFull.descricao,
    expiraEm: sorteioFull.expiraEm,
    vipBonus: sorteioFull.vipBonus,
    vipMultiplier: sorteioFull.vipMultiplier,
    numVencedores: sorteioFull.numVencedores ?? 1,
    modoResultado: sorteioFull.modoResultado ?? 'igual',
    totalParticipantes: sorteioFull.participantes.length,
    sorteado: sorteioFull.sorteado,
    vencedores: sorteioFull.vencedores ?? [],
    criadoEm: sorteioFull.criadoEm,
  } : null
  const participando = sorteioFull && discordUser
    ? sorteioFull.participantes.includes(discordUser.id)
    : false

  const latestVersion = updates[0]?.version ?? '1.0.0'

  return (
    <main>
      <Navbar latestVersion={latestVersion} />
      <Hero />
      <About />
      <Gallery />
      <Team />
      <VerifiedGroups />
      <PatchNotes updates={updates} latestVersion={latestVersion} />
      <VerifyVRChat initialUser={discordUser} initialVerified={isVerified} />
      <VIP initialUser={discordUser} initialVerified={isVerified} />
      <Sorteio
        initialSorteio={publicSorteio}
        initialParticipando={participando}
        initialUser={discordUser}
        initialVerified={isVerified}
      />
      <Contact />
      <Footer />
    </main>
  )
}
