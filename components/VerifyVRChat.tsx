'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/contexts/LanguageContext'

interface DiscordUser {
  id: string
  username: string
  globalName: string | null
}

type Step = 'login' | 'username' | 'code' | 'done' | 'alreadyVerified'

export default function VerifyVRChat({ initialUser, initialVerified }: { initialUser: DiscordUser | null; initialVerified: boolean }) {
  const { t } = useLanguage()
  const router = useRouter()
  const [step, setStep] = useState<Step>('login')
  const [vrchatUsername, setVrchatUsername] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const [autoChecking, setAutoChecking] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!initialUser) return
    if (initialVerified) setStep('alreadyVerified')
    else setStep('username')
  }, [initialUser, initialVerified])

  // Auto-polling every 5 seconds when on the code step
  useEffect(() => {
    if (step !== 'code') {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    const check = async () => {
      setAutoChecking(true)
      try {
        const res = await fetch('/api/verify/check', { method: 'POST' })
        const data = await res.json()
        if (data.verified) {
          if (intervalRef.current) clearInterval(intervalRef.current)
          setStep('done')
          router.refresh()
          setTimeout(() => {
            document.getElementById('vip')?.scrollIntoView({ behavior: 'smooth' })
          }, 800)
        }
      } catch {
        // silent — will retry on next interval
      }
      setAutoChecking(false)
    }

    // First check after 5s, then every 5s
    intervalRef.current = setInterval(check, 5000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [step, router])

  const handleStart = async () => {
    if (!vrchatUsername.trim()) return
    setLoading(true)
    setErrorMsg('')
    const res = await fetch('/api/verify/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vrchatUsername: vrchatUsername.trim() }),
    })
    const data = await res.json()
    if (data.code) {
      setCode(data.code)
      setStep('code')
    } else {
      setErrorMsg(data.error ?? t.verify.errorGenDefault)
    }
    setLoading(false)
  }

  const handleCheck = async () => {
    setLoading(true)
    setErrorMsg('')
    const res = await fetch('/api/verify/check', { method: 'POST' })
    const data = await res.json()
    if (data.verified) {
      setStep('done')
      router.refresh()
      setTimeout(() => {
        document.getElementById('vip')?.scrollIntoView({ behavior: 'smooth' })
      }, 800)
    } else {
      setErrorMsg(data.error ?? t.verify.errorDefault)
    }
    setLoading(false)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section id="verificar" className="py-24 bg-br-dark2">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="text-white">{t.verify.titleA}</span>{' '}
            <span className="text-br-green">{t.verify.titleB}</span>
          </h2>
          <p className="text-gray-400">{t.verify.subtitle}</p>
        </div>

        <div className="max-w-md mx-auto bg-br-purple/50 rounded-2xl p-8 border border-white/10">

          {step === 'login' && (
            <div className="text-center space-y-6">
              <div className="text-5xl">🔐</div>
              <h3 className="text-xl font-bold">{t.verify.loginTitle}</h3>
              <p className="text-gray-400 text-sm">{t.verify.loginDesc}</p>
              <a
                href="/api/auth/discord?from=verificar"
                className="inline-flex items-center gap-3 bg-[#5865F2] text-white font-bold px-8 py-4 rounded-xl hover:brightness-110 transition-all"
              >
                <DiscordIcon />
                {t.verify.loginBtn}
              </a>
            </div>
          )}

          {step === 'username' && (
            <div className="space-y-5">
              <div className="text-center">
                <div className="text-5xl mb-3">🎮</div>
                <h3 className="text-xl font-bold">{t.verify.usernameTitle}</h3>
                <p className="text-gray-400 text-sm mt-1">{t.verify.usernameDesc}</p>
              </div>
              <input
                type="text"
                value={vrchatUsername}
                onChange={e => setVrchatUsername(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleStart()}
                placeholder={t.verify.usernamePlaceholder}
                className="w-full bg-br-dark border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-br-green transition-colors"
              />
              {errorMsg && <p className="text-red-400 text-sm text-center">{errorMsg}</p>}
              <button
                onClick={handleStart}
                disabled={loading || !vrchatUsername.trim()}
                className="w-full bg-br-green text-white font-bold py-4 rounded-xl hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? t.verify.generating : t.verify.generateBtn}
              </button>
            </div>
          )}

          {step === 'code' && (
            <div className="space-y-5">
              <div className="text-center">
                <div className="text-5xl mb-3">📋</div>
                <h3 className="text-xl font-bold">{t.verify.bioTitle}</h3>
                <p className="text-gray-400 text-sm mt-1">{t.verify.bioDesc}</p>
              </div>

              <div className="bg-br-dark rounded-xl p-5 text-center border border-br-green/30">
                <span className="text-2xl font-bold text-br-green tracking-widest">{code}</span>
              </div>

              <button
                onClick={handleCopy}
                className="w-full border border-br-green/40 text-br-green py-3 rounded-xl hover:bg-br-green/10 transition-all"
              >
                {copied ? t.verify.copied : t.verify.copyBtn}
              </button>

              {/* Link direto para o perfil do VRChat */}
              <a
                href="https://vrchat.com/home/user"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center border border-[#1DB5D4]/40 text-[#1DB5D4] py-3 rounded-xl hover:bg-[#1DB5D4]/10 transition-all"
              >
                {t.verify.openVRChat}
              </a>

              {/* Ilustração tutorial */}
              <VRChatTutorial
                step1={t.verify.tutorialStep1}
                step2={t.verify.tutorialStep2}
                step3={t.verify.tutorialStep3}
                code={code}
              />

              {/* Auto-check indicator */}
              <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                <span className={`inline-block w-2 h-2 rounded-full ${autoChecking ? 'bg-br-yellow animate-pulse' : 'bg-br-green animate-pulse'}`} />
                {t.verify.autoCheckMsg}
              </div>

              {errorMsg && (
                <p className="text-red-400 text-sm text-center">{errorMsg}</p>
              )}

              <button
                onClick={handleCheck}
                disabled={loading}
                className="w-full bg-br-yellow text-br-dark font-bold py-4 rounded-xl hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? t.verify.verifying : t.verify.verifyBtn}
              </button>

              <button
                onClick={() => { setStep('username'); setErrorMsg('') }}
                className="w-full text-gray-500 text-sm hover:text-gray-300 transition-colors"
              >
                {t.verify.changeUser}
              </button>
            </div>
          )}

          {step === 'done' && (
            <div className="text-center space-y-5">
              <div className="text-7xl">✅</div>
              <h3 className="text-3xl font-bold text-br-green">{t.verify.doneTitle}</h3>
              <p className="text-gray-300">
                {t.verify.doneDesc_before}
                <strong className="text-white">{t.verify.doneDesc_bold}</strong>
                {t.verify.doneDesc_after}
              </p>
              <p className="text-gray-500 text-sm">{t.verify.doneHint}</p>
            </div>
          )}

          {step === 'alreadyVerified' && (
            <div className="text-center space-y-5">
              <div className="text-7xl">✅</div>
              <h3 className="text-3xl font-bold text-br-green">{t.verify.alreadyTitle}</h3>
              <p className="text-gray-300">{t.verify.alreadyDesc}</p>
              <a
                href="#vip"
                className="inline-block bg-br-yellow text-br-dark font-bold px-6 py-3 rounded-xl hover:brightness-110 transition-all"
              >
                {t.verify.alreadyVipBtn}
              </a>
            </div>
          )}

        </div>
      </div>
    </section>
  )
}

/* ──────────────────────────────────────────
   Ilustração SVG do perfil VRChat
   Mostra onde clicar (Edit Profile) e onde colar o código (About Me)
   ────────────────────────────────────────── */
function VRChatTutorial({ step1, step2, step3, code }: { step1: string; step2: string; step3: string; code: string }) {
  return (
    <div className="rounded-xl overflow-hidden border border-white/10">
      <svg viewBox="0 0 400 310" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
        {/* Background */}
        <rect width="400" height="310" fill="#1a1a2e" />

        {/* Banner area */}
        <rect x="0" y="0" width="400" height="70" fill="#2a2a4a" />
        <rect x="0" y="0" width="400" height="70" fill="url(#bannerGrad)" opacity="0.5" />

        {/* Avatar circle */}
        <circle cx="70" cy="70" r="32" fill="#2d2d4d" stroke="#1a1a2e" strokeWidth="4" />
        <circle cx="70" cy="70" r="18" fill="#3d3d5d" />
        <circle cx="63" cy="65" r="3" fill="#6a6a8a" />
        <circle cx="77" cy="65" r="3" fill="#6a6a8a" />
        <path d="M63 76 Q70 82 77 76" stroke="#6a6a8a" strokeWidth="2" fill="none" strokeLinecap="round" />

        {/* Username */}
        <text x="115" y="88" fill="white" fontSize="14" fontWeight="bold" fontFamily="Arial, sans-serif">MeuPerfil</text>
        <rect x="185" y="77" width="32" height="14" rx="7" fill="#1DB5D4" opacity="0.3" />
        <text x="191" y="88" fill="#1DB5D4" fontSize="8" fontFamily="Arial, sans-serif">VRC+</text>

        {/* ── STEP 1: Edit Profile Button ── */}
        <rect x="115" y="100" width="200" height="32" rx="6" fill="#1DB5D4" />
        <text x="215" y="120" fill="white" fontSize="11" fontWeight="bold" fontFamily="Arial, sans-serif" textAnchor="middle">Edit Profile</text>

        {/* Seta e label do Step 1 */}
        <path d="M340 116 L325 116" stroke="#FF6B6B" strokeWidth="2.5" markerEnd="url(#arrowRed)" />
        <rect x="342" y="104" width="55" height="24" rx="4" fill="#FF6B6B" opacity="0.15" />
        <text x="369" y="119" fill="#FF6B6B" fontSize="7.5" fontWeight="bold" fontFamily="Arial, sans-serif" textAnchor="middle">{step1.replace(/^\d+\.\s*/, '')}</text>

        {/* ── STEP 2: About Me section ── */}
        <rect x="20" y="150" width="360" height="90" rx="8" fill="#22223a" stroke="#333355" strokeWidth="1" />
        <text x="35" y="172" fill="#888" fontSize="10" fontWeight="bold" fontFamily="Arial, sans-serif" letterSpacing="1">ABOUT ME</text>

        {/* Linhas de texto na bio + código */}
        <rect x="35" y="180" width="120" height="8" rx="4" fill="#444466" />
        <rect x="35" y="194" width="80" height="8" rx="4" fill="#444466" />

        {/* Código destacado */}
        <rect x="35" y="212" width="140" height="18" rx="4" fill="#009B3A" opacity="0.2" stroke="#009B3A" strokeWidth="1" strokeDasharray="3 2" />
        <text x="105" y="224" fill="#00D44B" fontSize="10" fontWeight="bold" fontFamily="monospace" textAnchor="middle">{code}</text>

        {/* Seta e label do Step 2 */}
        <path d="M340 220 L185 220" stroke="#00D44B" strokeWidth="2.5" markerEnd="url(#arrowGreen)" />
        <rect x="342" y="208" width="55" height="24" rx="4" fill="#00D44B" opacity="0.15" />
        <text x="369" y="223" fill="#00D44B" fontSize="7.5" fontWeight="bold" fontFamily="Arial, sans-serif" textAnchor="middle">{step2.replace(/^\d+\.\s*/, '')}</text>

        {/* ── STEP 3: Save indicator ── */}
        <rect x="115" y="260" width="170" height="30" rx="6" fill="#009B3A" opacity="0.7" />
        <text x="200" y="279" fill="white" fontSize="11" fontWeight="bold" fontFamily="Arial, sans-serif" textAnchor="middle">Save Changes</text>

        {/* Step 3 label */}
        <rect x="20" y="268" width="80" height="18" rx="4" fill="#FFD700" opacity="0.15" />
        <text x="60" y="280" fill="#FFD700" fontSize="8" fontWeight="bold" fontFamily="Arial, sans-serif" textAnchor="middle">{step3}</text>

        {/* Defs */}
        <defs>
          <linearGradient id="bannerGrad" x1="0" y1="0" x2="400" y2="70">
            <stop offset="0%" stopColor="#1DB5D4" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#6B3FA0" stopOpacity="0.3" />
          </linearGradient>
          <marker id="arrowRed" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8" fill="#FF6B6B" />
          </marker>
          <marker id="arrowGreen" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8" fill="#00D44B" />
          </marker>
        </defs>
      </svg>
    </div>
  )
}

function DiscordIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 127.14 96.36" fill="currentColor">
      <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
    </svg>
  )
}
