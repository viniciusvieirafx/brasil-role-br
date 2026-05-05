'use client'
import { useEffect } from 'react'

export default function ClickSound() {
  useEffect(() => {
    let ctx: AudioContext | null = null

    const getCtx = () => {
      if (!ctx) ctx = new AudioContext()
      return ctx
    }

    const playClick = () => {
      const audio = getCtx()
      const bufferSize = audio.sampleRate * 0.02
      const buffer = audio.createBuffer(1, bufferSize, audio.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize)
      }

      const source = audio.createBufferSource()
      source.buffer = buffer

      const gain = audio.createGain()
      gain.gain.setValueAtTime(0.06, audio.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.02)

      const filter = audio.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 3000
      filter.Q.value = 0.8

      source.connect(filter)
      filter.connect(gain)
      gain.connect(audio.destination)
      source.start()
    }

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('a, button')) playClick()
    }

    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  return null
}
