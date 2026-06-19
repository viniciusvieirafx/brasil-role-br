import { cookies } from 'next/headers'
import MemoriaGame from './MemoriaGame'

export default async function MemoriaPage() {
  const cookieStore = await cookies()
  const raw = cookieStore.get('discord_user')?.value
  const user = raw ? JSON.parse(raw) : null
  return <MemoriaGame initialUser={user} />
}
