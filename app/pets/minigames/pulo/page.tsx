import { cookies } from 'next/headers'
import PuloGame from './PuloGame'

export default async function PuloPage() {
  const cookieStore = await cookies()
  const raw = cookieStore.get('discord_user')?.value
  const user = raw ? JSON.parse(raw) : null
  return <PuloGame initialUser={user} />
}
