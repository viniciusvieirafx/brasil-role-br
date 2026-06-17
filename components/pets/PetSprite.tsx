'use client'

import PetAnimator from './PetAnimator'

interface PetSpriteProps {
  petId: number
  size?: number
  animate?: boolean   // mantido por compatibilidade — agora sempre anima idle
  className?: string
}

export default function PetSprite({ petId, size = 80, className = '' }: PetSpriteProps) {
  return (
    <PetAnimator
      petId={petId}
      anim="idle"
      width={size}
      height={size}
      fps={8}
      smooth={size >= 100}
      className={className}
    />
  )
}
