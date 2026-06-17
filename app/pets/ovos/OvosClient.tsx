'use client'

import { useEffect, useState } from 'react'
import PetSprite from '@/components/pets/PetSprite'
import {
  loadData, saveData, startIncubation, checkHatch, addPet,
  incubationProgress, incubationSecondsLeft,
  type PetPlayerData,
} from '@/lib/petStore'
import { EGG_DB, getPet, RARITY_STYLE, ELEMENT_EMOJI, ELEMENT_COLOR, ELEMENTS, type Rarity, type Element } from '@/lib/petData'
import { formatTimeLeft } from '@/lib/petStore'
import { playHatch, playXpGain, playClick } from '@/lib/sounds'

interface DiscordUser { id: string; username: string; avatar: string | null; globalName: string | null }

const EGG_EMOJI: Record<Rarity, string> = {
  'Comum':'🥚', 'Incomum':'🟢', 'Raro':'🔵', 'Épico':'🟣', 'Lendário':'🌟',
}

type ModalState =
  | { kind: 'hatch';    petId: number; element: Element }
  | { kind: 'duplicate'; petId: number; element: Element; xp: number }
  | null

export default function OvosClient({ initialUser }: { initialUser: DiscordUser | null }) {
  const [data, setData] = useState<PetPlayerData | null>(null)
  const [progress, setProgress] = useState(0)
  const [secsLeft, setSecsLeft] = useState(0)
  const [modal, setModal] = useState<ModalState>(null)
  const [hatchName, setHatchName] = useState('')
  const [pendingHatch, setPendingHatch] = useState<{ data: PetPlayerData; petId: number; element: Element } | null>(null)

  useEffect(() => {
    if (!initialUser) return
    setData(loadData(initialUser.id))
  }, [initialUser])

  useEffect(() => {
    if (!data?.incubating) return
    const id = setInterval(() => {
      const prog = incubationProgress(data.incubating!)
      const secs = incubationSecondsLeft(data.incubating!)
      setProgress(prog)
      setSecsLeft(secs)

      if (prog >= 1) {
        clearInterval(id)
        const result = checkHatch(data)
        if (result.hatchedPetId) {
          saveData(result.data)
          setData(result.data)
          if (result.isDuplicate) {
            playXpGain()
            setModal({ kind:'duplicate', petId:result.hatchedPetId, element:result.hatchedElement!, xp:result.xpGained })
          } else {
            playHatch()
            const pet = getPet(result.hatchedPetId)
            setHatchName(pet.name)
            setPendingHatch({ data:result.data, petId:result.hatchedPetId, element:result.hatchedElement! })
            setModal({ kind:'hatch', petId:result.hatchedPetId, element:result.hatchedElement! })
          }
        }
      }
    }, 500)
    return () => clearInterval(id)
  }, [data])

  function handleSendToIncubator(eggId: string) {
    if (!initialUser || !data) return
    playClick()
    const updated = startIncubation(data, eggId)
    saveData(updated)
    setData(updated)
  }

  function handleConfirmName() {
    if (!pendingHatch || !initialUser) return
    playClick()
    const name = hatchName.trim() || getPet(pendingHatch.petId).name
    const updated = addPet(pendingHatch.data, pendingHatch.petId, pendingHatch.element, name)
    saveData(updated)
    setData(updated)
    setPendingHatch(null)
    setModal(null)
  }

  function handleCloseDuplicate() {
    playClick()
    setModal(null)
  }

  if (!initialUser) return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <p className="text-zinc-400">Faça login para ver seus ovos.</p>
    </div>
  )
  if (!data) return <div className="flex items-center justify-center min-h-[80vh] text-zinc-400">Carregando...</div>

  const eggDef = data.incubating ? EGG_DB.find(e => e.type === data.incubating!.egg.type)! : null
  const rarityStyle = eggDef ? RARITY_STYLE[eggDef.type] : null

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      <h1 className="text-2xl font-bold text-white">🥚 Meus Ovos</h1>

      {/* Incubadora */}
      <section>
        <h2 className="text-zinc-400 text-xs uppercase tracking-wider mb-3">Incubadora</h2>
        {data.incubating ? (
          <div className={`rounded-2xl border-2 p-6 ${rarityStyle!.border} ${rarityStyle!.bg}`}>
            <div className="flex items-center gap-4 mb-4">
              <span className="text-5xl animate-pulse">{EGG_EMOJI[data.incubating.egg.type]}</span>
              <div>
                <p className={`font-bold text-lg ${rarityStyle!.text}`}>{eggDef!.label}</p>
                <p className="text-zinc-400 text-sm">
                  {secsLeft > 0 ? formatTimeLeft(secsLeft) : <span className="text-green-400 animate-pulse font-medium">Pronto para eclodir!</span>}
                </p>
              </div>
            </div>
            <div className="bg-zinc-800 rounded-full h-4 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-yellow-500 to-yellow-300 transition-all duration-500 rounded-full"
                style={{ width:`${Math.round(progress * 100)}%` }} />
            </div>
            <p className="text-right text-zinc-500 text-xs mt-1">{Math.round(progress * 100)}%</p>
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-zinc-700 p-6 text-center text-zinc-500">
            <p className="text-4xl mb-2">⬜</p>
            <p>Incubadora vazia</p>
            <p className="text-sm text-zinc-600 mt-1">Selecione um ovo abaixo para incubar</p>
          </div>
        )}
      </section>

      {/* Inventário */}
      <section>
        <h2 className="text-zinc-400 text-xs uppercase tracking-wider mb-3">
          Inventário ({data.ownedEggs.length} ovos)
        </h2>
        {data.ownedEggs.length === 0 ? (
          <div className="text-center py-8 text-zinc-600">
            <p className="text-4xl mb-2">🫙</p>
            <p>Sem ovos — use a cápsula para conseguir mais!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {data.ownedEggs.map(egg => {
              const def = EGG_DB.find(e => e.type === egg.type)!
              const style = RARITY_STYLE[egg.type]
              return (
                <div key={egg.instanceId} className={`rounded-xl border ${style.border} ${style.bg} p-4 flex items-center gap-3`}>
                  <span className="text-3xl">{EGG_EMOJI[egg.type]}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm ${style.text}`}>{def.label}</p>
                    <p className="text-zinc-500 text-xs">{formatTimeLeft(def.incubationSeconds)}</p>
                  </div>
                  <button onClick={() => handleSendToIncubator(egg.instanceId)}
                    disabled={!!data.incubating}
                    className="px-3 py-1.5 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 disabled:cursor-not-allowed text-black text-xs font-bold rounded-lg transition-all">
                    Incubar
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Modal — Eclosão normal */}
      {modal?.kind === 'hatch' && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#130F2A] border-2 border-yellow-400 rounded-2xl p-8 max-w-sm w-full text-center space-y-4 shadow-2xl shadow-yellow-400/20">
            <div className="text-5xl animate-bounce">🎉</div>
            <h2 className="text-2xl font-bold text-yellow-400">Nasceu!</h2>
            <PetSprite petId={modal.petId} size={120} animate className="mx-auto" />
            <div>
              <p className="text-zinc-400 text-sm">
                {ELEMENT_EMOJI[modal.element]}
                <span className={`ml-1 ${ELEMENT_COLOR[modal.element]}`}>{modal.element}</span>
                {' '}· {getPet(modal.petId).rarity}
              </p>
              <p className="text-white font-bold mt-1">{getPet(modal.petId).name}</p>
            </div>
            <div>
              <p className="text-zinc-400 text-sm mb-2">Dê um nome ao seu bichinho:</p>
              <input value={hatchName} onChange={e => setHatchName(e.target.value)}
                placeholder={getPet(modal.petId).name} maxLength={20}
                className="w-full bg-zinc-800 border border-zinc-600 focus:border-yellow-400 rounded-xl px-4 py-2 text-white text-center outline-none transition-colors" />
            </div>
            <button onClick={handleConfirmName}
              className="w-full py-3 bg-yellow-400 hover:bg-yellow-300 text-black font-bold rounded-xl transition-all hover:scale-105">
              ✨ Confirmar nome!
            </button>
          </div>
        </div>
      )}

      {/* Modal — Duplicata → XP */}
      {modal?.kind === 'duplicate' && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#130F2A] border-2 border-purple-500 rounded-2xl p-8 max-w-sm w-full text-center space-y-4 shadow-2xl shadow-purple-500/20">
            <div className="text-5xl">🔄</div>
            <h2 className="text-xl font-bold text-purple-400">Bichinho Duplicado!</h2>
            <PetSprite petId={modal.petId} size={100} className="mx-auto opacity-60" />
            <div className="bg-zinc-800/60 rounded-xl p-4">
              <p className="text-zinc-400 text-sm">
                Você já tem um <span className="text-white font-medium">{getPet(modal.petId).name}</span>{' '}
                {ELEMENT_EMOJI[modal.element]} <span className={ELEMENT_COLOR[modal.element]}>{modal.element}</span>
              </p>
              <p className="text-yellow-400 font-bold text-xl mt-2">+{modal.xp} XP</p>
              <p className="text-zinc-500 text-xs mt-1">transferido para o bichinho existente</p>
            </div>
            <button onClick={handleCloseDuplicate}
              className="w-full py-3 bg-purple-500 hover:bg-purple-400 text-white font-bold rounded-xl transition-all hover:scale-105">
              Entendido!
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
