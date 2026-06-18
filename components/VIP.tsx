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

type Step = 'login' | 'needsVerify' | 'selectTier' | 'waiting' | 'paid'

interface TierInfo {
  tier: 1 | 2 | 3
  name: string
  emoji: string
  price: number
  color: string
  borderColor: string
  glowColor: string
  badge: string
  benefits: string[]
  highlight?: string
}

const COIN_CLASS: Record<1 | 2 | 3, string> = {
  1: 'coin-vip1',
  2: 'coin-vip2',
  3: 'coin-vip3',
}

const TIERS: TierInfo[] = [
  {
    tier: 1,
    name: 'VIP Bronze',
    emoji: '🥉',
    price: 5,
    color: 'text-amber-600',
    borderColor: 'border-amber-700/60',
    glowColor: 'hover:border-amber-600',
    badge: 'bg-amber-900/30 border-amber-700/40',
    benefits: [
      '✨ Efeito especial ao voar no mapa',
      '🪙 Moedinha VIP flutuando na cabeça',
      '🏆 Nome na placa de apoiadores',
      '👑 Cargos especiais no Discord',
      '💬 Canal VIP exclusivo no Discord',
      '🎰 3x bônus nos sorteios',
      '🎁 Desconto na cápsula de pets (400 pts)',
    ],
  },
  {
    tier: 2,
    name: 'VIP Prata',
    emoji: '🥈',
    price: 15,
    color: 'text-slate-300',
    borderColor: 'border-slate-400/60',
    glowColor: 'hover:border-slate-300',
    badge: 'bg-slate-800/40 border-slate-500/40',
    highlight: 'POPULAR',
    benefits: [
      '🥉 Todos os benefícios do Bronze',
      '🥚 Melhores chances na cápsula de pets',
      '💰 Desconto maior na cápsula (350 pts)',
      '🎰 5x bônus nos sorteios',
      '⭐ Badge exclusivo Prata no Discord',
    ],
  },
  {
    tier: 3,
    name: 'VIP Ouro',
    emoji: '🥇',
    price: 25,
    color: 'text-yellow-400',
    borderColor: 'border-yellow-500/60',
    glowColor: 'hover:border-yellow-400',
    badge: 'bg-yellow-900/30 border-yellow-600/40',
    highlight: 'MELHOR',
    benefits: [
      '🥈 Todos os benefícios do Prata',
      '🌟 Odds máximas na cápsula (épico + lendário)',
      '💰 Desconto máximo na cápsula (300 pts)',
      '🎰 10x bônus nos sorteios',
      '🌟 Badge exclusivo Ouro no Discord',
    ],
  },
]

function pickInitialStep(user: DiscordUser | null, verified: boolean): Step {
  if (!user) return 'login'
  if (!verified) return 'needsVerify'
  return 'selectTier'
}

