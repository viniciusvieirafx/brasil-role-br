'use client'

import {
  EGG_DB, getPet, randomElement, FIRST_EGG_SECONDS, rollCapsule, capsuleCostForTier, CAPSULE_COST, xpForLevel,
  type Rarity, type Element, type CapsuleReward,
} from './petData'

export interface EggInstance {
  instanceId: string
  type: Rarity
  receivedAt: number
  isFirstEgg?: boolean
}

export interface IncubatingEgg {
  egg: EggInstance
  startedAt: number
  endsAt: number
}

// Tamagotchi decay rates (per millisecond)
export const HUNGER_RATE_PER_MS = 1 / (5 * 60 * 1000)  // perde 1 de fome a cada 5 min
export const DIRTY_RATE_PER_MS  = 1 / (7 * 60 * 1000)  // fica 1 mais sujo a cada 7 min

// XP passivo
export const DAILY_XP = 30              // XP por dia estando vivo
export const PASSIVE_XP_PER_MIN = 0.4   // XP/min se fome>60 e limpeza>60

export interface PetInstance {
  instanceId: string
  petId: number
  element: Element
  name: string
  hatchedAt: number
  level: number
  xp: number
  lives: number           // 0-3
  recovering: boolean
  recoveryEndsAt?: number // timestamp
  // Tamagotchi stats (active pet only)
  hunger: number          // 0-100, 100 = cheio
  dirty: number           // 0-100, 0 = limpo
  lastStatUpdate?: number // timestamp do último cálculo
  lastDailyXpAt?: number  // timestamp do último XP diário
}

export interface PetNotification {
  id: string
  type: 'egg_ready' | 'battle_win' | 'battle_defended' | 'level_up'
  message: string
  timestamp: number
  read: boolean
}

export interface BattleLimitEntry {
  count: number        // batalhas travadas nesta janela
  windowStart: number  // timestamp do início da janela
}

export interface ClickerState {
  moedas: number
  totalMoedasEarned: number
  upgrades: Record<string, number>
  lastTickAt: number
}

export interface PetPlayerData {
  discordId: string
  hasStarted: boolean
  firstEggHatched: boolean      // true depois do primeiro eclodir
  ownedEggs: EggInstance[]
  incubating: IncubatingEgg | null
  ownedPets: PetInstance[]
  activePetId: string | null
  points: number
  totalPoints: number
  highScore: number
  notifications: PetNotification[]
  battleLimits: Record<string, BattleLimitEntry>  // chave = discordId do oponente
  clicker?: ClickerState
  updatedAt?: number             // timestamp do último saveData — usado para resolver race condition servidor vs local
}

const KEY = (id: string) => `pet_data_${id}`

export function loadData(discordId: string): PetPlayerData {
  if (typeof window === 'undefined') return empty(discordId)
  try {
    const raw = localStorage.getItem(KEY(discordId))
    if (raw) {
      const parsed = JSON.parse(raw)
      // Migração: pets sem element ganham elemento aleatório + defaults de tamagotchi
      if (parsed.ownedPets) {
        parsed.ownedPets = parsed.ownedPets.map((p: PetInstance) => ({
          ...p,
          element: p.element ?? randomElement(),
          hunger: p.hunger ?? 80,
          dirty: p.dirty ?? 10,
          lastDailyXpAt: p.lastDailyXpAt ?? 0,
        }))
      }
      // Migração: garantir campo notifications
      if (!parsed.notifications) parsed.notifications = []
      // Migração: garantir campo battleLimits
      if (!parsed.battleLimits) parsed.battleLimits = {}
      return { ...empty(discordId), ...parsed }
    }
  } catch {}
  return empty(discordId)
}

export function saveData(data: PetPlayerData) {
  if (typeof window === 'undefined') return
  const stamped = { ...data, updatedAt: Date.now() }
  localStorage.setItem(KEY(data.discordId), JSON.stringify(stamped))
  // Sincroniza com servidor de forma assíncrona
  syncToServer(stamped).catch(() => {})
}

