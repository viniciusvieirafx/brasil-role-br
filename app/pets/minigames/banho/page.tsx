import { cookies } from 'next/headers'
import BanhoGame from './BanhoGame'

export default async function BanhoPage() {
  const cookieStore = await cookies()
  const raw = cookieStore.get('discord_user')?.value
  const user = raw ? JSON.parse(raw) : null
  return <BanhoGame initialUser={user} />
}
