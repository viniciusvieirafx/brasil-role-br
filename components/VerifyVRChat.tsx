'use client'
import { useState, useEffect } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'

interface DiscordUser {
  id: string
  username: string
  globalName: string | null
}

type Step = 'login' | 'username' | 'code' | 'done' | 'alreadyVerified'

export default function VerifyVRChat({ initialUser, initialVerified }: { initialUser: DiscordUser | null; initialVerified: boolean }) {
  const { t } = useLanguage()
  const [step, setStep] = useState<Step>('login')
  const [vrchatUsername, setVrchatUsername] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!initialUser) return
    if (initialVerified) setStep('alreadyVerified')
    else setStep('username')
  }, [initialUser, initialVerified])

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

              <div className="bg-br-blue/10 border border-br-blue/20 rounded-xl p-4 text-sm text-gray-400">
                {t.verify.bioHint}
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

function DiscordIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 127.14 96.36" fill="currentColor">
      <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
    </svg>
  )
}
