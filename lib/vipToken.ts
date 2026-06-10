import { createHmac } from 'crypto'

function secret() {
  return process.env.ADMIN_SECRET ?? process.env.ADMIN_PASSWORD ?? ''
}

export function signOptOutToken(discordId: string): string {
  return createHmac('sha256', secret()).update(`vip-optout:${discordId}`).digest('hex')
}

export function verifyOptOutToken(discordId: string, token: string): boolean {
  const expected = signOptOutToken(discordId)
  if (expected.length !== token.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i)
  return diff === 0
}
