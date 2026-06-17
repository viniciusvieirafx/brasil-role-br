import { cookies } from 'next/headers'
import BatalhaClient from './BatalhaClient'

export default async function BatalhaPage() {
  const cookieStore = await cookies()
  const raw = cookieStore.get('discord_user')?.value
  const user = raw ? JSON.parse(raw) : null
  return <BatalhaClient initialUser={user} />
}
