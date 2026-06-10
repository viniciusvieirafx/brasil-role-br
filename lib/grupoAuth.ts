import { createHmac } from 'crypto'

const COOKIE_NAME = 'grupo_session'
const MAX_AGE_MS  = 8 * 60 * 60 * 1000

function secret() {
  const s = process.env.ADMIN_SECRET ?? process.env.ADMIN_PASSWORD
  if (!s) throw new Error('ADMIN_SECRET não definido')
  return s
}

export function signToken(slug: string): string {
  const payload = Buffer.from(JSON.stringify({ slug, iat: Date.now() })).toString('base64url')
  const sig = createHmac('sha256', secret()).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export function verifyToken(token: string): { valid: boolean; slug?: string } {
  const dot = token.lastIndexOf('.')
  if (dot < 0) return { valid: false }
  const payload = token.slice(0, dot)
  const sig     = token.slice(dot + 1)
  const expected = createHmac('sha256', secret()).update(payload).digest('base64url')
  if (expected.length !== sig.length) return { valid: false }
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i)
  if (diff !== 0) return { valid: false }
  try {
    const { slug, iat } = JSON.parse(Buffer.from(payload, 'base64url').toString())
    if (Date.now() - iat >= MAX_AGE_MS) return { valid: false }
    return { valid: true, slug }
  } catch {
    return { valid: false }
  }
}

export { COOKIE_NAME }
