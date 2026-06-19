'use client'

// Todos os sons sintetizados via Web Audio API — sem arquivos externos

let ctx: AudioContext | null = null

// ── Mute global (afeta todos os sons do site) ───────────────────────────────
let _muted = false
if (typeof window !== 'undefined') {
  _muted = localStorage.getItem('sound_muted') === '1'
}
export function getMuted(): boolean { return _muted }
export function setMuted(v: boolean) {
  _muted = v
  if (typeof window !== 'undefined') localStorage.setItem('sound_muted', v ? '1' : '0')
}
// Aliases mantidos para não quebrar imports antigos
export const getClickerMuted = getMuted
export const setClickerMuted = setMuted

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function playTone(freq: number, duration: number, type: OscillatorType = 'sine', vol = 0.3) {
  if (_muted) return
  const c = getCtx(); if (!c) return
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, c.currentTime)
  gain.gain.setValueAtTime(vol, c.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration)
  osc.connect(gain); gain.connect(c.destination)
  osc.start(); osc.stop(c.currentTime + duration)
}

function playChord(freqs: number[], duration: number, type: OscillatorType = 'sine', vol = 0.15) {
  freqs.forEach(f => playTone(f, duration, type, vol))
}

function playSequence(notes: { freq: number; start: number; dur: number }[], type: OscillatorType = 'sine', vol = 0.25) {
  const c = getCtx(); if (!c) return
  notes.forEach(({ freq, start, dur }) => {
    setTimeout(() => playTone(freq, dur, type, vol), start * 1000)
  })
}

export function playClick() {
  playTone(600, 0.06, 'square', 0.15)
}

export function playHover() {
  playTone(400, 0.04, 'sine', 0.08)
}

export function playSuccess() {
  playSequence([
    { freq: 523, start: 0,    dur: 0.12 },
    { freq: 659, start: 0.1,  dur: 0.12 },
    { freq: 784, start: 0.2,  dur: 0.25 },
  ])
}

export function playHatch() {
  // Melodia de nascimento
  playSequence([
    { freq: 523, start: 0,    dur: 0.15 },
    { freq: 659, start: 0.12, dur: 0.15 },
    { freq: 784, start: 0.24, dur: 0.15 },
    { freq: 1047,start: 0.36, dur: 0.4  },
    { freq: 880, start: 0.5,  dur: 0.15 },
    { freq: 1047,start: 0.62, dur: 0.5  },
  ])
}

export function playXpGain() {
  playSequence([
    { freq: 440, start: 0,   dur: 0.08 },
    { freq: 554, start: 0.07,dur: 0.08 },
    { freq: 659, start: 0.14,dur: 0.12 },
  ], 'triangle', 0.2)
}

export function playCapsuleOpen() {
  // Pop + shimmer
  const c = getCtx(); if (!c) return
  // pop
  playTone(200, 0.05, 'square', 0.4)
  // shimmer
  setTimeout(() => {
    playSequence([
      { freq: 800,  start: 0,    dur: 0.08 },
      { freq: 1000, start: 0.05, dur: 0.08 },
      { freq: 1200, start: 0.10, dur: 0.08 },
      { freq: 1600, start: 0.15, dur: 0.15 },
    ], 'sine', 0.2)
  }, 60)
}

export function playCapsuleLegendary() {
  playSequence([
    { freq: 392,  start: 0,    dur: 0.15 },
    { freq: 494,  start: 0.12, dur: 0.15 },
    { freq: 587,  start: 0.24, dur: 0.15 },
    { freq: 784,  start: 0.36, dur: 0.3  },
    { freq: 1047, start: 0.6,  dur: 0.5  },
  ])
}

export function playMiss() {
  playTone(150, 0.18, 'sawtooth', 0.2)
}

export function playCatch() {
  playTone(880, 0.08, 'sine', 0.2)
  setTimeout(() => playTone(1100, 0.06, 'sine', 0.15), 60)
}

export function playJump() {
  const c = getCtx(); if (!c) return
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'square'
  osc.frequency.setValueAtTime(300, c.currentTime)
  osc.frequency.exponentialRampToValueAtTime(600, c.currentTime + 0.12)
  gain.gain.setValueAtTime(0.15, c.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15)
  osc.connect(gain); gain.connect(c.destination)
  osc.start(); osc.stop(c.currentTime + 0.15)
}

export function playDeath() {
  playSequence([
    { freq: 400, start: 0,    dur: 0.15 },
    { freq: 300, start: 0.12, dur: 0.15 },
    { freq: 200, start: 0.24, dur: 0.3  },
  ], 'sawtooth', 0.2)
}
