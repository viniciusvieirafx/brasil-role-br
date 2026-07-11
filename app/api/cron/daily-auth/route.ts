import { NextRequest, NextResponse } from 'next/server'

const SECRET_KEY = [7, 3, 9, 1]
const DISCORD_CHANNEL_ID = '1525275092278579303'
const GITHUB_REPO = 'viniciusvieirafx/brasilsao-banners'
const GITHUB_FILE = 'daily_auth.txt'

function encodeCode(code: number, seed: number): number[] {
  const digits = code.toString().padStart(4, '0').split('').map(Number)
  return digits.map((d, i) => {
    const k = SECRET_KEY[i]
    const offset = ((k * (seed % 97)) + (seed % 53) + k) % 10
    return (d + offset) % 10
  })
}

function todayBRT(): Date {
  return new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })
  )
}

function formatDateBR(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0')
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const y = date.getFullYear()
  return `${d}/${m}/${y}`
}

function formatDateISO(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

async function updateGitHub(content: string, commitDate: string) {
  const token = process.env.GITHUB_TOKEN
  if (!token) throw new Error('GITHUB_TOKEN not configured')

  const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE}`
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  }

  // Get current file SHA (may not exist yet)
  let sha: string | undefined
  const getRes = await fetch(apiUrl, { headers })
  if (getRes.ok) {
    const data = await getRes.json()
    sha = data.sha
  }

  // PUT the new content
  const body: Record<string, string> = {
    message: `auth: codigo diario ${commitDate}`,
    content: Buffer.from(content).toString('base64'),
  }
  if (sha) body.sha = sha

  const putRes = await fetch(apiUrl, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  })

  if (!putRes.ok) {
    const err = await putRes.text()
    throw new Error(`GitHub PUT failed (${putRes.status}): ${err}`)
  }
}

async function deleteOldMessages() {
  const botToken = process.env.DISCORD_BOT_TOKEN
  if (!botToken) throw new Error('DISCORD_BOT_TOKEN not configured')

  const headers = {
    Authorization: `Bot ${botToken}`,
    'Content-Type': 'application/json',
  }

  // Get bot's own user ID
  const meRes = await fetch('https://discord.com/api/v10/users/@me', { headers })
  if (!meRes.ok) throw new Error('Failed to fetch bot user')
  const me = await meRes.json()
  const botId = me.id

  // Fetch recent messages in the channel
  const msgsRes = await fetch(
    `https://discord.com/api/v10/channels/${DISCORD_CHANNEL_ID}/messages?limit=50`,
    { headers }
  )
  if (!msgsRes.ok) return

  const messages = await msgsRes.json()

  // Delete all messages from this bot
  for (const msg of messages) {
    if (msg.author.id === botId) {
      await fetch(
        `https://discord.com/api/v10/channels/${DISCORD_CHANNEL_ID}/messages/${msg.id}`,
        { method: 'DELETE', headers }
      )
    }
  }
}

async function postDiscordMessage(code: string, dateBR: string) {
  const botToken = process.env.DISCORD_BOT_TOKEN
  if (!botToken) throw new Error('DISCORD_BOT_TOKEN not configured')

  const content =
    `🔐 **Código de Acesso do Dia — ${dateBR}**\n\n` +
    `\`\`\`\n${code}\n\`\`\`\n\n` +
    `_Este código muda todo dia às 9h. Não compartilhe com terceiros._`

  const res = await fetch(
    `https://discord.com/api/v10/channels/${DISCORD_CHANNEL_ID}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content }),
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Discord POST failed (${res.status}): ${err}`)
  }
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = todayBRT()
  const dateBR = formatDateBR(now)
  const dateISO = formatDateISO(now)

  // Generate random 4-digit code (0000-9999)
  const code = Math.floor(Math.random() * 10000)
  const codeStr = code.toString().padStart(4, '0')

  // Generate random 5-digit seed (10000-99999)
  const seed = Math.floor(Math.random() * 90000) + 10000

  // Encode the code
  const encoded = encodeCode(code, seed)

  // Build file content (exact format: 3 lines, no trailing spaces)
  const fileContent = `v1\nSEED:${seed}\nCODE:${encoded.join('|')}`

  try {
    // 1. Update GitHub
    await updateGitHub(fileContent, dateISO)
    console.log(`[daily-auth] GitHub updated: seed=${seed}, encoded=${encoded.join('|')}`)

    // 2. Delete old bot messages
    await deleteOldMessages()
    console.log(`[daily-auth] Old messages deleted`)

    // 3. Post new code in Discord
    await postDiscordMessage(codeStr, dateBR)
    console.log(`[daily-auth] Discord message posted: code=${codeStr}`)

    return NextResponse.json({
      date: dateISO,
      code: codeStr,
      seed,
      encoded: encoded.join('|'),
    })
  } catch (err) {
    console.error(`[daily-auth] Error:`, err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
