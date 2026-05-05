'use client'
import { useLanguage } from '@/contexts/LanguageContext'

const socials = [
  { href: 'https://x.com/MiraNaJanela', label: 'Twitter/X', icon: '𝕏' },
  { href: 'https://instagram.com/miranajanela', label: 'Instagram', icon: '📸' },
  { href: 'https://tiktok.com/@miranajanela', label: 'TikTok', icon: '🎵' },
]

export default function Footer() {
  const { t } = useLanguage()

  return (
    <footer className="bg-br-dark2 border-t border-white/5 py-10">
      <div className="max-w-6xl mx-auto px-6 text-center">
        <div className="text-2xl font-bold mb-4">
          <span className="text-br-yellow">Brasil</span>{' '}
          <span className="text-br-green">Role</span>{' '}
          <span className="text-white">BR</span>
        </div>

        <div className="flex justify-center gap-6 mb-6">
          {socials.map((s) => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={s.label}
              className="text-gray-500 hover:text-white transition-colors text-lg"
            >
              {s.icon}
            </a>
          ))}
        </div>

        <p className="text-gray-500 text-sm">
          © {new Date().getFullYear()} Brasil Role BR por{' '}
          <a
            href="https://x.com/MiraNaJanela"
            target="_blank"
            rel="noopener noreferrer"
            className="text-br-yellow hover:underline"
          >
            MiraNaJanela
          </a>
          . {t.footer.rights}
        </p>
        <p className="text-gray-700 text-xs mt-2">{t.footer.disclaimer}</p>
      </div>
    </footer>
  )
}
