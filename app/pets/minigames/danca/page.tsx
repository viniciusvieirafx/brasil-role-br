import { cookies } from 'next/headers'
import DancaGame from './DancaGame'

export default async function DancaPage() {
  const cookieStore = await cookies()
  const raw = cookieStore.get('discord_user')?.value
  const user = raw ? JSON.parse(raw) : null
  return <DancaGame initialUser={user} />
}
