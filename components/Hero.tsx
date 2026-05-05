'use client'
import Image from 'next/image'
import { useLanguage } from '@/contexts/LanguageContext'

const particles = [
  { size: 5, left: '8%',  bottom: '20%', dur: 7,  delay: 0,   yellow: true  },
  { size: 3, left: '16%', bottom: '45%', dur: 9,  delay: 1.5, yellow: false },
  { size: 4, left: '28%', bottom: '12%', dur: 8,  delay: 0.8, yellow: true  },
  { size: 2, left: '42%', bottom: '30%', dur: 11, delay: 2.2, yellow: false },
  { size: 6, left: '55%', bottom: '8%',  dur: 7,  delay: 3,   yellow: true  },
  { size: 3, left: '68%', bottom: '22%', dur: 9,  delay: 1,   yellow: false },
  { size: 4, left: '80%', bottom: '35%', dur: 8,  delay: 2.5, yellow: true  },
  { size: 2, left: '90%', bottom: '15%', dur: 12, delay: 0.5, yellow: false },
  { size: 3, left: '22%', bottom: '65%', dur: 13, delay: 4,   yellow: true  },
  { size: 5, left: '75%', bottom: '55%', dur: 10, delay: 3.5, yellow: false },
  { size: 2, left: '50%', bottom: '70%', dur: 14, delay: 5,   yellow: true  },
  { size: 4, left: '35%', bottom: '50%', dur: 11, delay: 2,   yellow: false },
  { size: 3, left: '12%', bottom: '80%', dur: 10, delay: 6,   yellow: true  },
  { size: 2, left: '62%', bottom: '75%', dur: 12, delay: 1.2, yellow: false },
  { size: 5, left: '88%', bottom: '60%', dur: 9,  delay: 4.5, yellow: true  },
  { size: 3, left: '45%', bottom: '88%', dur: 15, delay: 2.8, yellow: false },
]

export default function Hero() {
  const { t } = useLanguage()
  const discordInvite = process.env.NEXT_PUBLIC_DISCORD_INVITE ?? '#'

  return (
    <section
      id="inicio"
      className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20"
    >
      {/* Background layers */}
      <div className="absolute inset-0 bg-gradient-to-br from-br-yellow/5 via-br-dark to-br-purple/40" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(21,101,192,0.15),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(0,155,58,0.08),transparent_55%)]" />

      {/* Dot grid overlay */}
      <div className="absolute inset-0 dot-grid opacity-50 pointer-events-none" />

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((p, i) => (
          <div
            key={i}
            className="absolute rounded-full animate-float-up"
            style={{
              width: `${p.size}px`,
              height: `${p.size}px`,
              left: p.left,
              bottom: p.bottom,
              background: p.yellow ? 'rgba(255,215,0,0.75)' : 'rgba(0,155,58,0.65)',
              boxShadow: p.yellow
                ? '0 0 8px 2px rgba(255,215,0,0.5)'
                : '0 0 8px 2px rgba(0,155,58,0.5)',
              animationDuration: `${p.dur}s`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col lg:flex-row items-center gap-12 max-w-6xl mx-auto px-6 py-16">
        {/* Text */}
        <div className="flex-1 text-center lg:text-left">
          <div className="opacity-0 animate-fade-in-up [animation-delay:0.1s] [animation-fill-mode:forwards] inline-block bg-br-yellow/10 border border-br-yellow/30 rounded-full px-4 py-1 text-br-yellow text-sm font-semibold mb-6">
            {t.hero.badge}
          </div>
          <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6">
            <span className="opacity-0 animate-fade-in-up [animation-delay:0.3s] [animation-fill-mode:forwards] block text-br-yellow text-glow-yellow drop-shadow-[0_0_40px_rgba(255,215,0,0.7)]">
              BRASIL
            </span>
            <span className="opacity-0 animate-fade-in-up [animation-delay:0.55s] [animation-fill-mode:forwards] block">
              <span className="text-br-green text-glow-green drop-shadow-[0_0_30px_rgba(0,155,58,0.6)]">ROLE</span>{' '}
              <span className="text-white">BR</span>
            </span>
          </h1>
          <p className="opacity-0 animate-fade-in-up [animation-delay:0.8s] [animation-fill-mode:forwards] text-gray-300 text-lg md:text-xl max-w-lg mx-auto lg:mx-0 mb-10 leading-relaxed">
            {t.hero.desc}
          </p>
          <div className="opacity-0 animate-fade-in-up [animation-delay:1s] [animation-fill-mode:forwards] flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
            <a
              href="#vip"
              className="bg-br-yellow text-br-dark font-bold px-8 py-4 rounded-xl text-lg hover:brightness-110 transition-all shadow-lg glow-yellow-strong btn-shine"
            >
              {t.hero.btnVip}
            </a>
            <a
              href={discordInvite}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#5865F2] text-white font-bold px-8 py-4 rounded-xl text-lg hover:brightness-110 transition-all shadow-lg btn-shine"
            >
              💬 DISCORD
            </a>
          </div>
        </div>

        {/* Cover image */}
        <div className="flex-1 flex justify-center opacity-0 animate-slide-in-right [animation-delay:0.4s] [animation-fill-mode:forwards]">
          <div className="relative animate-float">
            <div className="absolute inset-0 bg-br-yellow/20 rounded-3xl blur-3xl scale-110 animate-glow-pulse" />
            <div className="absolute -inset-4 bg-gradient-to-br from-br-yellow/10 via-transparent to-br-green/10 rounded-3xl blur-2xl animate-gradient-x" style={{ backgroundSize: '200% 200%' }} />
            <Image
              src="/cover.png"
              alt="Brasil Role BR"
              width={500}
              height={375}
              className="relative drop-shadow-2xl rounded-2xl"
              priority
            />
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 opacity-0 [animation:fadeInUp_0.8s_ease_1.5s_forwards]">
        <a href="#sobre" className="flex flex-col items-center gap-1 text-br-yellow group">
          <span className="text-xs uppercase tracking-widest text-gray-500 group-hover:text-br-yellow transition-colors">{t.hero.scroll}</span>
          <span className="animate-bounce text-2xl block">↓</span>
        </a>
      </div>
    </section>
  )
}
