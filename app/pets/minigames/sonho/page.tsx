import { cookies } from 'next/headers'
import SonhoGame from './SonhoGame'

export default async function SonhoPage() {
  const cookieStore = await cookies()
  const raw = cookieStore.get('discord_user')?.value
  const user = raw ? JSON.parse(raw) : null
  return <SonhoGame initialUser={user} />
}
