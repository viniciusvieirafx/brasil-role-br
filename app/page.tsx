import { cookies } from 'next/headers'
import { getUpdates } from '@/lib/get-updates'
import { isUserVerified } from '@/lib/discord'
import Navbar from '@/components/Navbar'
import Hero from '@/components/Hero'
import About from '@/components/About'
import Team from '@/components/Team'
import VerifiedGroups from '@/components/VerifiedGroups'
import VerifyVRChat from '@/components/VerifyVRChat'
import VIP from '@/components/VIP'
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

  const isVerified = discordUser ? await isUserVerified(discordUser.id) : false

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
      <Contact />
      <Footer />
    </main>
  )
}
