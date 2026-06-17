import { cookies } from 'next/headers'
import ColecaoClient from './ColecaoClient'

export default async function ColecaoPage() {
  const cookieStore = await cookies()
  const raw = cookieStore.get('discord_user')?.value
  const user = raw ? JSON.parse(raw) : null
  return <ColecaoClient initialUser={user} />
}