export async function syncToServer(data: PetPlayerData): Promise<void> {
  await fetch('/api/pets/data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export async function loadFromServer(): Promise<PetPlayerData | null> {
  try {
    const res = await fetch('/api/pets/data')
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

function empty(discordId: string): PetPlayerData {
  return {
    discordId,
    hasStarted: false,
    firstEggHatched: false,
    ownedEggs: [],
    incubating: null,
    ownedPets: [],
    activePetId: null,
    points: 0,
    totalPoints: 0,
    highScore: 0,
    notifications: [],
    battleLimits: {},
  }
}

export function giveFirstEgg(data: PetPlayerData): PetPlayerData {
  const egg: EggInstance = {
    instanceId: crypto.randomUUID(),
    type: 'Comum',
    receivedAt: Date.now(),
    isFirstEgg: true,
  }
  return { ...data, hasStarted: true, ownedEggs: [...data.ownedEggs, egg] }
}

export function startIncubation(data: PetPlayerData, eggInstanceId: string): PetPlayerData {
  if (data.incubating) return data
  const egg = data.ownedEggs.find(e => e.instanceId === eggInstanceId)
  if (!egg) return data

  const def = EGG_DB.find(e => e.type === egg.type)!
  const now = Date.now()
  // Primeiro ovo demora 5 minutos, os demais seguem tempo normal da raridade
  const seconds = (!data.firstEggHatched || egg.isFirstEgg) ? FIRST_EGG_SECONDS : def.incubationSeconds

  return {
    ...data,
    ownedEggs: data.ownedEggs.filter(e => e.instanceId !== eggInstanceId),
    incubating: { egg, startedAt: now, endsAt: now + seconds * 1000 },
  }
}

export interface HatchResult {
  data: PetPlayerData
  hatchedPetId: number | null
  hatchedElement: Element | null
  isDuplicate: boolean      // mesmo petId + mesmo elemento
  xpGained: number          // XP transferido ao pet existente (se duplicado)
}

export function checkHatch(data: PetPlayerData): HatchResult {
  const none: HatchResult = { data, hatchedPetId: null, hatchedElement: null, isDuplicate: false, xpGained: 0 }
  if (!data.incubating) return none
  if (Date.now() < data.incubating.endsAt) return none

  const def = EGG_DB.find(e => e.type === data.incubating!.egg.type)!
  const petId = def.possiblePets[Math.floor(Math.random() * def.possiblePets.length)]
  const element = randomElement()

  const newData: PetPlayerData = { ...data, incubating: null, firstEggHatched: true }

  // Checa duplicata: mesmo petId + mesmo elemento
  const existing = newData.ownedPets.find(p => p.petId === petId && p.element === element)
  if (existing) {
    // Converte em XP para o pet existente
    const xpGained = def.xpOnDuplicate
    const updatedPets = newData.ownedPets.map(p => {
      if (p.instanceId !== existing.instanceId) return p
      const newXp = p.xp + xpGained
      const newLevel = computeLevel(newXp)
      return { ...p, xp: newXp, level: newLevel }
    })
    return { data: { ...newData, ownedPets: updatedPets }, hatchedPetId: petId, hatchedElement: element, isDuplicate: true, xpGained }
  }

  // Novo pet (mesmo petId com elemento diferente, ou totalmente novo)
  return { data: newData, hatchedPetId: petId, hatchedElement: element, isDuplicate: false, xpGained: 0 }
}

export function addPet(data: PetPlayerData, petId: number, element: Element, name: string): PetPlayerData {
  const pet: PetInstance = {
    instanceId: crypto.randomUUID(),
    petId, element, name,
    hatchedAt: Date.now(),
    level: 1,
    xp: 0,
    lives: 3,
    recovering: false,
    hunger: 100,
    dirty: 0,
    lastStatUpdate: Date.now(),
    lastDailyXpAt: 0,
  }
  return { ...data, ownedPets: [...data.ownedPets, pet] }
}

export function setActivePet(data: PetPlayerData, instanceId: string): PetPlayerData {
  return { ...data, activePetId: instanceId }
}

export function addPoints(data: PetPlayerData, amount: number): PetPlayerData {
  return { ...data, points: data.points + amount, totalPoints: data.totalPoints + amount }
}

export function updateHighScore(data: PetPlayerData, score: number): PetPlayerData {
  if (score <= data.highScore) return data
  return { ...data, highScore: score }
}

export function addXpToPet(data: PetPlayerData, instanceId: string, xp: number): PetPlayerData {
  const pets = data.ownedPets.map(p => {
    if (p.instanceId !== instanceId) return p
    const newXp = p.xp + xp
    return { ...p, xp: newXp, level: computeLevel(newXp) }
  })
  return { ...data, ownedPets: pets }
}

export function openCapsule(data: PetPlayerData, vipTier = 0): { data: PetPlayerData; reward: CapsuleReward } | null {
  const cost = capsuleCostForTier(vipTier)
  if (data.points < cost) return null
  const reward = rollCapsule(vipTier)
  let newData: PetPlayerData = { ...data, points: data.points - cost }

  if (reward.type === 'egg' && reward.rarity) {
    const egg: EggInstance = {
      instanceId: crypto.randomUUID(),
      type: reward.rarity,
      receivedAt: Date.now(),
    }
    newData = { ...newData, ownedEggs: [...newData.ownedEggs, egg] }
  } else if (reward.type === 'xp_boost' && reward.xpAmount) {
    newData = addXpBoostToActivePet(newData, reward.xpAmount)
  }

  return { data: newData, reward }
}

export function addXpBoostToActivePet(data: PetPlayerData, xp: number): PetPlayerData {
  if (!data.activePetId) return data
  return addXpToPet(data, data.activePetId, xp)
}

export function getClicker(data: PetPlayerData): ClickerState {
  return data.clicker ?? { moedas: 0, totalMoedasEarned: 0, upgrades: {}, lastTickAt: Date.now() }
}

export function saveClicker(data: PetPlayerData, clicker: ClickerState): PetPlayerData {
  return { ...data, clicker }
}

export const MAX_LIVES = 3
export const RECOVERY_MS = 24 * 60 * 60 * 1000  // 24h

export const BATTLE_LIMIT    = 3
export const BATTLE_COOLDOWN_MS = 60 * 60 * 1000  // 1h

export function applyBattleLoss(data: PetPlayerData, instanceId: string): PetPlayerData {
  const pets = data.ownedPets.map(p => {
    if (p.instanceId !== instanceId) return p
    const newLives = Math.max(0, (p.lives ?? MAX_LIVES) - 1)
    if (newLives === 0) {
      return { ...p, lives: 0, recovering: true, recoveryEndsAt: Date.now() + RECOVERY_MS }
    }
    return { ...p, lives: newLives }
  })
  return { ...data, ownedPets: pets }
}

export function checkRecovery(data: PetPlayerData): PetPlayerData {
  const now = Date.now()
  const pets = data.ownedPets.map(p => {
    if (p.recovering && p.recoveryEndsAt && now >= p.recoveryEndsAt) {
      return { ...p, recovering: false, lives: MAX_LIVES, recoveryEndsAt: undefined }
    }
    return p
  })
  return { ...data, ownedPets: pets }
}

export function recoverySecondsLeft(pet: PetInstance): number {
  if (!pet.recovering || !pet.recoveryEndsAt) return 0
  return Math.max(0, Math.ceil((pet.recoveryEndsAt - Date.now()) / 1000))
}

export function incubationProgress(inc: IncubatingEgg): number {
  const total = inc.endsAt - inc.startedAt
  const elapsed = Date.now() - inc.startedAt
  return Math.min(1, elapsed / total)
}

export function incubationSecondsLeft(inc: IncubatingEgg): number {
  return Math.max(0, Math.ceil((inc.endsAt - Date.now()) / 1000))
}

export function formatTimeLeft(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

function computeLevel(xp: number): number {
  let level = 1
  while (xpForLevel(level + 1) <= xp) level++
  return level
}

// ── Tamagotchi: fome e sujeira ─────────────────────────────────────────────────

/** Aplica decaimento de fome/sujeira ao bichinho ativo com base no tempo passado */
export function updateActivePetStats(data: PetPlayerData): PetPlayerData {
  if (!data.activePetId) return data
  const now = Date.now()
  const pets = data.ownedPets.map(p => {
    if (p.instanceId !== data.activePetId) return p
    const last = p.lastStatUpdate ?? now
    const elapsed = Math.max(0, now - last)
    const hungerLost = elapsed * HUNGER_RATE_PER_MS
    const dirtyGained = elapsed * DIRTY_RATE_PER_MS
    return {
      ...p,
      hunger: Math.max(0, (p.hunger ?? 100) - hungerLost),
      dirty: Math.min(100, (p.dirty ?? 0) + dirtyGained),
      lastStatUpdate: now,
    }
  })
  return { ...data, ownedPets: pets }
}

/**
 * Atualiza stats + concede XP diário e XP passivo ao bichinho ativo.
 * Substitui updateActivePetStats nos lugares que precisam de XP.
 */
export function updateActivePetFull(
  data: PetPlayerData,
): { data: PetPlayerData; leveledUp: boolean; newLevel: number } {
  if (!data.activePetId) return { data, leveledUp: false, newLevel: 0 }
  const pet = data.ownedPets.find(p => p.instanceId === data.activePetId)
  if (!pet) return { data, leveledUp: false, newLevel: 0 }

  const now = Date.now()
  const last = pet.lastStatUpdate ?? now
  const elapsed = Math.max(0, now - last)
  const elapsedMinutes = elapsed / 60_000

  // Tamagotchi decay
  const hungerLost  = elapsed * HUNGER_RATE_PER_MS
  const dirtyGained = elapsed * DIRTY_RATE_PER_MS

  // XP diário (uma vez a cada 24h)
  const DAY_MS = 24 * 60 * 60 * 1000
  const lastDaily = pet.lastDailyXpAt ?? 0
  const giveDailyXp = now - lastDaily >= DAY_MS

  // XP passivo por minuto se bem alimentado e limpo (fome>60 e sujeira<40)
  const wellCared = (pet.hunger ?? 100) > 60 && (pet.dirty ?? 0) < 40
  const passiveXp = wellCared ? PASSIVE_XP_PER_MIN * elapsedMinutes : 0

  const totalXp = (giveDailyXp ? DAILY_XP : 0) + passiveXp
  const oldLevel = pet.level

  const pets = data.ownedPets.map(p => {
    if (p.instanceId !== data.activePetId) return p
    const newXp  = p.xp + totalXp
    const newLvl = computeLevel(newXp)
    return {
      ...p,
      hunger: Math.max(0, (p.hunger ?? 100) - hungerLost),
      dirty:  Math.min(100, (p.dirty ?? 0) + dirtyGained),
      xp:     newXp,
      level:  newLvl,
      lastStatUpdate: now,
      lastDailyXpAt:  giveDailyXp ? now : (p.lastDailyXpAt ?? 0),
    }
  })

  const newPet  = pets.find(p => p.instanceId === data.activePetId)!
  const leveledUp = newPet.level > oldLevel

  let newData: PetPlayerData = { ...data, ownedPets: pets }
  if (leveledUp) {
    newData = addNotification(
      newData,
      'level_up',
      `${pet.name} subiu para o nível ${newPet.level}! 🎉`,
    )
  }

  return { data: newData, leveledUp, newLevel: newPet.level }
}

/** Alimenta o bichinho ativo (aumenta fome) */
export function feedActivePet(data: PetPlayerData, amount: number): PetPlayerData {
  if (!data.activePetId) return data
  const pets = data.ownedPets.map(p => {
    if (p.instanceId !== data.activePetId) return p
    return { ...p, hunger: Math.min(100, (p.hunger ?? 0) + amount), lastStatUpdate: Date.now() }
  })
  return { ...data, ownedPets: pets }
}

/** Limpa o bichinho ativo (reduz sujeira) */
export function cleanActivePet(data: PetPlayerData, amount: number): PetPlayerData {
  if (!data.activePetId) return data
  const pets = data.ownedPets.map(p => {
    if (p.instanceId !== data.activePetId) return p
    return { ...p, dirty: Math.max(0, (p.dirty ?? 100) - amount), lastStatUpdate: Date.now() }
  })
  return { ...data, ownedPets: pets }
}

// ── Notificações ──────────────────────────────────────────────────────────────

export function addNotification(
  data: PetPlayerData,
  type: PetNotification['type'],
  message: string,
): PetPlayerData {
  const notif: PetNotification = {
    id: crypto.randomUUID(),
    type,
    message,
    timestamp: Date.now(),
    read: false,
  }
  // Mantém no máximo 50 notificações
  return { ...data, notifications: [notif, ...(data.notifications ?? [])].slice(0, 50) }
}

export function markAllRead(data: PetPlayerData): PetPlayerData {
  return { ...data, notifications: (data.notifications ?? []).map(n => ({ ...n, read: true })) }
}

export function dismissNotification(data: PetPlayerData, id: string): PetPlayerData {
  return { ...data, notifications: (data.notifications ?? []).filter(n => n.id !== id) }
}

export function unreadCount(data: PetPlayerData): number {
  return (data.notifications ?? []).filter(n => !n.read).length
}

// ── Limite de batalhas por oponente ───────────────────────────────────────────

/** Retorna o status do limite de batalhas contra um oponente específico */
export function getBattleLimitStatus(data: PetPlayerData, opponentId: string): {
  blocked: boolean
  remaining: number
  cooldownSecsLeft: number
} {
  const entry = (data.battleLimits ?? {})[opponentId]

  if (!entry || Date.now() - entry.windowStart >= BATTLE_COOLDOWN_MS) {
    return { blocked: false, remaining: BATTLE_LIMIT, cooldownSecsLeft: 0 }
  }

  const remaining = Math.max(0, BATTLE_LIMIT - entry.count)
  const blocked = remaining === 0
  const cooldownSecsLeft = blocked
    ? Math.ceil((entry.windowStart + BATTLE_COOLDOWN_MS - Date.now()) / 1000)
    : 0

  return { blocked, remaining, cooldownSecsLeft }
}

/** Registra uma batalha travada contra um oponente (chama antes de iniciar a luta) */
export function recordBattleAgainst(data: PetPlayerData, opponentId: string): PetPlayerData {
  const limits = { ...(data.battleLimits ?? {}) }
  const entry = limits[opponentId]
  const now = Date.now()

  if (!entry || now - entry.windowStart >= BATTLE_COOLDOWN_MS) {
    limits[opponentId] = { count: 1, windowStart: now }
  } else {
    limits[opponentId] = { count: entry.count + 1, windowStart: entry.windowStart }
  }

  return { ...data, battleLimits: limits }
}
