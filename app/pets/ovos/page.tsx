import { cookies } from 'next/headers'
import OvosClient from './OvosClient'

export default async function OvosPage() {
  const cookieStore = await cookies()
  const raw = cookieStore.get('discord_user')?.value
  const user = raw ? JSON.parse(raw) : null
  return <OvosClient initialUser={user} />
}
