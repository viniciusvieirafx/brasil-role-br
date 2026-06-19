import { cookies } from 'next/headers'
import ClickerGame from './ClickerGame'

export default async function ClickerPage() {
  const cookieStore = await cookies()
  const raw = cookieStore.get('discord_user')?.value
  const user = raw ? JSON.parse(raw) : null
  return <ClickerGame initialUser={user} />
}
