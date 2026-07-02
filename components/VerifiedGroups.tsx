'use client'
import Image from 'next/image'
import { useLanguage } from '@/contexts/LanguageContext'

const groups = [
  { name: 'DRAKHALEM', image: '/grupos/DRAKHALEM.png', url: 'https://vrc.group/DRAKA.5624' },
  { name: 'Warhammer 40k Brasil', image: '/grupos/Warhammer40kBrasil.png', url: 'https://vrc.group/W40KBR.7675' },
  { name: 'Caóticos Anônimos', image: '/grupos/CaoticosAnonimos.png', url: 'https://vrc.group/CAOTIC.9761' },
  { name: 'Star Wars Brasil', image: '/grupos/StarWarsBrasil.png', url: 'https://vrchat.com/home/group/grp_5c7d683c-96dd-446c-926e-dfd712c4923b' },
  { name: "Moon's Club", image: '/grupos/MoonsClub.png', url: 'https://vrchat.com/home/group/grp_382c5e60-54a6-4cf6-ba8e-a3a894f2ac34' },
  { name: 'Brazil Golden Beats', image: '/grupos/BrazilGoldenBeats.png', url: 'https://vrchat.com/home/group/grp_5f065e9c-3502-49bf-85dc-73ecb6308bd7' },
]

export default function VerifiedGroups() {
  const { t } = useLanguage()

  return (
    <section className="py-12 bg-br-dark border-t border-white/5">
      <div className="max-w-6xl mx-auto px-6 space-y-10">

        {/* Grupo Oficial */}
        <div className="flex flex-col items-center gap-4">
          <p className="text-center text-gray-500 text-xs uppercase tracking-widest">
            {t.verifiedGroups.official}
          </p>
          <a
            href="https://vrc.group/BRASIL.2696"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative overflow-hidden rounded-2xl border border-br-yellow/30 hover:border-br-yellow transition-all max-w-sm w-full"
          >
            <Image
              src="/grupo-oficial.png"
              alt={t.verifiedGroups.officialName}
              width={480}
              height={270}
              className="w-full object-cover"
            />
            <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-end pb-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-white font-bold text-sm">{t.verifiedGroups.officialName}</span>
              <span className="text-br-yellow text-xs mt-1">{t.verifiedGroups.officialCta}</span>
            </div>
          </a>
          <span className="text-gray-400 text-sm font-semibold">{t.verifiedGroups.officialName}</span>
        </div>

        {/* Grupos Verificados */}
        {groups.length > 0 && (
          <div>
            <p className="text-center text-gray-500 text-xs uppercase tracking-widest mb-6">
              {t.verifiedGroups.verified}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-6">
              {groups.map((group) => (
                <a
                  key={group.name}
                  href={group.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-br-purple/40 border border-white/10 rounded-xl px-5 py-3 hover:border-br-yellow/30 transition-all"
                >
                  <div className="relative w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                    <Image src={group.image} alt={group.name} fill className="object-cover" />
                  </div>
                  <span className="text-white text-sm font-semibold">{group.name}</span>
                  <span className="text-br-yellow text-xs">✓</span>
                </a>
              ))}
            </div>
          </div>
        )}

      </div>
    </section>
  )
}
