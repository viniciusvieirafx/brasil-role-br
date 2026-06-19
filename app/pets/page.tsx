import { cookies } from 'next/headers'
import PetHub from './PetHub'
import ClickerSidebars from './ClickerSidebars'
import { getVipTier } from '@/lib/getVipTier'

export default async function PetsPage() {
  const cookieStore = await cookies()
  const raw = cookieStore.get('discord_user')?.value
  const user = raw ? JSON.parse(raw) : null
  const vipTier: number = user ? await getVipTier(user.id) : 0

  return (
    <>
      <ClickerSidebars initialUser={user} />
      <PetHub initialUser={user} vipTier={vipTier} />
    </>
  )
}
