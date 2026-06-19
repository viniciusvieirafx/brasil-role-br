import { cookies } from 'next/headers'
import TreinoGame from './TreinoGame'

export default async function TreinoPage() {
  const cookieStore = await cookies()
  const raw = cookieStore.get('discord_user')?.value
  const user = raw ? JSON.parse(raw) : null
  return <TreinoGame initialUser={user} />
}
