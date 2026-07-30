'use client'
import Image from 'next/image'
import { useLanguage } from '@/contexts/LanguageContext'

type RoleKey = 'owner' | 'mod'

interface Member {
  name: string
  role: RoleKey
  image?: string
  discord?: string
  owner?: boolean
}

const members: Member[] = [
  {
    name: 'ByssBox',
    role: 'mod',
    image: '/team/ByssBox.png',
    discord: 'byssbox',
  },
  {
    name: 'Spanco',
    role: 'mod',
    image: '/team/Spanco.png',
    discord: 'spanco',
  },
  {
    name: 'MiraNaJanela',
    role: 'owner',
    image: '/team/MiraNaJanela.png',
    discord: 'miranajanela',
    owner: true,
  },
  {
    name: 'NaomiiUwU',
    role: 'mod',
    image: '/team/NaomiiUwU.png',
    discord: 'naomiiuwu',
  },
  {
    name: 'CoronelGilbert',
    role: 'mod',
    image: '/team/CoronelGilbert.png',
    discord: 'coronelgilbert',
  },
  {
    name: 'Artista',
    role: 'mod',
    image: '/team/Artista.png',
    discord: 'artista_chan',
  },
]

export default function Team() {
  const { t } = useLanguage()

  const roleLabel: Record<RoleKey, string> = {
    owner: t.team.roleOwner,
    mod: t.team.roleMod,
  }

  return (
    <section id="equipe" className="py-24 bg-br-dark relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-br-yellow/3 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-14 reveal">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="text-white">{t.team.titleA}</span>{' '}
            <span className="text-br-yellow">{t.team.titleB}</span>
          </h2>
          <p className="text-gray-400">{t.team.subtitle}</p>
        </div>

        <div className="flex flex-col sm:flex-row items-end justify-center gap-6 reveal-stagger">
          {members.map((member) => (
            <div
              key={member.name}
              className={`flex flex-col items-center text-center rounded-2xl border transition-all hover:-translate-y-2 group card-shimmer
                ${member.owner
                  ? 'bg-br-purple/70 border-br-yellow/50 px-10 py-10 w-64 animate-border-glow hover:-translate-y-3'
                  : 'bg-br-purple/40 border-white/5 hover:border-br-yellow/30 px-8 py-8 w-52 hover:-translate-y-2'
                }`}
            >
              <div className={`relative rounded-full overflow-hidden mb-4
                ${member.owner
                  ? 'w-28 h-28 ring-2 ring-br-yellow ring-offset-2 ring-offset-br-purple/70'
                  : 'w-20 h-20 ring-2 ring-white/10 group-hover:ring-br-yellow/40 transition-all'
                }`}
              >
                {member.image ? (
                  <Image
                    src={member.image}
                    alt={member.name}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-br-yellow to-br-green flex items-center justify-center text-2xl font-bold text-br-dark">
                    {member.name[0]}
                  </div>
                )}
              </div>

              {member.owner && (
                <span className="text-xs bg-br-yellow text-br-dark font-bold px-3 py-1 rounded-full mb-2 glow-yellow">
                  {t.team.ownerBadge}
                </span>
              )}

              <h3 className={`font-bold group-hover:text-br-yellow transition-colors duration-300
                ${member.owner ? 'text-white text-xl' : 'text-white'}`}>
                {member.name}
              </h3>
              <p className={`text-sm mt-1 ${member.owner ? 'text-br-yellow' : 'text-gray-400'}`}>
                {roleLabel[member.role]}
              </p>
              {member.discord && (
                <p className="text-gray-600 text-xs mt-2">@{member.discord}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
