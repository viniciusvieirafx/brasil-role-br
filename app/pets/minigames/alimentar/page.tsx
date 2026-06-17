import { cookies } from 'next/headers'
import AlimentarGame from './AlimentarGame'

export default async function AlimentarPage() {
  const cookieStore = await cookies()
  const raw = cookieStore.get('discord_user')?.value
  const user = raw ? JSON.parse(raw) : null
  return <AlimentarGame initialUser={user} />
}
