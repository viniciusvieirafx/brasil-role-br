'use client'

import { useState } from 'react'

export interface TutorialStep {
  emoji: string
  title: string
  desc: string
}

interface Props {
  title: string
  emoji: string
  steps: TutorialStep[]
  onStart: () => void
  startLabel?: string
  startColor?: string
  extra?: React.ReactNode
}

export default function GameTutorial({
  title,
  emoji,
  steps,
  onStart,
  startLabel = 'Começar!',
  startColor = 'bg-green-500 hover:bg-green-400',
  extra,
}: Props) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="text-center space-y-5 py-4 max-w-sm mx-auto">
      <div className="text-6xl animate-bounce">{emoji}</div>
      <h2 className="text-white text-2xl font-bold">{title}</h2>

      {/* Tutorial toggle */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors border border-zinc-700 hover:border-zinc-500 rounded-lg px-3 py-1.5"
      >
        <span>📖</span>
        <span>{expanded ? 'Fechar tutorial' : 'Como jogar?'}</span>
        <span className="text-xs">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="bg-zinc-900/80 border border-zinc-700 rounded-2xl p-4 text-left space-y-3">
          {steps.map((step, i) => (
            <div key={i} className="flex gap-3 items-start">
              <div className="text-2xl shrink-0">{step.emoji}</div>
              <div>
                <p className="text-white text-sm font-semibold">{step.title}</p>
                <p className="text-zinc-400 text-xs mt-0.5">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {extra}

      <button
        onClick={onStart}
        className={`${startColor} text-white font-bold px-10 py-3 rounded-xl transition-all hover:scale-105 shadow-lg`}
      >
        {startLabel}
      </button>
    </div>
  )
}

// Botão flutuante "?" para re-abrir tutorial durante o jogo
export function TutorialButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Como jogar?"
      className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-600 hover:border-zinc-400 text-zinc-400 hover:text-white text-sm font-bold transition-all flex items-center justify-center"
    >
      ?
    </button>
  )
}
