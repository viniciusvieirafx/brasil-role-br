import { cookies } from 'next/headers'
import PescaGame from './PescaGame'

export default async function PescaPage() {
  const cookieStore = await cookies()
  const raw = cookieStore.get('discord_user')?.value
  const user = raw ? JSON.parse(raw) : null
  return <PescaGame initialUser={user} />
}
