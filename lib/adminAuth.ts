import { createHmac } from 'crypto'

const COOKIE_NAME = 'ctrl_session'
const MAX_AGE_MS  = 8 * 60 * 60 * 1000 // 8 horas

function secret() {
  const s = process.env.ADMIN_SECRET ?? process.env.ADMIN_PASSWORD
  if (!s) throw new Error('ADMIN_SECRET ou ADMIN_PASSWORD não definido')
  return s
}

export function signToken(): string {
  const payload = Buffer.from(JSON.stringify({ iat: Date.now() })).toString('base64url')
  const sig = createHmac('sha256', secret()).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export function verifyToken(token: string): boolean {
  const dot = token.lastIndexOf('.')
  if (dot < 0) return false
  const payload = token.slice(0, dot)
  const sig     = token.slice(dot + 1)
  const expected = createHmac('sha256', secret()).update(payload).digest('base64url')
  if (expected.length !== sig.length) return false
  // comparação em tempo constante
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i)
  if (diff !== 0) return false
  try {
    const { iat } = JSON.parse(Buffer.from(payload, 'base64url').toString())
    return Date.now() - iat < MAX_AGE_MS
  } catch {
    return false
  }
}

// Rate limiter em memória (reseta no redeploy — suficiente para esse uso)
const attempts = new Map<string, { count: number; resetAt: number }>()
const MAX_ATTEMPTS = 5
const WINDOW_MS    = 15 * 60 * 1000

export function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now   = Date.now()
  const entry = attempts.get(ip)
  if (!entry || entry.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true }
  }
  if (entry.count >= MAX_ATTEMPTS) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) }
  }
  entry.count++
  return { allowed: true }
}

export function clearRateLimit(ip: string) {
  attempts.delete(ip)
}

export { COOKIE_NAME }
