'use client'
import { useState, useEffect, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useLanguage } from '@/contexts/LanguageContext'

interface DiscordUser {
  id: string
  username: string
  avatar: string | null
  globalName: string | null
}

type Step = 'login' | 'needsVerify' | 'pay' | 'waiting' | 'paid'

const benefitIcons = ['✨', '🪙', '🏆', '👑', '💬', '🎁']

function pickInitialStep(user: DiscordUser | null, verified: boolean): Step {
  if (!user) return 'login'
  if (!verified) return 'needsVerify'
  return 'pay'
}

export default function VIP({ initialUser, initialVerified }: { initialUser: DiscordUser | null; initialVerified: boolean }) {
  const { t } = useLanguage()
  const [step, setStep] = useState<Step>(pickInitialStep(initialUser, initialVerified))
  const [pixData, setPixData] = useState<{ qrCode: string; paymentId: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (step !== 'waiting' || !pixData) return

    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/check-payment?id=${pixData.paymentId}`)
      const data = await res.json()
      if (data.status === 'approved') {
        setStep('paid')
        clearInterval(pollRef.current!)
      }
    }, 3000)

    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [step, pixData])

  const handleCreatePayment = async () => {
    setLoading(true)
    const res = await fetch('/api/create-payment', { method: 'POST' })
    const data = await res.json()
    if (res.status === 403 && data.code === 'NOT_VERIFIED') {
      setStep('needsVerify')
      setLoading(false)
      return
    }
    setPixData({ qrCode: data.qrCode, paymentId: data.paymentId })
    setStep('waiting')
    setLoading(false)
  }

  const handleCopy = () => {
    if (!pixData?.qrCode) return
    navigator.clipboard.writeText(pixData.qrCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const avatarUrl = initialUser?.avatar
    ? `https://cdn.discordapp.com/avatars/${initialUser.id}/${initialUser.avatar}.png`
    : null

  return (
    <section id="vip" className="py-24 bg-br-dark2">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-14">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="text-br-yellow">{t.vip.titleA}</span>{' '}
            <span className="text-white">{t.vip.titleB}</span>
          </h2>
          <p className="text-gray-400 text-lg">{t.vip.subtitle}</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 items-start">
          {/* Benefits card */}
          <div className="bg-br-purple/50 rounded-2xl p-8 border border-br-yellow/20">
            <div className="text-center mb-8">
              <div className="text-6xl font-bold text-br-yellow">{t.vip.price}</div>
              <div className="text-gray-400 mt-1">{t.vip.priceDesc}</div>
            </div>
            <ul className="space-y-4">
              {t.vip.benefits.map((benefit, i) => (
                <li key={i} className="flex items-center gap-3 text-gray-200">
                  <span className="text-xl">{benefitIcons[i]}</span>
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 p-4 bg-br-blue/10 border border-br-blue/30 rounded-xl text-sm text-gray-400">
              {t.vip.durationNote_before}
              <strong className="text-white">30</strong>
              {t.vip.durationNote_after}
            </div>
          </div>

          {/* Payment widget */}
          <div className="bg-br-purple/50 rounded-2xl p-8 border border-br-blue/20 min-h-[400px] flex items-center justify-center">
            {step === 'login' && (
              <div className="text-center space-y-6 w-full">
                <div className="text-5xl">🔐</div>
                <h3 className="text-2xl font-bold">{t.vip.loginTitle}</h3>
                <div className="text-left space-y-3">
                  <div className="flex items-start gap-3 bg-br-purple/60 border border-white/10 rounded-xl px-4 py-3">
                    <span className="text-br-yellow font-bold text-lg mt-0.5">1</span>
                    <div>
                      <p className="text-white font-semibold text-sm">{t.vip.step1Title}</p>
                      <p className="text-gray-400 text-xs mt-0.5">{t.vip.step1Desc}</p>
                      <a
                        href={process.env.NEXT_PUBLIC_DISCORD_INVITE}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[#5865F2] text-xs font-bold mt-1 hover:underline"
                      >
                        <DiscordIcon className="w-3 h-3" /> {t.vip.step1Link}
                      </a>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 bg-br-purple/60 border border-white/10 rounded-xl px-4 py-3">
                    <span className="text-br-yellow font-bold text-lg mt-0.5">2</span>
                    <div>
                      <p className="text-white font-semibold text-sm">{t.vip.step2Title}</p>
                      <p className="text-gray-400 text-xs mt-0.5">{t.vip.step2Desc}</p>
                    </div>
                  </div>
                </div>
                <a
                  href="/api/auth/discord"
                  className="inline-flex items-center gap-3 bg-[#5865F2] text-white font-bold px-8 py-4 rounded-xl hover:brightness-110 transition-all text-lg w-full justify-center"
                >
                  <DiscordIcon />
                  {t.vip.loginBtn}
                </a>
              </div>
            )}

            {step === 'needsVerify' && initialUser && (
              <div className="text-center space-y-6 w-full">
                <div className="flex items-center justify-center gap-3">
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarUrl} alt="avatar" className="w-10 h-10 rounded-full" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-br-blue flex items-center justify-center font-bold">
                      {initialUser.username[0].toUpperCase()}
                    </div>
                  )}
                  <span className="text-gray-300 font-bold">
                    {initialUser.globalName ?? initialUser.username}
                  </span>
                </div>
                <div className="text-6xl">🔒</div>
                <h3 className="text-2xl font-bold text-br-yellow">{t.vip.needsVerifyTitle}</h3>
                <p className="text-gray-300">{t.vip.needsVerifyDesc}</p>
                <a
                  href="#verificar"
                  className="inline-flex items-center justify-center gap-3 bg-br-yellow text-br-dark font-bold px-8 py-4 rounded-xl hover:brightness-110 transition-all w-full text-lg"
                >
                  {t.vip.needsVerifyBtn}
                </a>
              </div>
            )}

            {step === 'pay' && initialUser && (
              <div className="text-center space-y-6 w-full">
                <div className="flex items-center justify-center gap-3">
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarUrl} alt="avatar" className="w-10 h-10 rounded-full" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-br-blue flex items-center justify-center font-bold">
                      {initialUser.username[0].toUpperCase()}
                    </div>
                  )}
                  <span className="text-br-green font-bold">
                    ✓ {initialUser.globalName ?? initialUser.username}
                  </span>
                </div>
                <div className="inline-flex items-center gap-2 bg-br-green/10 border border-br-green/40 rounded-full px-3 py-1 text-xs text-br-green font-semibold">
                  <span>✓</span> {t.vip.verifiedBadge}
                </div>
                <div className="text-5xl">💸</div>
                <h3 className="text-2xl font-bold">{t.vip.payTitle}</h3>
                <p className="text-gray-400">{t.vip.payDesc}</p>
                <button
                  onClick={handleCreatePayment}
                  disabled={loading}
                  className="bg-br-green text-white font-bold px-8 py-4 rounded-xl hover:brightness-110 transition-all w-full text-lg disabled:opacity-50 disabled:cursor-not-allowed glow-green"
                >
                  {loading ? t.vip.payBtnLoading : t.vip.payBtn}
                </button>
              </div>
            )}

            {step === 'waiting' && pixData && (
              <div className="text-center space-y-5 w-full">
                <h3 className="text-2xl font-bold text-br-yellow">{t.vip.waitingTitle}</h3>
                <p className="text-gray-400 text-sm">{t.vip.waitingDesc}</p>
                <div className="bg-white p-4 rounded-xl inline-block">
                  <QRCodeSVG value={pixData.qrCode} size={200} bgColor="#ffffff" fgColor="#000000" />
                </div>
                <button
                  onClick={handleCopy}
                  className="border border-br-yellow text-br-yellow font-bold px-6 py-3 rounded-xl hover:bg-br-yellow/10 transition-all w-full"
                >
                  {copied ? t.vip.copiedPix : t.vip.copyPix}
                </button>
                <p className="text-gray-500 text-xs animate-pulse">{t.vip.checking}</p>
              </div>
            )}

            {step === 'paid' && (
              <div className="text-center space-y-5 w-full">
                <div className="text-7xl">🎉</div>
                <h3 className="text-3xl font-bold text-br-green">{t.vip.paidTitle}</h3>
                <p className="text-gray-300 text-lg">
                  {t.vip.paidDesc_before}
                  <strong className="text-br-yellow">VIP</strong>
                  {t.vip.paidDesc_after}
                </p>
                <p className="text-gray-500 text-sm">{t.vip.paidHint}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function DiscordIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 127.14 96.36" fill="currentColor">
      <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
    </svg>
  )
}
