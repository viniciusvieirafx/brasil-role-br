import { cookies } from 'next/headers'
import CapsulaPagina from './CapsulaPagina'

export default async function CapsulaPage() {
  const cookieStore = await cookies()
  const raw = cookieStore.get('discord_user')?.value
  const user = raw ? JSON.parse(raw) : null
  const vipTier: number = user?.vipTier ?? 0
  return <CapsulaPagina initialUser={user} vipTier={vipTier} />
}
