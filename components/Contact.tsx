'use client'
import { useLanguage } from '@/contexts/LanguageContext'

const socials = [
  {
    name: 'Twitter / X',
    handle: '@MiraNaJanela',
    href: 'https://x.com/MiraNaJanela',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
    color: 'border-white/20 hover:border-white/50',
    textColor: 'text-white',
  },
  {
    name: 'Instagram',
    handle: '@miranajanela',
    href: 'https://instagram.com/miranajanela',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    ),
    color: 'border-pink-500/30 hover:border-pink-500/70',
    textColor: 'text-pink-400',
  },
  {
    name: 'TikTok',
    handle: '@miranajanela',
    href: 'https://tiktok.com/@miranajanela',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.75a4.85 4.85 0 01-1.01-.06z" />
      </svg>
    ),
    color: 'border-cyan-400/30 hover:border-cyan-400/70',
    textColor: 'text-cyan-400',
  },
]

export default function Contact() {
  const { t } = useLanguage()
  const discordInvite = process.env.NEXT_PUBLIC_DISCORD_INVITE ?? '#'

  return (
    <section id="contato" className="py-24 bg-br-dark relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-br-yellow/30 to-transparent" />
      <div className="absolute -bottom-32 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-br-blue/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-4xl mx-auto px-6 text-center reveal">
        <h2 className="text-4xl md:text-5xl font-bold mb-4">
          <span className="text-white">{t.contact.titleA}</span>{' '}
          <span className="text-br-yellow">{t.contact.titleB}</span>
        </h2>
        <p className="text-gray-400 text-lg mb-14">{t.contact.subtitle}</p>

        <div className="grid md:grid-cols-2 gap-6 mb-10">
          <a
            href={discordInvite}
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-[#5865F2]/15 border border-[#5865F2]/40 rounded-2xl p-8 hover:bg-[#5865F2]/25 hover:border-[#5865F2]/70 transition-all text-left btn-shine hover:-translate-y-1"
          >
            <div className="text-5xl mb-4">💬</div>
            <h3 className="text-xl font-bold text-white mb-2 group-hover:text-[#5865F2] transition-colors">
              {t.contact.discordTitle}
            </h3>
            <p className="text-gray-400 mb-4">{t.contact.discordDesc}</p>
            <span className="text-[#5865F2] font-semibold group-hover:underline">
              {t.contact.discordLink}
            </span>
          </a>

          <a
            href="mailto:miranajanela@gmail.com"
            className="group bg-br-purple/40 border border-white/10 rounded-2xl p-8 hover:border-br-yellow/40 transition-all text-left block btn-shine hover:-translate-y-1"
          >
            <div className="text-5xl mb-4">📢</div>
            <h3 className="text-xl font-bold text-white mb-2 group-hover:text-br-yellow transition-colors">
              {t.contact.advertiseTitle}
            </h3>
            <p className="text-gray-400 mb-4">{t.contact.advertiseDesc}</p>
            <span className="text-br-yellow font-semibold group-hover:underline">
              {t.contact.advertiseLink}
            </span>
          </a>
        </div>

        <div>
          <p className="text-gray-500 text-sm mb-6 uppercase tracking-widest">{t.contact.socialTitle}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center reveal-stagger">
            {socials.map((s) => (
              <a
                key={s.name}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-3 bg-br-purple/40 border ${s.color} rounded-xl px-6 py-4 transition-all hover:-translate-y-1 btn-shine`}
              >
                <span className={s.textColor}>{s.icon}</span>
                <div className="text-left">
                  <div className="text-white font-semibold text-sm">{s.name}</div>
                  <div className={`${s.textColor} text-xs`}>{s.handle}</div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
