import { cookies } from 'next/headers'
import CapsulaPagina from './CapsulaPagina'
import { getVipTier } from '@/lib/getVipTier'

export default async function CapsulaPage() {
  const cookieStore = await cookies()
  const raw = cookieStore.get('discord_user')?.value
  const user = raw ? JSON.parse(raw) : null
  const vipTier: number = user ? await getVipTier(user.id) : 0
  return <CapsulaPagina initialUser={user} vipTier={vipTier} />
}
