import Link from 'next/link'

const GAMES = [
  {
    href: '/pets/minigames/alimentar',
    icon: '🍎',
    title: 'Alimentar',
    desc: 'Clique nas comidas antes de caírem! Não deixe seu bichinho com fome.',
    color: 'border-red-500/50 hover:border-red-400 bg-red-900/10',
    reward: '+pontos',
  },
  {
    href: '/pets/minigames/banho',
    icon: '🛁',
    title: 'Banho',
    desc: 'Limpe as manchas que aparecem no bichinho antes que fique sujo demais.',
    color: 'border-blue-500/50 hover:border-blue-400 bg-blue-900/10',
    reward: '+pontos',
  },
  {
    href: '/pets/minigames/pulo',
    icon: '🦕',
    title: 'Corrida Infinita',
    desc: 'Corra o máximo possível sem bater nos obstáculos! O jogo acelera com o tempo.',
    color: 'border-green-500/50 hover:border-green-400 bg-green-900/10',
    reward: 'recorde de distância',
  },
  {
    href: '/pets/minigames/pesca',
    icon: '🎣',
    title: 'Pesca',
    desc: 'Fique atento ao flutuador e toque rápido quando o peixe morder!',
    color: 'border-cyan-500/50 hover:border-cyan-400 bg-cyan-900/10',
    reward: '+pontos +saciedade',
  },
  {
    href: '/pets/minigames/danca',
    icon: '🎵',
    title: 'Dança',
    desc: 'Memorize e repita sequências de setas. Cada rodada fica mais longa!',
    color: 'border-pink-500/50 hover:border-pink-400 bg-pink-900/10',
    reward: '+pontos +XP',
  },
  {
    href: '/pets/minigames/sonho',
    icon: '💤',
    title: 'Sonho',
    desc: 'Proteja o bichinho dormindo! Afaste os pesadelos antes que cheguem!',
    color: 'border-violet-500/50 hover:border-violet-400 bg-violet-900/10',
    reward: '+pontos',
  },
  {
    href: '/pets/minigames/treino',
    icon: '💪',
    title: 'Treino',
    desc: 'Toque no momento certo para completar as reps! Fica mais difícil...',
    color: 'border-yellow-500/50 hover:border-yellow-400 bg-yellow-900/10',
    reward: '+pontos +XP',
  },
  {
    href: '/pets/minigames/memoria',
    icon: '🃏',
    title: 'Memória',
    desc: 'Encontre todos os pares de cartas. Quanto mais rápido, mais pontos!',
    color: 'border-indigo-500/50 hover:border-indigo-400 bg-indigo-900/10',
    reward: '+pontos',
  },
]

export default function MinigamesPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-white">🎮 Mini-games</h1>
      <p className="text-zinc-400">Jogue para ganhar pontos e desbloquear recompensas!</p>
      <div className="space-y-4">
        {GAMES.map(g => (
          <Link key={g.href} href={g.href}
            className={`block rounded-2xl border-2 p-6 transition-all hover:scale-[1.02] ${g.color}`}>
            <div className="flex items-center gap-4">
              <span className="text-5xl">{g.icon}</span>
              <div className="flex-1">
                <h2 className="text-white text-xl font-bold">{g.title}</h2>
                <p className="text-zinc-400 text-sm mt-1">{g.desc}</p>
                <p className="text-yellow-400 text-xs mt-2 font-medium">Recompensa: {g.reward}</p>
              </div>
              <span className="text-zinc-500 text-2xl">→</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