export default function VIP({ initialUser, initialVerified }: { initialUser: DiscordUser | null; initialVerified: boolean }) {
  const { t } = useLanguage()
  const [step, setStep] = useState<Step>(pickInitialStep(initialUser, initialVerified))
  const [selectedTier, setSelectedTier] = useState<TierInfo | null>(null)
  const [pixData, setPixData] = useState<{ qrCode: string; paymentId: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setStep(prev => {
      if (prev === 'waiting' || prev === 'paid') return prev
      return pickInitialStep(initialUser, initialVerified)
    })
  }, [initialUser, initialVerified])

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
    if (!selectedTier) return
    setLoading(true)
    const res = await fetch('/api/create-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: selectedTier.tier }),
    })
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

        {/* Tier cards — visíveis sempre */}
        <div className="grid md:grid-cols-3 gap-5 mb-10">
          {TIERS.map(tier => (
            <div
              key={tier.tier}
              className={`relative rounded-2xl border-2 p-6 transition-all ${tier.borderColor} ${tier.glowColor} ${tier.badge} ${
                selectedTier?.tier === tier.tier ? 'scale-[1.02] brightness-110' : ''
              }`}
            >
              {tier.highlight && (
                <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-bold bg-br-yellow text-br-dark`}>
                  {tier.highlight}
                </div>
              )}
              <div className="text-center mb-4">
                <div className="flex justify-center mb-2" style={{ perspective: '300px' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/MoedaVip.png"
                    alt={tier.name}
                    width={72}
                    height={72}
                    className={COIN_CLASS[tier.tier]}
                  />
                </div>
                <h3 className={`text-lg font-bold ${tier.color}`}>{tier.name}</h3>
                <div className="text-3xl font-extrabold text-white mt-1">
                  R$ {tier.price}
                  <span className="text-sm font-normal text-gray-400">/mês</span>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-gray-300 mb-5">
                {tier.benefits.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
              {(step === 'selectTier') && (
                <button
                  onClick={() => setSelectedTier(tier)}
                  className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all border ${tier.borderColor} ${tier.color} hover:bg-white/10 ${
                    selectedTier?.tier === tier.tier ? 'bg-white/10' : ''
                  }`}
                >
                  {selectedTier?.tier === tier.tier ? '✓ Selecionado' : 'Selecionar'}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Payment widget */}
        <div className="max-w-md mx-auto bg-br-purple/50 rounded-2xl p-8 border border-br-blue/20 min-h-[200px] flex items-center justify-center">

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

          {step === 'selectTier' && initialUser && (
            <div className="text-center space-y-5 w-full">
              <div className="flex items-center justify-center gap-3">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="avatar" className="w-9 h-9 rounded-full" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-br-blue flex items-center justify-center font-bold text-sm">
                    {initialUser.username[0].toUpperCase()}
                  </div>
                )}
                <span className="inline-flex items-center gap-1.5 text-br-green font-bold text-sm">
                  ✓ {initialUser.globalName ?? initialUser.username}
                </span>
                <span className="inline-flex items-center gap-1 bg-br-green/10 border border-br-green/40 rounded-full px-2 py-0.5 text-xs text-br-green font-semibold">
                  ✓ {t.vip.verifiedBadge}
                </span>
              </div>

              {!selectedTier ? (
                <>
                  <div className="text-4xl">👆</div>
                  <p className="text-gray-400">Selecione um plano acima para continuar</p>
                </>
              ) : (
                <>
                  <div className="flex justify-center" style={{ perspective: '300px' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/MoedaVip.png" alt={selectedTier.name} width={56} height={56} className={COIN_CLASS[selectedTier.tier]} />
              </div>
                  <div>
                    <p className={`font-bold text-lg ${selectedTier.color}`}>{selectedTier.name}</p>
                    <p className="text-gray-400 text-sm">R$ {selectedTier.price},00/mês • renovação manual</p>
                  </div>
                  <button
                    onClick={handleCreatePayment}
                    disabled={loading}
                    className="bg-br-green text-white font-bold px-8 py-4 rounded-xl hover:brightness-110 transition-all w-full text-lg disabled:opacity-50 disabled:cursor-not-allowed glow-green"
                  >
                    {loading ? t.vip.payBtnLoading : `Gerar PIX — R$ ${selectedTier.price},00`}
                  </button>
                  <button
                    onClick={() => setSelectedTier(null)}
                    className="text-gray-500 hover:text-gray-300 text-sm transition-colors"
                  >
                    ← Trocar plano
                  </button>
                </>
              )}
            </div>
          )}

          {step === 'waiting' && pixData && (
            <div className="text-center space-y-5 w-full">
              {selectedTier && (
                <p className={`text-sm font-bold ${selectedTier.color}`}>
                  {selectedTier.emoji} {selectedTier.name} — R$ {selectedTier.price},00
                </p>
              )}
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
                <strong className={selectedTier?.color ?? 'text-br-yellow'}>
                  {selectedTier?.name ?? 'VIP'}
                </strong>
                {t.vip.paidDesc_after}
              </p>
              <p className="text-gray-500 text-sm">{t.vip.paidHint}</p>
            </div>
          )}
        </div>

        <div className="mt-6 p-4 max-w-md mx-auto bg-br-blue/10 border border-br-blue/30 rounded-xl text-sm text-gray-400 text-center">
          {t.vip.durationNote_before}
          <strong className="text-white">30</strong>
          {t.vip.durationNote_after}
        </div>

        {/* Botão de suporte */}
        <div className="mt-8 text-center">
          <a
            href={`https://discord.com/channels/972901887034654770/1488376250496974868`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 border border-white/20 text-gray-300 hover:text-white hover:border-white/40 px-6 py-3 rounded-xl transition-all text-sm"
          >
            <span>💬</span>
            Precisa de ajuda? Fale conosco no Discord
          </a>
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
