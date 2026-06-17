'use client'

import { useEffect, useState } from 'react'
import PetSprite from '@/components/pets/PetSprite'
import { loadData, saveData, setActivePet, type PetPlayerData, type PetInstance } from '@/lib/petStore'
import { PET_DB, RARITY_STYLE, ELEMENT_EMOJI, ELEMENT_COLOR, type Rarity } from '@/lib/petData'

interface DiscordUser { id: string; username: string; avatar: string | null; globalName: string | null }

const RARITIES: (Rarity | 'Todos')[] = ['Todos', 'Comum', 'Incomum', 'Raro', 'Épico', 'Lendário']

export default function ColecaoClient({ initialUser }: { initialUser: DiscordUser | null }) {
  const [data, setData] = useState<PetPlayerData | null>(null)
  const [filter, setFilter] = useState<Rarity | 'Todos'>('Todos')
  const [selected, setSelected] = useState<PetInstance | null>(null)

  useEffect(() => {
    if (!initialUser) return
    setData(loadData(initialUser.id))
  }, [initialUser])

  function handleActivate(inst: PetInstance) {
    if (!initialUser || !data) return
    const updated = setActivePet(data, inst.instanceId)
    saveData(updated)
    setData(updated)
    setSelected(null)
  }

  if (!initialUser) return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <p className="text-zinc-400">Faça login para ver sua coleção.</p>
    </div>
  )

  if (!data) return <div className="flex items-center justify-center min-h-[80vh] text-zinc-400">Carregando...</div>

  const ownedIds = new Set(data.ownedPets.map(p => p.petId))
  const visibleDefs = filter === 'Todos' ? PET_DB : PET_DB.filter(p => p.rarity === filter)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white">📖 Coleção</h1>
        <p className="text-zinc-400 text-sm">{ownedIds.size} / {PET_DB.length} bichinhos</p>
      </div>

      {/* Meus bichinhos */}
      {data.ownedPets.length > 0 && (
        <section>
          <h2 className="text-zinc-400 text-sm uppercase tracking-wider mb-3">Meus Bichinhos</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {data.ownedPets.map(inst => {
              const def = PET_DB.find(p => p.id === inst.petId)!
              const style = RARITY_STYLE[def.rarity]
              const isActive = inst.instanceId === data.activePetId
              return (
                <button
                  key={inst.instanceId}
                  onClick={() => setSelected(inst)}
                  className={`rounded-xl border-2 p-4 text-left transition-all hover:scale-105 ${
                    isActive ? 'border-yellow-400 bg-yellow-900/20' : `${style.border} ${style.bg}`
                  }`}
                >
                  <PetSprite petId={inst.petId} size={64} className="mb-2" />
                  <p className="text-white font-medium text-sm truncate">{inst.name}</p>
                  <p className={`text-xs ${style.text}`}>{def.rarity} · {ELEMENT_EMOJI[inst.element]} <span className={ELEMENT_COLOR[inst.element]}>{inst.element}</span></p>
                  {isActive && <span className="text-yellow-400 text-xs font-bold">● Ativo</span>}
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* Pokédex completa */}
      <section>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-zinc-400 text-sm uppercase tracking-wider">Pokédex</h2>
          <div className="flex gap-1 flex-wrap">
            {RARITIES.map(r => (
              <button
                key={r}
                onClick={() => setFilter(r)}
                className={`px-2 py-1 rounded-lg text-xs font-medium transition-all ${
                  filter === r ? 'bg-yellow-400 text-black' : 'text-zinc-400 hover:text-white bg-zinc-800'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
          {visibleDefs.map(def => {
            const owned = ownedIds.has(def.id)
            const style = RARITY_STYLE[def.rarity]
            return (
              <div
                key={def.id}
                title={owned ? `${def.name} - ${def.rarity}` : '???'}
                className={`rounded-xl border p-2 text-center transition-all ${
                  owned ? `${style.border} ${style.bg} hover:scale-110 cursor-pointer` : 'border-zinc-800 bg-zinc-900/60'
                }`}
              >
                <div className={owned ? '' : 'opacity-20 grayscale'}>
                  {owned
                    ? <PetSprite petId={def.id} size={48} className="mx-auto" />
                    : <img src={`/pets/sprites/monster_${String(def.id).padStart(3,'0')}_idle.png`}
                        width={48} height={48} alt="" className="mx-auto object-contain"
                        style={{ imageRendering:'auto' }} />
                  }
                </div>
                <p className={`text-xs mt-1 truncate ${owned ? 'text-zinc-300' : 'text-zinc-700'}`}>
                  {owned ? def.name : `#${def.id}`}
                </p>
              </div>
            )
          })}
        </div>
      </section>

      {/* Modal de bichinho */}
      {selected && (() => {
        const def = PET_DB.find(p => p.id === selected.petId)!
        const style = RARITY_STYLE[def.rarity]
        return (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
            <div className={`bg-[#130F2A] border-2 ${style.border} rounded-2xl p-8 max-w-xs w-full text-center space-y-4`}
              onClick={e => e.stopPropagation()}>
              <PetSprite petId={selected.petId} size={120} animate className="mx-auto" />
              <div>
                <h3 className="text-white text-xl font-bold">{selected.name}</h3>
                <p className={`text-sm ${style.text}`}>{def.rarity} · {ELEMENT_EMOJI[selected.element]} <span className={ELEMENT_COLOR[selected.element]}>{selected.element}</span></p>
                <p className="text-zinc-500 text-xs mt-1">Nome original: {def.name}</p>
              </div>
              <p className="text-zinc-400 text-sm">Nível {selected.level}</p>
              {selected.instanceId !== data.activePetId ? (
                <button
                  onClick={() => handleActivate(selected)}
                  className="w-full py-2 bg-yellow-400 hover:bg-yellow-300 text-black font-bold rounded-xl transition-all"
                >
                  Ativar este bichinho
                </button>
              ) : (
                <p className="text-yellow-400 text-sm font-medium">✓ Bichinho ativo</p>
              )}
              <button onClick={() => setSelected(null)} className="text-zinc-500 hover:text-white text-sm transition-colors">Fechar</button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
