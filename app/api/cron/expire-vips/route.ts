import { NextRequest, NextResponse } from 'next/server'
import { kvKeys, kvGet, kvDel } from '@/lib/kv'

const BOT_TOKEN = () => process.env.DISCORD_BOT_TOKEN!
const GUILD_ID  = () => process.env.DISCORD_GUILD_ID!

async function removeRole(discordId: string, roleId: string) {
  await fetch(
    `https://discord.com/api/v10/guilds/${GUILD_ID()}/members/${discordId}/roles/${roleId}`,
    { method: 'DELETE', headers: { Authorization: `Bot ${BOT_TOKEN()}` } }
  )
}

export async function GET(req: NextRequest) {
  // Vercel injeta Authorization: Bearer {CRON_SECRET} nas chamadas de cron
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const keys = await kvKeys('vip:*')
  const removed: string[] = []
  const kept: string[] = []

  for (const key of keys) {
    const raw = await kvGet(key)
    if (!raw) { await kvDel(key); continue }

    let entry: { expiresAt: string; roleId: string }
    try { entry = JSON.parse(raw) } catch { await kvDel(key); continue }

    const expiresAt = new Date(entry.expiresAt)
    expiresAt.setHours(0, 0, 0, 0)

    if (expiresAt <= today) {
      const discordId = key.replace('vip:', '')
      await removeRole(discordId, entry.roleId)
      await kvDel(key)
      removed.push(discordId)
      console.log(`[expire-vips] Removido: ${discordId} (venceu ${entry.expiresAt})`)
    } else {
      kept.push(key)
    }
  }

  console.log(`[expire-vips] Rodou em ${today.toISOString()} — removidos: ${removed.length}, ativos: ${kept.length}`)
  return NextResponse.json({ date: today.toISOString(), removed, active: kept.length })
}
