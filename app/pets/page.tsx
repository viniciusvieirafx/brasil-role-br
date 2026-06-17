import { cookies } from 'next/headers'
import PetHub from './PetHub'

export default async function PetsPage() {
  const cookieStore = await cookies()
  const raw = cookieStore.get('discord_user')?.value
  const user = raw ? JSON.parse(raw) : null

  return <PetHub initialUser={user} />
}
